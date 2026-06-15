"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import type { ScryfallCard } from "@/lib/scryfall";
import { getCardImageUrl, getOracleText } from "@/lib/scryfall";
import { ManaCost } from "./mana-symbol";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface Printing {
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
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [printings, setPrintings] = useState<Printing[]>([]);
  const [currentPrintingIndex, setCurrentPrintingIndex] = useState(0);
  const [loadingPrintings, setLoadingPrintings] = useState(false);

  // Fetch printings when card changes
  useEffect(() => {
    if (!card?.oracle_id) {
      setPrintings([]);
      setCurrentPrintingIndex(0);
      return;
    }

    setLoadingPrintings(true);
    fetch(`/api/printings/${card.oracle_id}`)
      .then(res => res.json())
      .then(data => {
        if (data.printings) {
          setPrintings(data.printings);
          // Find the index of the current card in printings
          const currentIndex = data.printings.findIndex((p: Printing) => p.id === card.id);
          setCurrentPrintingIndex(currentIndex >= 0 ? currentIndex : 0);
        }
      })
      .catch(err => {
        console.error('Failed to fetch printings:', err);
        setPrintings([]);
      })
      .finally(() => setLoadingPrintings(false));
  }, [card?.oracle_id, card?.id]);

  useEffect(() => {
    if (card) {
      const newImageUrl = getCardImageUrl(card, "large");
      if (newImageUrl !== currentImageUrl) {
        setImageLoading(true);
        setCurrentImageUrl(newImageUrl);
      }
    }
  }, [card, currentImageUrl]);

  // Handle 3D card tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Use requestAnimationFrame to throttle updates to display refresh rate
    requestAnimationFrame(() => {
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      setRotation({ x: rotateX, y: rotateY });
    });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  // Handle printing navigation
  const navigatePrinting = (direction: 'next' | 'prev') => {
    if (printings.length === 0) return;

    setCurrentPrintingIndex((prevIndex) => {
      if (direction === 'next') {
        return prevIndex < printings.length - 1 ? prevIndex + 1 : 0;
      } else {
        return prevIndex > 0 ? prevIndex - 1 : printings.length - 1;
      }
    });
  };

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

  // Get current printing or fall back to original card
  const currentPrinting = printings.length > 0 ? printings[currentPrintingIndex] : null;
  const displayImageUrl = currentPrinting
    ? (currentPrinting.image_uris?.large || currentPrinting.card_faces?.[0]?.image_uris?.large || imageUrl)
    : imageUrl;

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
          <div className="relative flex flex-col gap-3">
            <div
              style={{ perspective: "1000px" }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <div
                className="relative aspect-488/680 rounded-lg overflow-hidden bg-secondary transition-transform duration-100 ease-out"
                style={{
                  transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                  transformStyle: "preserve-3d",
                }}
              >
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-full bg-secondary animate-pulse" />
                  </div>
                )}
                {displayImageUrl && (
                  <img
                    src={displayImageUrl}
                    alt={card.name}
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${imageLoading ? "opacity-0" : "opacity-100"}`}
                    onLoad={() => setImageLoading(false)}
                  />
                )}
              </div>
            </div>

            {/* Printing Navigation */}
            {printings.length > 1 && (
              <div className="flex items-center justify-between gap-2 bg-secondary/50 rounded-lg p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigatePrinting('prev')}
                  disabled={loadingPrintings}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex-1 text-center">
                  <div className="text-xs">
                    Printing {currentPrintingIndex + 1} of {printings.length}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigatePrinting('next')}
                  disabled={loadingPrintings}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
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
