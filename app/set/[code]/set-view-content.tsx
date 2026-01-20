"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ScryfallCard } from "@/lib/scryfall";
import { getCardColors, getOracleText, isCounterspell } from "@/lib/scryfall";
import { CardGrid } from "@/components/card-grid";
import { FilterSidebar, type FilterState } from "@/components/filter-sidebar";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter } from "lucide-react";

interface SetViewContentProps {
  cards: ScryfallCard[];
}

function parseFiltersFromUrl(searchParams: URLSearchParams): FilterState {
  const colors = searchParams.get("colors")?.split(",").filter(Boolean) || [];
  const manaValues = searchParams.get("mv")?.split(",").map(Number).filter(n => !Number.isNaN(n)) || [];
  const counterOnly = searchParams.get("counter") === "true";

  return { colors, manaValues, counterOnly };
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

      // Counter-like filter
      if (filters.counterOnly) {
        const oracleText = getOracleText(card);
        if (!isCounterspell(oracleText)) return false;
      }

      return true;
    });
  }, [cards, filters]);

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
                    onChange={(newFilters) => {
                      handleFilterChange(newFilters);
                      setMobileFilterOpen(false);
                    }}
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
