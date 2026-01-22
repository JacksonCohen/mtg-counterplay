"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ScryfallCard } from "@/lib/scryfall";
import { getCardColors, getCardImageUrl } from "@/lib/scryfall";
import { CardGrid } from "@/components/card-grid";
import { FilterSidebar, type FilterState } from "@/components/filter-sidebar";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, Info } from "lucide-react";

interface SetViewContentProps {
  cards: ScryfallCard[];
}

function parseFiltersFromUrl(searchParams: URLSearchParams): FilterState {
  const colors = searchParams.get("colors")?.split(",").filter(Boolean) || [];
  const manaValues = searchParams.get("mv")?.split(",").map(Number).filter(n => !Number.isNaN(n)) || [];
  const counterOnly = searchParams.get("counter") === "true";
  const manaInput = searchParams.get("mana") || "";

  return { colors, manaValues, counterOnly, manaInput };
}

function filtersToUrl(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.colors.length > 0) {
    params.set("colors", filters.colors.join(","));
  }
  if (filters.manaValues.length > 0) {
    params.set("mv", filters.manaValues.sort((a, b) => a - b).join(","));
  }
  if (filters.counterOnly) {
    params.set("counter", "true");
  }
  if (filters.manaInput.trim() !== "") {
    params.set("mana", filters.manaInput);
  }
  return params.toString();
}

export function SetViewContent({ cards }: SetViewContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() =>
    parseFiltersFromUrl(searchParams)
  );
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const queryString = filtersToUrl(filters);
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [filters, pathname, router]);

  // Clear filters when leaving the page
  useEffect(() => {
    return () => {
      setFilters({ colors: [], manaValues: [], counterOnly: false, manaInput: "" });
    };
  }, []);

  // Apply filters to cards
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // Color filter
      if (filters.colors.length > 0) {
        const cardColors = getCardColors(card);
        const hasMatchingColor = filters.colors.some((color) => {
          if (color === "C") {
            return cardColors.length === 0 || cardColors.includes("C") || cardColors.every(c => c === "C");
          }
          return cardColors.includes(color);
        });
        if (!hasMatchingColor) return false;
      }

      // Mana value filter (checkbox style - show cards matching ANY selected mv)
      if (filters.manaValues.length > 0) {
        const cardMv = Math.floor(card.cmc);
        // 10 represents "10+"
        const matches = filters.manaValues.some(mv =>
          mv === 10 ? cardMv >= 10 : cardMv === mv
        );
        if (!matches) return false;
      }

      // Counterspell filter (using Scryfall tags)
      if (filters.counterOnly) {
        if (!card.isCounterspell) return false;
      }

      return true;
    });
  }, [cards, filters]);

  // Detect convoke cards that might be castable but are filtered out
  const convokeCardsFiltered = useMemo(() => {
    // Only show convoke warning if we have filters active
    const hasFilters = filters.colors.length > 0 || filters.manaValues.length > 0 || filters.counterOnly;
    if (!hasFilters) return [];

    // Create a Set of filtered card IDs for fast lookup
    const filteredCardIds = new Set(filteredCards.map(c => c.id));

    return cards.filter((card) => {
      // Skip if card is already in filtered results
      if (filteredCardIds.has(card.id)) return false;

      // Check if card has convoke
      const hasConvoke = card.keywords?.some(k => k.toLowerCase() === "convoke");
      if (!hasConvoke) return false;

      // Check if it matches color filters (if active)
      if (filters.colors.length > 0) {
        const cardColors = getCardColors(card);
        const hasMatchingColor = filters.colors.some((color) => {
          if (color === "C") {
            return cardColors.length === 0 || cardColors.includes("C") || cardColors.every(c => c === "C");
          }
          return cardColors.includes(color);
        });
        if (!hasMatchingColor) return false;
      }

      // Check if it matches counterspell filter (if active)
      if (filters.counterOnly && !card.isCounterspell) return false;

      // Show all convoke cards that match filters but aren't already displayed
      return true;
    });
  }, [cards, filters, filteredCards]);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const hasActiveFilters = filters.colors.length > 0 || filters.manaValues.length > 0 || filters.counterOnly;

  return (
    <>
      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 p-4 rounded-lg bg-card border border-border">
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              totalCards={cards.length}
              filteredCount={filteredCards.length}
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Convoke warning */}
          {convokeCardsFiltered.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Alert className="mb-4 cursor-pointer hover:bg-accent/50 transition-colors group">
                  <Info className="h-4 w-4 group-hover:text-foreground transition-colors" />
                  <AlertDescription className="group-hover:text-foreground transition-colors">
                    {convokeCardsFiltered.length} card{convokeCardsFiltered.length !== 1 ? 's' : ''} with Convoke {convokeCardsFiltered.length !== 1 ? 'are' : 'is'} not shown but may be castable with creatures on the battlefield. Click to view.
                  </AlertDescription>
                </Alert>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[600px] max-w-[90vw]">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Cards with Convoke</h4>
                  <div className="grid grid-cols-3 gap-2 max-h-[70vh] overflow-y-auto pr-2">
                    {convokeCardsFiltered.map((card) => (
                      <div
                        key={card.id}
                        className="overflow-hidden rounded-lg transition-all"
                      >
                        <img
                          src={getCardImageUrl(card, 'normal')}
                          alt={card.name}
                          className="w-full h-auto object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Mobile filter button */}
          <div className="lg:hidden mb-4">
            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="bg-transparent">
                  <Filter className="mr-2 size-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-primary text-primary-foreground">
                      {filters.colors.length + filters.manaValues.length + (filters.counterOnly ? 1 : 0)}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-card">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <FilterSidebar
                    filters={filters}
                    onChange={handleFilterChange}
                    totalCards={cards.length}
                    filteredCount={filteredCards.length}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <CardGrid cards={filteredCards} />
        </div>
      </div>

      <ScrollToTop />
    </>
  );
}
