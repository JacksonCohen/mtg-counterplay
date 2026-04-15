import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { ScryfallSet, ScryfallCard, ScryfallListResponse } from '../lib/scryfall';

interface SetWithCards {
  set: ScryfallSet;
  cards: ScryfallCard[];
}

// Helper function to fetch with retry on rate limits
async function fetchWithRetry(url: string, retries = 7, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);

    if (response.ok || response.status === 404) {
      return response;
    }

    // Rate limited or server error - retry with backoff
    if (response.status === 429 || response.status >= 500) {
      if (i < retries - 1) {
        console.log(`  Rate limited, retrying in ${delay * Math.pow(2, i)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        continue;
      }
    }

    return response;
  }

  return fetch(url);
}

// Simple helper to calculate mana value from manual cost strings
function calculateManualCost(cost: string): number {
  if (!cost) return 0;
  const symbols = cost.match(/\{[^}]+\}/g) || [];
  let total = 0;
  for (const symbol of symbols) {
    const content = symbol.slice(1, -1);
    if (/^\d+$/.test(content)) {
      total += parseInt(content, 10);
    } else if (content !== 'X') {
      total += 1;
    }
  }
  return total;
}

const EXTRA_CARD_SHEETS: Record<string, string[]> = {
  'sos': ['soa'], // Secrets of Strixhaven: Mystical Archives
  'stx': ['sta'],  // Strixhaven: Mystical Archives
  'tsp': ['tsb'],  // Time Spiral: Timeshifted
};

type ManualInclusion = string | { name: string; cost: string };

const MANUAL_INCLUSIONS: Record<string, ManualInclusion[]> = {
  'sos': [
    { name: 'Brush Off', cost: '{1}{U}' },
    { name: 'Run Behind', cost: '{2}{U}' },
    { name: 'Page, Loose Leaf', cost: '{0}' },
    { name: 'Wilt in the Heat', cost: '{R}{W}' },
    { name: "Visionary's Dance", cost: '{2}' },
  ]
};

async function fetchSets(): Promise<ScryfallSet[]> {
  const response = await fetchWithRetry('https://api.scryfall.com/sets');

  if (!response.ok) {
    throw new Error('Failed to fetch sets');
  }

  const data: ScryfallListResponse<ScryfallSet> = await response.json();

  const validTypes = ['expansion', 'core', 'masters', 'draft_innovation', 'funny'];
  return data.data
    .filter(set => validTypes.includes(set.set_type) && set.card_count > 0)
    .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime());
}

async function fetchInstantsFromSet(setCode: string): Promise<ScryfallCard[]> {
  const query = encodeURIComponent(`set:${setCode} (type:instant OR keyword:flash)`);
  let allCards: ScryfallCard[] = [];
  let url: string | null = `https://api.scryfall.com/cards/search?q=${query}&order=cmc`;

  while (url) {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error('Failed to fetch cards');
    }

    const data: ScryfallListResponse<ScryfallCard> = await response.json();
    allCards = [...allCards, ...data.data];
    url = data.has_more ? data.next_page ?? null : null;
  }

  // Fetch Special Guests cards
  const spgCards = await fetchSpecialGuestsFromSet(setCode);
  allCards = [...allCards, ...spgCards];

  // Fetch extra card sheets
  const extraCards = await fetchExtraCardsFromSet(setCode);
  allCards = [...allCards, ...extraCards];

  // Fetch manually included cards
  const manualCards = await fetchManualInclusionsFromSet(setCode);
  allCards = [...allCards, ...manualCards];

  // Deduplicate cards by ID
  const uniqueCards = new Map<string, ScryfallCard>();
  for (const card of allCards) {
    if (!uniqueCards.has(card.id)) {
      uniqueCards.set(card.id, card);
    } else {
      const existing = uniqueCards.get(card.id)!;
      const manualCost = (card as any)._manualCost;
      if (manualCost && !(existing as any)._manualCost) {
        uniqueCards.set(card.id, { ...existing, _manualCost: manualCost } as any);
      }
    }
  }
  const deduplicatedCards = Array.from(uniqueCards.values());

  // Fetch counterspells
  const counterspellIds = await fetchCounterspellIds(setCode);
  const spgCounterspellIds = await fetchSpecialGuestsCounterspellIds(setCode);
  const extraCounterspellIds = await fetchExtraCardsCounterspellIds(setCode);
  const allCounterspellIds = new Set([...counterspellIds, ...spgCounterspellIds, ...extraCounterspellIds]);

  return deduplicatedCards.map(card => {
    const manualCost = (card as any)._manualCost;
    const effectiveCmc = manualCost ? calculateManualCost(manualCost) : undefined;

    return {
      ...card,
      isCounterspell: allCounterspellIds.has(card.id),
      effectiveCmc: effectiveCmc,
      mana_cost: manualCost || card.mana_cost
    };
  });
}

async function fetchCounterspellIds(setCode: string): Promise<Set<string>> {
  const query = encodeURIComponent(`set:${setCode} (type:instant OR keyword:flash) oracletag:counterspell`);
  const ids = new Set<string>();
  let url: string | null = `https://api.scryfall.com/cards/search?q=${query}`;

  while (url) {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
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
  const query = encodeURIComponent(`set:spg date:${setCode} (type:instant OR keyword:flash)`);
  let allCards: ScryfallCard[] = [];
  let url: string | null = `https://api.scryfall.com/cards/search?q=${query}&order=cmc`;

  while (url) {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
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
  const query = encodeURIComponent(`set:spg date:${setCode} (type:instant OR keyword:flash) oracletag:counterspell`);
  const ids = new Set<string>();
  let url: string | null = `https://api.scryfall.com/cards/search?q=${query}`;

  while (url) {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
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
  const extraSheets = EXTRA_CARD_SHEETS[setCode.toLowerCase()] || [];
  if (extraSheets.length === 0) {
    return [];
  }

  let allCards: ScryfallCard[] = [];

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
  const extraSheets = EXTRA_CARD_SHEETS[setCode.toLowerCase()] || [];
  if (extraSheets.length === 0) {
    return new Set();
  }

  const ids = new Set<string>();

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
  const inclusions = MANUAL_INCLUSIONS[setCode.toLowerCase()] || [];
  if (inclusions.length === 0) {
    return [];
  }

  const allCards: ScryfallCard[] = [];

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
      const card = data.data[0];
      allCards.push(customCost ? { ...card, _manualCost: customCost } as any : card);
    }
  }

  return allCards;
}

async function scrapeAllCards() {
  console.log('Fetching all sets...');
  const sets = await fetchSets();
  console.log(`Found ${sets.length} sets`);

  const data: SetWithCards[] = [];

  for (const set of sets) {
    console.log(`Fetching cards for ${set.name} (${set.code})...`);
    try {
      const cards = await fetchInstantsFromSet(set.code);
      console.log(`  Found ${cards.length} instant-speed cards`);

      data.push({
        set,
        cards,
      });

      // Add a small delay to be respectful to Scryfall API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`  Error fetching cards for ${set.code}:`, error);
    }
  }

  // Ensure data directory exists
  const dataDir = join(process.cwd(), 'data');
  await mkdir(dataDir, { recursive: true });

  // Write to JSON file
  const outputPath = join(dataDir, 'cards.json');
  console.log(`\nWriting ${data.length} sets to ${outputPath}...`);

  await writeFile(
    outputPath,
    JSON.stringify(data, null, 2),
    'utf-8'
  );

  console.log('Done!');
  console.log(`Total sets: ${data.length}`);
  console.log(`Total cards: ${data.reduce((sum, s) => sum + s.cards.length, 0)}`);
}

scrapeAllCards().catch(console.error);
