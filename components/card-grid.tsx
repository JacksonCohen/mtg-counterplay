"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ScryfallCard } from "@/lib/scryfall";
import { getCardImageUrl } from "@/lib/scryfall";

// Code split the modal - only load when needed
const CardDetailModal = dynamic(() => import("./card-detail-modal").then(mod => ({ default: mod.CardDetailModal })), {
  ssr: false,
});

interface CardGridProps {
  cards: ScryfallCard[];
}

export function CardGrid({ cards }: CardGridProps) {
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);

  const handleNavigate = (direction: "next" | "prev") => {
    if (selectedCardIndex === null) return;

    if (direction === "next") {
      setSelectedCardIndex((selectedCardIndex + 1) % cards.length);
    } else {
      setSelectedCardIndex((selectedCardIndex - 1 + cards.length) % cards.length);
    }
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <svg
          className="size-16 mb-4 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
          />
        </svg>
        <p className="text-lg font-medium">No instant cards found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  const selectedCard = selectedCardIndex !== null ? cards[selectedCardIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {cards.map((card, index) => (
          <CardTile
            key={card.id}
            card={card}
            onClick={() => setSelectedCardIndex(index)}
            isPriority={index < 24}
          />
        ))}
      </div>

      <CardDetailModal
        card={selectedCard}
        isOpen={selectedCardIndex !== null}
        onClose={() => setSelectedCardIndex(null)}
        onNavigate={handleNavigate}
        currentIndex={selectedCardIndex ?? 0}
        totalCards={cards.length}
      />
    </>
  );
}

interface CardTileProps {
  card: ScryfallCard;
  onClick: () => void;
  isPriority?: boolean;
}

function CardTile({ card, onClick, isPriority = false }: CardTileProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageUrl = getCardImageUrl(card, "normal");

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-488/680 rounded-lg overflow-hidden bg-secondary/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
    >
      {/* Loading skeleton */}
      {!imageLoaded && (
        <div className="absolute inset-0 animate-pulse bg-linear-to-br from-secondary to-muted" />
      )}

      {/* Card image - using native img to avoid Vercel image optimization costs */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={card.name}
          loading={isPriority ? "eager" : "lazy"}
          fetchPriority={isPriority ? "high" : "low"}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setImageLoaded(true)}
        />
      )}

      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-lg ring-2 ring-transparent group-hover:ring-primary/50 transition-all duration-300" />
    </button>
  );
}
