import 'server-only';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ScryfallSet, ScryfallCard } from './scryfall';
import { fetchSets as fetchSetsAPI, fetchInstantsFromSet as fetchInstantsFromSetAPI } from './scryfall-server';

interface SetWithCards {
  set: ScryfallSet;
  cards: ScryfallCard[];
}

// Number of most recent sets to fetch dynamically from API
const DYNAMIC_SETS_COUNT = 3;

let compressedDataCache: SetWithCards[] | null = null;

async function loadCompressedData(): Promise<SetWithCards[]> {
  if (compressedDataCache) {
    return compressedDataCache;
  }

  const dataPath = join(process.cwd(), 'data', 'cards-compressed.json');
  const content = await readFile(dataPath, 'utf-8');
  compressedDataCache = JSON.parse(content);
  return compressedDataCache!;
}

/**
 * Get all sets - combines static compressed data with recent sets from API
 */
export async function fetchSets(): Promise<ScryfallSet[]> {
  "use cache";

  // Get static sets from compressed data
  const compressedData = await loadCompressedData();
  const staticSets = compressedData.map(({ set }) => set);

  // Get latest sets from API
  const apiSets = await fetchSetsAPI();
  const dynamicSets = apiSets.slice(0, DYNAMIC_SETS_COUNT);
  const dynamicSetCodes = new Set(dynamicSets.map(s => s.code));

  // Combine: dynamic sets first, then static sets (excluding duplicates)
  const allSets = [
    ...dynamicSets,
    ...staticSets.filter(s => !dynamicSetCodes.has(s.code))
  ];

  // Sort by release date (most recent first)
  return allSets.sort((a, b) =>
    new Date(b.released_at).getTime() - new Date(a.released_at).getTime()
  );
}

/**
 * Get cards for a set - uses compressed data if available, otherwise fetches from API
 */
export async function fetchInstantsFromSet(setCode: string): Promise<ScryfallCard[]> {
  "use cache";

  // Try to find in compressed data first
  const compressedData = await loadCompressedData();
  const setData = compressedData.find(({ set }) => set.code === setCode);

  if (setData) {
    // Use compressed data for older sets
    return setData.cards;
  } else {
    // Fetch from API for recent sets or sets not in compressed data
    return fetchInstantsFromSetAPI(setCode);
  }
}
