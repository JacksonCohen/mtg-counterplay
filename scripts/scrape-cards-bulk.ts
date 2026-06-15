import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as JSONStream from 'JSONStream';
import type { ScryfallSet, ScryfallCard, ScryfallListResponse } from '../lib/scryfall';

interface SetWithCards {
  set: ScryfallSet;
  cards: ScryfallCard[];
}

interface BulkDataInfo {
  object: string;
  id: string;
  type: string;
  updated_at: string;
  uri: string;
  name: string;
  description: string;
  download_uri: string;
  compressed_size: number;
  content_type: string;
  content_encoding: string;
}

interface BulkCard extends ScryfallCard {
  oracle_id?: string;
  oracle_tags?: string[];
  promo_types?: string[];
  frame_effects?: string[];
  lang: string;
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

const USER_AGENT = 'MTG-Instant-Spell-Reference/1.0';

async function fetchSets(): Promise<ScryfallSet[]> {
  console.log('Fetching sets list...');
  const response = await fetch('https://api.scryfall.com/sets', {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error');
    throw new Error(`Failed to fetch sets: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data: ScryfallListResponse<ScryfallSet> = await response.json();

  const validTypes = ['expansion', 'core', 'masters', 'draft_innovation', 'funny'];
  return data.data
    .filter(set => validTypes.includes(set.set_type) && set.card_count > 0)
    .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime());
}

async function getBulkDataUrl(): Promise<string> {
  console.log('Fetching bulk data info...');
  const bulkDataResponse = await fetch('https://api.scryfall.com/bulk-data', {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!bulkDataResponse.ok) {
    const errorText = await bulkDataResponse.text().catch(() => 'Unable to read error');
    throw new Error(`Failed to fetch bulk data info: ${bulkDataResponse.status} ${bulkDataResponse.statusText} - ${errorText}`);
  }

  const bulkDataList: { data: BulkDataInfo[] } = await bulkDataResponse.json();

  // Find the "All Cards" bulk data
  const allCardsData = bulkDataList.data.find(item => item.type === 'all_cards');

  if (!allCardsData) {
    throw new Error('Could not find all_cards bulk data');
  }

  console.log(`Bulk data URL: ${allCardsData.download_uri}`);
  console.log(`Size: ${(allCardsData.compressed_size / 1024 / 1024).toFixed(2)} MB (compressed)`);
  console.log(`Last updated: ${allCardsData.updated_at}\n`);

  return allCardsData.download_uri;
}

function isInstantSpeedCard(card: BulkCard): boolean {
  // Check if it's an instant
  if (card.type_line?.includes('Instant')) {
    return true;
  }

  // Check for Flash or Channel keywords
  if (card.keywords) {
    const hasFlash = card.keywords.some(k => k.toLowerCase() === 'flash');
    const hasChannel = card.keywords.some(k => k.toLowerCase() === 'channel');
    if (hasFlash || hasChannel) {
      return true;
    }
  }

  return false;
}

async function streamAndFilterCards(
  url: string,
  validSetCodes: Set<string>
): Promise<Map<string, BulkCard[]>> {
  console.log('Downloading and streaming bulk data...');

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download bulk data');
  }

  const cardsBySet = new Map<string, BulkCard[]>();
  let totalProcessed = 0;
  let totalMatched = 0;

  // Convert fetch ReadableStream to Node.js Readable stream with proper buffering
  const readable = Readable.fromWeb(response.body as any);

  // Parse JSON stream
  const parser = JSONStream.parse('*');

  let lastLog = Date.now();

  parser.on('data', (card: BulkCard) => {
    totalProcessed++;

    // Log progress every 2 seconds
    if (Date.now() - lastLog > 2000) {
      process.stdout.write(`\rProcessed ${totalProcessed.toLocaleString()} cards, matched ${totalMatched.toLocaleString()}...`);
      lastLog = Date.now();
    }

    // Skip non-English cards
    if (card.lang !== 'en') {
      return;
    }

    // Skip if not instant-speed
    if (!isInstantSpeedCard(card)) {
      return;
    }

    // Get the set code
    const setCode = card.set?.toLowerCase();
    if (!setCode) return;

    // Skip if not in our valid sets
    if (!validSetCodes.has(setCode)) {
      // Check if it's part of an extra sheet
      let isExtraSheet = false;
      for (const [mainSet, extraSheets] of Object.entries(EXTRA_CARD_SHEETS)) {
        if (extraSheets.includes(setCode) && validSetCodes.has(mainSet)) {
          if (!cardsBySet.has(mainSet)) {
            cardsBySet.set(mainSet, []);
          }
          cardsBySet.get(mainSet)!.push(card);
          isExtraSheet = true;
          totalMatched++;
          break;
        }
      }

      if (!isExtraSheet) {
        return;
      }
    } else {
      // Add to the set's card list
      if (!cardsBySet.has(setCode)) {
        cardsBySet.set(setCode, []);
      }
      cardsBySet.get(setCode)!.push(card);
      totalMatched++;
    }
  });

  // Stream the data through the parser
  await pipeline(readable, parser);

  console.log(`\n\nProcessed ${totalProcessed.toLocaleString()} total cards`);
  console.log(`Found ${totalMatched.toLocaleString()} instant-speed cards in ${cardsBySet.size} sets`);

  return cardsBySet;
}

function processAndDeduplicateCards(
  cardsBySet: Map<string, BulkCard[]>,
  sets: ScryfallSet[]
): SetWithCards[] {
  console.log('\nProcessing and deduplicating cards...');

  const result: SetWithCards[] = [];

  for (const set of sets) {
    const setCode = set.code.toLowerCase();
    let cards = cardsBySet.get(setCode) || [];

    // Apply manual inclusions
    const manualInclusions = MANUAL_INCLUSIONS[setCode];
    if (manualInclusions) {
      for (const inclusion of manualInclusions) {
        if (typeof inclusion === 'object') {
          const cardName = inclusion.name.toLowerCase();
          const customCost = inclusion.cost;
          const existingIndex = cards.findIndex(c => c.name.toLowerCase() === cardName);
          if (existingIndex >= 0) {
            cards[existingIndex] = { ...cards[existingIndex], _manualCost: customCost } as any;
          }
        }
      }
    }

    // Deduplicate by oracle_id within set, preferring base printings
    const uniqueCards = new Map<string, BulkCard>();
    for (const card of cards) {
      if (!card.oracle_id) continue;

      const existing = uniqueCards.get(card.oracle_id);

      // Determine if this is a "better" (more base) printing than what we have
      const shouldReplace = !existing || (() => {
        // Prefer non-promo over promo
        const existingIsPromo = (existing as BulkCard).promo_types && (existing as BulkCard).promo_types!.length > 0;
        const cardIsPromo = card.promo_types && card.promo_types.length > 0;
        if (existingIsPromo && !cardIsPromo) return true;
        if (!existingIsPromo && cardIsPromo) return false;

        // Prefer standard frames over special frames
        const specialFrames = ['showcase', 'extendedart', 'borderless'];
        const existingHasSpecial = (existing as BulkCard).frame_effects?.some((e: string) => specialFrames.includes(e));
        const cardHasSpecial = card.frame_effects?.some((e: string) => specialFrames.includes(e));
        if (existingHasSpecial && !cardHasSpecial) return true;
        if (!existingHasSpecial && cardHasSpecial) return false;

        // Prefer lowest collector number (base printing)
        const existingNum = parseInt((existing as any).collector_number) || 999999;
        const cardNum = parseInt((card as any).collector_number) || 999999;
        return cardNum < existingNum;
      })();

      if (shouldReplace) {
        // Check oracle tags for counterspell markers
        const oracleTags = card.oracle_tags || [];
        const isCounterspell = oracleTags.includes('counterspell') || oracleTags.includes('counterspell-free');
        const isCounterspellFree = oracleTags.includes('counterspell-free');

        // Handle manual cost override
        const manualCost = (card as any)._manualCost;
        const effectiveCmc = manualCost ? calculateManualCost(manualCost) : undefined;

        uniqueCards.set(card.oracle_id, {
          ...card,
          oracle_id: card.oracle_id, // Ensure oracle_id is set
          isCounterspell,
          isCounterspellFree,
          effectiveCmc,
          mana_cost: manualCost || card.mana_cost,
        } as BulkCard);
      }
    }

    if (uniqueCards.size > 0) {
      result.push({
        set,
        cards: Array.from(uniqueCards.values()) as ScryfallCard[],
      });
    }
  }

  return result;
}

async function scrapeAllCards() {
  try {
    // Fetch sets list
    const sets = await fetchSets();
    console.log(`Found ${sets.length} valid sets\n`);

    // Create a set of valid set codes for fast lookup
    const validSetCodes = new Set(sets.map(s => s.code.toLowerCase()));

    // Get bulk data URL
    const bulkDataUrl = await getBulkDataUrl();

    // Stream and filter cards
    const cardsBySet = await streamAndFilterCards(bulkDataUrl, validSetCodes);

    // Process and deduplicate
    const data = processAndDeduplicateCards(cardsBySet, sets);

    // Ensure data directory exists
    const dataDir = join(process.cwd(), 'data');
    await mkdir(dataDir, { recursive: true });

    // Write to JSON file
    const outputPath = join(dataDir, 'cards.json');
    console.log(`Writing ${data.length} sets to ${outputPath}...`);

    await writeFile(
      outputPath,
      JSON.stringify(data, null, 2),
      'utf-8'
    );

    console.log('\n✓ Done!');
    console.log(`Total sets: ${data.length}`);
    console.log(`Total cards: ${data.reduce((sum, s) => sum + s.cards.length, 0)}`);
  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  }
}

scrapeAllCards();
