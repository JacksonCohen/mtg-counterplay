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
