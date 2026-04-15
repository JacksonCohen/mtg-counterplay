import 'server-only';
import type { ScryfallCard, ScryfallListResponse, ScryfallSet } from './scryfall';

const CACHE_DURATION = 604800; // 7 days

const EXTRA_CARD_SHEETS: Record<string, string[]> = {
  'sos': ['soa'], // Secrets of Strixhaven: Mystical Archives
  'stx': ['sta'],  // Strixhaven: Mystical Archives
  'tsp': ['tsb'],  // Time Spiral: Timeshifted
};

type ManualInclusion = string | { name: string; cost: string };

const MANUAL_INCLUSIONS: Record<string, ManualInclusion[]> = {
  // Examples:
  // 'stx': ['Card Name'],  // Simple name
  // 'neo': [{ name: 'Card Name', cost: '{2}{U}' }],  // With custom cost for effective CMC
  'sos': [{
    n
  }]
};

// Helper function to fetch with retry on rate limits
async function fetchWithRetry(url: string, retries = 7, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, {
      next: { revalidate: CACHE_DURATION }
    });

    if (response.ok || response.status === 404) {
      return response;
    }

    // Rate limited or server error - retry with backoff
    if (response.status === 429 || response.status >= 500) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        continue;
      }
    }

    return response;
  }

  return fetch(url, {
    next: { revalidate: CACHE_DURATION }
  });
}

export async function fetchSets(): Promise<ScryfallSet[]> {
  "use cache";

  const response = await fetchWithRetry('https://api.scryfall.com/sets');

  if (!response.ok) {
    throw new Error('Failed to fetch sets');
  }

  const data: ScryfallListResponse<ScryfallSet> = await response.json();

  // Filter to expansion, core, masters, draft_innovation sets (main playable sets)
  // Excludes commander sets as they're not typically used in limited formats
  const validTypes = ['expansion', 'core', 'masters', 'draft_innovation', 'funny'];
  return data.data
    .filter(set => validTypes.includes(set.set_type) && set.card_count > 0)
    .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime());
}

export async function fetchInstantsFromSet(setCode: string): Promise<ScryfallCard[]> {
  "use cache";

  const query = encodeURIComponent(`set:${setCode} (type:instant OR keyword:flash)`);
  let allCards: ScryfallCard[] = [];
  let url: string | null = `https://api.scryfall.com/cards/search?q=${query}&order=cmc`;

  while (url) {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      if (response.status === 404) {
        // No instant-speed cards in this set
        return [];
      }
      throw new Error('Failed to fetch cards');
    }

    const data: ScryfallListResponse<ScryfallCard> = await response.json();
    allCards = [...allCards, ...data.data];
    url = data.has_more ? data.next_page ?? null : null;
  }

  // Fetch Special Guests cards released alongside this set
  const spgCards = await fetchSpecialGuestsFromSet(setCode);
  allCards = [...allCards, ...spgCards];

  // Fetch extra card sheets (mystical archives, timeshifted, etc.)
  const extraCards = await fetchExtraCardsFromSet(setCode);
  allCards = [...allCards, ...extraCards];

  // Fetch manually included cards
  const manualCards = await fetchManualInclusionsFromSet(setCode);
  allCards = [...allCards, ...manualCards];

  // Fetch counterspells separately to mark them
  const counterspellIds = await fetchCounterspellIds(setCode);
  const spgCounterspellIds = await fetchSpecialGuestsCounterspellIds(setCode);
  const extraCounterspellIds = await fetchExtraCardsCounterspellIds(setCode);
  const allCounterspellIds = new Set([...counterspellIds, ...spgCounterspellIds, ...extraCounterspellIds]);

  // Mark cards that are counterspells
  return allCards.map(card => ({
    ...card,
    isCounterspell: allCounterspellIds.has(card.id)
  }));
}

async function fetchCounterspellIds(setCode: string): Promise<Set<string>> {
  "use cache";

  const query = encodeURIComponent(`set:${setCode} (type:instant OR keyword:flash) oracletag:counterspell`);
  const ids = new Set<string>();
  let url: string | null = `https://api.scryfall.com/cards/search?q=${query}`;

  while (url) {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      // Return what we have so far for any error
      // Counterspell tagging is optional, better to show cards without tags than fail
      console.warn(`Failed to fetch counterspells for ${setCode}: ${response.status}`);
      return ids;
    }

    const data: ScryfallListResponse<ScryfallCard> = await response.json();
    data.data.forEach(card => ids.add(card.id));
    url = data.has_more ? data.next_page ?? null : null;
  }

  return ids;
}

async function fetchSpecialGuestsFromSet(setCode: string): Promise<ScryfallCard[]> {
  "use cache";

  // Fetch Special Guests cards released alongside the main set
  const query = encodeURIComponent(`set:spg date:${setCode} (type:instant OR keyword:flash)`);
  let allCards: ScryfallCard[] = [];
  let url: string | null = `https://api.scryfall.com/cards/search?q=${query}&order=cmc`;

  while (url) {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      // Return empty array for any error (404, rate limits, etc.)
      // Special Guests are optional, so we don't want to fail the build
      console.warn(`Failed to fetch Special Guests for ${setCode}: ${response.status}`);
      return allCards;
    }

    const data: ScryfallListResponse<ScryfallCard> = await response.json();
    allCards = [...allCards, ...data.data];
    url = data.has_more ? data.next_page ?? null : null;
  }

  return allCards;
}

async function fetchSpecialGuestsCounterspellIds(setCode: string): Promise<Set<string>> {
  "use cache";

  const query = encodeURIComponent(`set:spg date:${setCode} (type:instant OR keyword:flash) oracletag:counterspell`);
  const ids = new Set<string>();
  let url: string | null = `https://api.scryfall.com/cards/search?q=${query}`;

  while (url) {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      // Return what we have so far for any error
      // Special Guests counterspells are optional
      console.warn(`Failed to fetch Special Guests counterspells for ${setCode}: ${response.status}`);
      return ids;
    }

    const data: ScryfallListResponse<ScryfallCard> = await response.json();
    data.data.forEach(card => ids.add(card.id));
    url = data.has_more ? data.next_page ?? null : null;
  }

  return ids;
}

async function fetchExtraCardsFromSet(setCode: string): Promise<ScryfallCard[]> {
  "use cache";

  const extraSheets = EXTRA_CARD_SHEETS[setCode.toLowerCase()] || [];
  if (extraSheets.length === 0) {
    return [];
  }

  let allCards: ScryfallCard[] = [];

  // Fetch cards from each extra sheet
  for (const sheetCode of extraSheets) {
    const query = encodeURIComponent(`set:${sheetCode} (type:instant OR keyword:flash)`);
    let url: string | null = `https://api.scryfall.com/cards/search?q=${query}&order=cmc`;

    while (url) {
      const response = await fetchWithRetry(url);

      if (!response.ok) {
        console.warn(`Failed to fetch extra cards from ${sheetCode} for ${setCode}: ${response.status}`);
        break;
      }

      const data: ScryfallListResponse<ScryfallCard> = await response.json();
      allCards = [...allCards, ...data.data];
      url = data.has_more ? data.next_page ?? null : null;
    }
  }

  return allCards;
}

async function fetchExtraCardsCounterspellIds(setCode: string): Promise<Set<string>> {
  "use cache";

  const extraSheets = EXTRA_CARD_SHEETS[setCode.toLowerCase()] || [];
  if (extraSheets.length === 0) {
    return new Set();
  }

  const ids = new Set<string>();

  // Fetch counterspells from each extra sheet
  for (const sheetCode of extraSheets) {
    const query = encodeURIComponent(`set:${sheetCode} (type:instant OR keyword:flash) oracletag:counterspell`);
    let url: string | null = `https://api.scryfall.com/cards/search?q=${query}`;

    while (url) {
      const response = await fetchWithRetry(url);

      if (!response.ok) {
        console.warn(`Failed to fetch extra counterspells from ${sheetCode} for ${setCode}: ${response.status}`);
        break;
      }

      const data: ScryfallListResponse<ScryfallCard> = await response.json();
      data.data.forEach(card => ids.add(card.id));
      url = data.has_more ? data.next_page ?? null : null;
    }
  }

  return ids;
}

async function fetchManualInclusionsFromSet(setCode: string): Promise<ScryfallCard[]> {
  "use cache";

  const inclusions = MANUAL_INCLUSIONS[setCode.toLowerCase()] || [];
  if (inclusions.length === 0) {
    return [];
  }

  const allCards: ScryfallCard[] = [];

  // Fetch each manually included card by name
  for (const inclusion of inclusions) {
    const cardName = typeof inclusion === 'string' ? inclusion : inclusion.name;
    const customCost = typeof inclusion === 'object' ? inclusion.cost : undefined;

    const query = encodeURIComponent(`set:${setCode} !"${cardName}"`);
    const url = `https://api.scryfall.com/cards/search?q=${query}`;

    const response = await fetchWithRetry(url);

    if (!response.ok) {
      console.warn(`Failed to fetch manual inclusion "${cardName}" from ${setCode}: ${response.status}`);
      continue;
    }

    const data: ScryfallListResponse<ScryfallCard> = await response.json();
    if (data.data.length > 0) {
      allCards.push(data.data[0]); // Take first match
      // Note: customCost will be used for effectiveCmc calculation in feature branch
    }
  }

  return allCards;
}

