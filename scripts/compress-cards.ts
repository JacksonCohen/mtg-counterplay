import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { ScryfallCard } from '../lib/scryfall';

interface SetWithCards {
  set: any;
  cards: ScryfallCard[];
}

// Minimal card data - only what we actually use in the UI
interface MinimalCard {
  id: string;
  name: string;
  mana_cost: string;
  cmc: number;
  effectiveCmc?: number;
  colors: string[];
  color_identity: string[];
  keywords?: string[];
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
  card_faces?: Array<{
    name: string;
    mana_cost: string;
    image_uris?: {
      small: string;
      normal: string;
      large: string;
    };
  }>;
  isCounterspell?: boolean;
}

// Minimal set data - only essential metadata
interface MinimalSet {
  id: string;
  code: string;
  name: string;
  released_at: string;
  icon_svg_uri: string;
}

function compressCard(card: ScryfallCard): MinimalCard {
  const minimal: MinimalCard = {
    id: card.id,
    name: card.name,
    mana_cost: card.mana_cost,
    cmc: card.cmc,
    colors: card.colors,
    color_identity: card.color_identity,
  };

  // Only include optional fields if they exist
  if (card.effectiveCmc !== undefined) {
    minimal.effectiveCmc = card.effectiveCmc;
  }

  if (card.keywords && card.keywords.length > 0) {
    minimal.keywords = card.keywords;
  }

  if (card.image_uris) {
    minimal.image_uris = {
      small: card.image_uris.small,
      normal: card.image_uris.normal,
      large: card.image_uris.large,
    };
  }

  if (card.card_faces && card.card_faces.length > 0) {
    minimal.card_faces = card.card_faces.map(face => ({
      name: face.name,
      mana_cost: face.mana_cost,
      ...(face.image_uris && {
        image_uris: {
          small: face.image_uris.small,
          normal: face.image_uris.normal,
          large: face.image_uris.large,
        }
      })
    }));
  }

  if (card.isCounterspell) {
    minimal.isCounterspell = true;
  }

  return minimal;
}

function compressSet(set: any): MinimalSet {
  return {
    id: set.id,
    code: set.code,
    name: set.name,
    released_at: set.released_at,
    icon_svg_uri: set.icon_svg_uri,
  };
}

async function compressCardsData() {
  console.log('Reading cards.json...');
  const cardsPath = join(process.cwd(), 'data', 'cards.json');
  const content = await readFile(cardsPath, 'utf-8');
  const data: SetWithCards[] = JSON.parse(content);

  console.log(`Found ${data.length} sets`);
  console.log(`Original size: ${(content.length / 1024 / 1024).toFixed(2)} MB`);

  // Compress the data
  const compressed = data.map(({ set, cards }) => ({
    set: compressSet(set),
    cards: cards.map(compressCard)
  }));

  // Write compressed version
  const outputPath = join(process.cwd(), 'data', 'cards-compressed.json');
  const compressedContent = JSON.stringify(compressed);

  await writeFile(outputPath, compressedContent, 'utf-8');

  console.log(`Compressed size: ${(compressedContent.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Reduction: ${(((content.length - compressedContent.length) / content.length) * 100).toFixed(1)}%`);
  console.log(`\nWrote compressed data to ${outputPath}`);

  // Also write a pretty-printed version for inspection
  const prettyPath = join(process.cwd(), 'data', 'cards-compressed-pretty.json');
  await writeFile(prettyPath, JSON.stringify(compressed, null, 2), 'utf-8');
  console.log(`Also wrote pretty version to ${prettyPath}`);
}

compressCardsData().catch(console.error);
