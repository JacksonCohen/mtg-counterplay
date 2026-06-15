import { NextRequest, NextResponse } from 'next/server';

const USER_AGENT = 'MTG-Instant-Spell-Reference/1.0';

interface PrintingCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  released_at: string;
  collector_number: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small: string;
      normal: string;
      large: string;
    };
  }>;
}

interface ScryfallResponse {
  data: PrintingCard[];
  has_more: boolean;
  next_page?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ oracle_id: string }> }
) {
  const { oracle_id } = await params;

  try {
    // Fetch all printings of this card from Scryfall
    const url = `https://api.scryfall.com/cards/search?q=oracle_id:${oracle_id}&unique=prints&order=released`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ printings: [] });
      }
      throw new Error(`Scryfall API error: ${response.status}`);
    }

    const data: ScryfallResponse = await response.json();

    // Extract just the fields we need for the UI
    const printings = data.data.map((card) => ({
      id: card.id,
      name: card.name,
      set: card.set,
      set_name: card.set_name,
      released_at: card.released_at,
      collector_number: card.collector_number,
      image_uris: card.image_uris,
      card_faces: card.card_faces,
    }));

    return NextResponse.json({ printings });
  } catch (error) {
    console.error('Error fetching printings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch printings' },
      { status: 500 }
    );
  }
}
