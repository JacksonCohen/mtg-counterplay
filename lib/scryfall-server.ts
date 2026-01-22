import 'server-only';
import type { ScryfallCard, ScryfallListResponse, ScryfallSet } from './scryfall';

export async function fetchSets(): Promise<ScryfallSet[]> {
  "use cache";
  
  const response = await fetch('https://api.scryfall.com/sets', {
    next: { revalidate: 86400 } // Cache for 24 hours
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch sets');
  }
  
  const data: ScryfallListResponse<ScryfallSet> = await response.json();
  
  // Filter to expansion, core, masters, draft_innovation sets (main playable sets)
  const validTypes = ['expansion', 'core', 'masters', 'draft_innovation', 'commander', 'funny'];
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
    const response = await fetch(url, {
      next: { revalidate: 86400 } // Cache for 24 hours
    });

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

  // Fetch counterspells separately to mark them
  const counterspellIds = await fetchCounterspellIds(setCode);

  // Mark cards that are counterspells
  return allCards.map(card => ({
    ...card,
    isCounterspell: counterspellIds.has(card.id)
  }));
}

async function fetchCounterspellIds(setCode: string): Promise<Set<string>> {
  "use cache";

  const query = encodeURIComponent(`set:${setCode} (type:instant OR keyword:flash) oracletag:counterspell`);
  const ids = new Set<string>();
  let url: string | null = `https://api.scryfall.com/cards/search?q=${query}`;

  while (url) {
    const response = await fetch(url, {
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No counterspells in this set
        return ids;
      }
      throw new Error('Failed to fetch counterspells');
    }

    const data: ScryfallListResponse<ScryfallCard> = await response.json();
    data.data.forEach(card => ids.add(card.id));
    url = data.has_more ? data.next_page ?? null : null;
  }

  return ids;
}

