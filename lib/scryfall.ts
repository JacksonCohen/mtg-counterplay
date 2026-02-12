// Scryfall API utilities for MTG card data

export interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at: string;
  card_count: number;
  icon_svg_uri: string;
  scryfall_uri: string;
}

export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost: string;
  cmc: number;
  type_line: string;
  oracle_text: string;
  colors: string[];
  color_identity: string[];
  keywords?: string[];
  rarity: string;
  set: string;
  set_name: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    art_crop: string;
  };
  card_faces?: Array<{
    name: string;
    mana_cost: string;
    oracle_text: string;
    image_uris?: {
      small: string;
      normal: string;
      large: string;
      art_crop: string;
    };
  }>;
  scryfall_uri: string;
  legalities: Record<string, string>;
  // Marked as counterspell by Scryfall tags
  isCounterspell?: boolean;
}

export interface ScryfallListResponse<T> {
  object: string;
  total_cards?: number;
  has_more: boolean;
  next_page?: string;
  data: T[];
}


// Get card image URL with fallback for double-faced cards
export function getCardImageUrl(card: ScryfallCard, size: 'small' | 'normal' | 'large' = 'normal'): string {
  if (card.image_uris) {
    return card.image_uris[size];
  }
  if (card.card_faces && card.card_faces[0]?.image_uris) {
    return card.card_faces[0].image_uris[size];
  }
  return '';
}

// Get full oracle text for double-faced cards
export function getOracleText(card: ScryfallCard): string {
  if (card.oracle_text) {
    return card.oracle_text;
  }
  if (card.card_faces) {
    return card.card_faces.map(face => face.oracle_text).join('\n\n// \n\n');
  }
  return '';
}

// Parse mana symbols from mana cost string
export function parseManaSymbols(manaCost: string): string[] {
  const matches = manaCost.match(/\{[^}]+\}/g);
  return matches || [];
}

// Get colors from a card
export function getCardColors(card: ScryfallCard): string[] {
  if (card.colors && card.colors.length > 0) {
    return card.colors;
  }
  if (card.color_identity && card.color_identity.length > 0) {
    return card.color_identity;
  }
  return ['C']; // Colorless
}

// Get the number of Phyrexian mana symbols in a card's cost
export function countPhyrexianMana(card: ScryfallCard): number {
  // Get mana cost - handle double-faced cards
  let manaCost = card.mana_cost;
  if (!manaCost && card.card_faces && card.card_faces[0]) {
    manaCost = card.card_faces[0].mana_cost;
  }
  if (!manaCost) return 0;

  // Parse mana symbols from the cost
  const symbols = parseManaSymbols(manaCost);
  let phyrexianCount = 0;

  for (const symbol of symbols) {
    const symbolContent = symbol.slice(1, -1); // Remove { }
    // Phyrexian mana ends with /P (e.g., {W/P}, {U/P}, {B/P}, {R/P}, {G/P})
    if (symbolContent.includes('/P')) {
      phyrexianCount++;
    }
  }

  return phyrexianCount;
}

// Check if a card matches a given mana value, accounting for Phyrexian mana
// Phyrexian mana can be paid with life, so a card with {1}{B/P} (CMC 2) can be cast for 0, 1, or 2 mana
export function cardMatchesManaValue(card: ScryfallCard, targetManaValue: number): boolean {
  const cmc = Math.floor(card.cmc);
  const phyrexianCount = countPhyrexianMana(card);

  // The minimum mana needed is CMC minus all Phyrexian symbols (pay life for all)
  const minMana = cmc - phyrexianCount;
  // The maximum mana needed is the full CMC (pay mana for all)
  const maxMana = cmc;

  // For "10+" filter, we want cards with CMC >= 10
  if (targetManaValue === 10) {
    return cmc >= 10;
  }

  // Card matches if the target mana value is within the range [minMana, maxMana]
  return targetManaValue >= minMana && targetManaValue <= maxMana;
}

// Check if a card is castable with the given available colors
// Handles hybrid mana properly - card is castable if you can pay for ALL pips
export function isCardCastableWithColors(card: ScryfallCard, availableColors: string[]): boolean {
  // Get mana cost - handle double-faced cards
  let manaCost = card.mana_cost;
  if (!manaCost && card.card_faces && card.card_faces[0]) {
    manaCost = card.card_faces[0].mana_cost;
  }
  if (!manaCost) return true; // No mana cost means it's castable

  // Parse mana symbols from the cost
  const symbols = parseManaSymbols(manaCost);

  // Check each mana symbol
  for (const symbol of symbols) {
    const symbolContent = symbol.slice(1, -1); // Remove { }

    // Ignore colorless/generic mana (numbers, X, etc.)
    if (/^\d+$/.test(symbolContent) || symbolContent === 'X') {
      continue;
    }

    // Handle hybrid mana (e.g., {G/W}, {2/G}, {G/P})
    if (symbolContent.includes('/')) {
      const parts = symbolContent.split('/');
      // For hybrid, at least ONE of the colors must be available
      const colorParts = parts.filter(p => /^[WUBRG]$/.test(p));

      if (colorParts.length > 0) {
        const canPayHybrid = colorParts.some(color => availableColors.includes(color));
        if (!canPayHybrid) return false;
      }
      // If it's something like {2/G}, the G option means it needs G to use that option
      // but the 2 option is always payable, so we consider it payable
      continue;
    }

    // Handle Phyrexian mana (e.g., {G/P})
    if (symbolContent.endsWith('P')) {
      const color = symbolContent.slice(0, -2);
      if (/^[WUBRG]$/.test(color)) {
        // Phyrexian can be paid with life, so it's always technically castable
        // But if they have the color, that's even better
        continue;
      }
    }

    // Regular single color (W, U, B, R, G)
    if (/^[WUBRG]$/.test(symbolContent)) {
      if (!availableColors.includes(symbolContent)) {
        return false;
      }
    }
  }

  return true;
}
