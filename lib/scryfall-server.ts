import 'server-only';
import type { ScryfallCard, ScryfallListResponse, ScryfallSet } from './scryfall';

const CACHE_DURATION = 604800; // 7 days

// Mechanics that enable instant-speed play
// TODO: Add keywords per set
const SET_INSTANT_MECHANICS: Record<string, string[]> = {
  // 2025-2024 Sets
  'fdn': [],
  'dsk': [],
  'blb': [],
  'mh3': [],
  'otj': [],
  'big': [],
  'mkm': [],
  'lci': [],

  // 2023 Sets
  'woe': [],
  'mat': [],
  'cmm': [],
  'ltr': [],
  'mom': [],
  'moc': [],
  'one': [],

  // 2022 Sets
  'bro': [],
  'brc': [],
  'dmu': [],
  'clb': [],
  'snc': [],
  'ncc': [],
  'neo': [],
  'nec': [],

  // 2021 Sets
  'vow': [],
  'mid': [],
  'afr': [],
  'mh2': [],
  'stx': [],
  'khm': [],

  // 2020 Sets
  'khc': [],
  'cmr': [],
  'znr': [],
  'znc': [],
  'm21': [],
  'iko': [],
  'thb': [],

  // 2019 Sets
  'eld': [],
  'm20': [],
  'mh1': [],
  'war': [],
  'rna': [],

  // 2018 Sets
  'grn': [],
  'm19': [],
  'dom': [],
  'rix': [],

  // 2017 Sets
  'xln': [],
  'hou': [],
  'akh': [],
  'mm3': [],
  'aer': [],

  // 2016 Sets
  'emn': [],
  'soi': [],
  'ogw': [],

  // 2015 Sets
  'bfz': [],
  'dtk': [],
  'frf': [],

  // 2014 Sets
  'ktk': [],
  'm15': [],

  // 2013 Sets
  'ths': [],
  'm14': [],

  // 2012 Sets
  'rtr': [],
  'm13': [],
  'avr': [],

  // Older Notable Sets
  'tsp': [],
  'ons': [],
  'scg': [],
  'lgn': [],
  'jud': [],
  'tor': [],
  'ody': [],
  'chk': [],
  'bok': [],
  'sok': [],

  // Masters/Remaster Sets
  'uma': [],
  'pca': [],
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

  // Build query with set-specific instant-speed mechanics
  const mechanics = SET_INSTANT_MECHANICS[setCode.toLowerCase()] || [];
  const mechanicsQuery = mechanics.length > 0
    ? ` OR ${mechanics.map(m => `keyword:${m}`).join(' OR ')}`
    : '';

  const query = encodeURIComponent(`set:${setCode} (type:instant OR keyword:flash${mechanicsQuery})`);
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

  // Fetch counterspells separately to mark them
  const counterspellIds = await fetchCounterspellIds(setCode);
  const spgCounterspellIds = await fetchSpecialGuestsCounterspellIds(setCode);
  const allCounterspellIds = new Set([...counterspellIds, ...spgCounterspellIds]);

  // Mark cards that are counterspells
  return allCards.map(card => ({
    ...card,
    isCounterspell: allCounterspellIds.has(card.id)
  }));
}

async function fetchCounterspellIds(setCode: string): Promise<Set<string>> {
  "use cache";

  // Build query with set-specific instant-speed mechanics
  const mechanics = SET_INSTANT_MECHANICS[setCode.toLowerCase()] || [];
  const mechanicsQuery = mechanics.length > 0
    ? ` OR ${mechanics.map(m => `keyword:${m}`).join(' OR ')}`
    : '';

  const query = encodeURIComponent(`set:${setCode} (type:instant OR keyword:flash${mechanicsQuery}) oracletag:counterspell`);
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

  // Build query with set-specific instant-speed mechanics
  const mechanics = SET_INSTANT_MECHANICS[setCode.toLowerCase()] || [];
  const mechanicsQuery = mechanics.length > 0
    ? ` OR ${mechanics.map(m => `keyword:${m}`).join(' OR ')}`
    : '';

  // Fetch Special Guests cards released alongside the main set
  const query = encodeURIComponent(`set:spg date:${setCode} (type:instant OR keyword:flash${mechanicsQuery})`);
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

  // Build query with set-specific instant-speed mechanics
  const mechanics = SET_INSTANT_MECHANICS[setCode.toLowerCase()] || [];
  const mechanicsQuery = mechanics.length > 0
    ? ` OR ${mechanics.map(m => `keyword:${m}`).join(' OR ')}`
    : '';

  const query = encodeURIComponent(`set:spg date:${setCode} (type:instant OR keyword:flash${mechanicsQuery}) oracletag:counterspell`);
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

