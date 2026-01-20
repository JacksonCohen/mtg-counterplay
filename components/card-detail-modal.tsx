"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { ScryfallCard } from "@/lib/scryfall";
import { getCardImageUrl, getOracleText } from "@/lib/scryfall";
import { ManaCost } from "./mana-symbol";
import { ExternalLink } from "lucide-react";

interface CardDetailModalProps {
  card: ScryfallCard | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: "next" | "prev") => void;
  currentIndex?: number;
  totalCards?: number;
}

export function CardDetailModal({
  card,
  isOpen,
  onClose,
  onNavigate,
}: CardDetailModalProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [currentImageUrl, setCurrentImageUrl] = useState("");

  useEffect(() => {
    if (card) {
      const newImageUrl = getCardImageUrl(card, "large");
      if (newImageUrl !== currentImageUrl) {
        setImageLoading(true);
        setCurrentImageUrl(newImageUrl);
      }
    }
  }, [card, currentImageUrl]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || !onNavigate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate("prev");
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onNavigate, onClose]);

  if (!card) return null;

  const imageUrl = getCardImageUrl(card, "large");
  const oracleText = getOracleText(card);

  // Check if this is a multi-faced card (adventure, split, etc.)
  const hasMultipleFaces = card.card_faces && card.card_faces.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2 flex-1">
              {hasMultipleFaces ? (
                // Display each face with its own mana cost
                <div className="flex flex-col gap-1.5">
                  {card.card_faces!.map((face, index) => (
                    <div key={index} className="flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-bold">{face.name}</span>
                      <ManaCost cost={face.mana_cost} size="md" />
                    </div>
                  ))}
                </div>
              ) : (
                // Single-faced card
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-lg font-bold">{card.name}</span>
                  <ManaCost cost={card.mana_cost} size="md" />
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Card Image */}
          <div className="relative">
            <div className="relative aspect-488/680 rounded-lg overflow-hidden bg-secondary">
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-full bg-secondary animate-pulse" />
                </div>
              )}
              {imageUrl && (
                <Image
                  src={imageUrl || "/placeholder.svg"}
                  alt={card.name}
                  fill
                  className={`object-contain transition-opacity duration-200 ${imageLoading ? "opacity-0" : "opacity-100"
                    }`}
                  sizes="(max-width: 768px) 90vw, 50vw"
                  priority
                  onLoad={() => setImageLoading(false)}
                />
              )}
            </div>

          </div>

          {/* Card Details */}
          <div className="flex flex-col gap-4">
            {/* Oracle Text */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Oracle Text</p>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{oracleText}</p>
              </div>
            </div>

            {/* Set Info */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Set</p>
              <p className="font-medium">{card.set_name}</p>
            </div>

            {/* External Link */}
            <div className="mt-auto pt-4">
              <Button asChild variant="outline" className="w-full bg-transparent">
                <a href={card.scryfall_uri} target="_blank" rel="noopener noreferrer">
                  View on Scryfall
                  <ExternalLink className="ml-2 size-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
