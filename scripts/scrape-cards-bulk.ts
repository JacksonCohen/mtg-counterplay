import { writeFile, mkdir } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import * as JSONStream from 'JSONStream';
import type { ScryfallSet, ScryfallCard, ScryfallListResponse } from '../lib/scryfall';

interface SetWithCards {
  set: ScryfallSet;
  cards: ScryfallCard[];
}


interface BulkCard extends ScryfallCard {
  oracle_id?: string;
  oracle_tags?: string[];
  promo_types?: string[];
  frame_effects?: string[];
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
  console.log('Fetching sets list...');
  const response = await fetch('https://api.scryfall.com/sets');

  if (!response.ok) {
    throw new Error('Failed to fetch sets');
  }

  const data: ScryfallListResponse<ScryfallSet> = await response.json();

  const validTypes = ['expansion', 'core', 'masters', 'draft_innovation', 'funny'];
  return data.data
    .filter(set => validTypes.includes(set.set_type) && set.card_count > 0)
    .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime());
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
  localPath: string,
  validSetCodes: Set<string>
): Promise<Map<string, BulkCard[]>> {
  console.log(`Reading bulk data from ${localPath}...`);

  const cardsBySet = new Map<string, BulkCard[]>();
  let totalProcessed = 0;
  let totalMatched = 0;

  const readable = createReadStream(localPath);

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

    // Deduplicate by oracle_id, preferring non-alternate-art printings
    const uniqueCards = new Map<string, ScryfallCard>();
    for (const card of cards) {
      const key = card.oracle_id || card.id;
      const isAlternate = card.promo_types?.length || card.frame_effects?.some(
        e => ['showcase', 'extendedart', 'inverted', 'etched', 'gilded', 'textured', 'serialized'].includes(e)
      );

      if (!uniqueCards.has(key) || isAlternate === false) {
        // Check oracle tags for counterspell markers
        const oracleTags = card.oracle_tags || [];
        const isCounterspell = oracleTags.includes('counterspell') || oracleTags.includes('counterspell-free');
        const isCounterspellFree = oracleTags.includes('counterspell-free');

        // Handle manual cost override
        const manualCost = (card as any)._manualCost;
        const effectiveCmc = manualCost ? calculateManualCost(manualCost) : undefined;

        uniqueCards.set(key, {
          ...card,
          isCounterspell,
          isCounterspellFree,
          effectiveCmc,
          mana_cost: manualCost || card.mana_cost,
        });
      }
    }

    if (uniqueCards.size > 0) {
      result.push({
        set,
        cards: Array.from(uniqueCards.values()),
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

    // Stream and filter cards from local bulk data file
    const bulkDataPath = join(process.cwd(), 'data', 'bulk-cards.json');
    const cardsBySet = await streamAndFilterCards(bulkDataPath, validSetCodes);

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
