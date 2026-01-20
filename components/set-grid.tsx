"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ScryfallSet } from "@/lib/scryfall";
import { SetSymbol } from "./set-symbol";
import { Search, Hash, AlignLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SetGridProps {
  sets: ScryfallSet[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function SetGrid({ sets, searchQuery: externalSearchQuery, onSearchChange }: SetGridProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [showCodes, setShowCodes] = useState(false);

  // Use external search query if provided, otherwise use internal state
  const activeSearchQuery = externalSearchQuery ?? internalSearchQuery;
  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setInternalSearchQuery(value);
    }
  };

  const filteredSets = useMemo(() => {
    if (!activeSearchQuery.trim()) return sets;
    const query = activeSearchQuery.toLowerCase().trim();
    return sets.filter((set) => {
      // Exact match on code takes priority
      if (set.code.toLowerCase() === query) return true;
      // Otherwise search in name only (not code) to avoid substring matches
      return set.name.toLowerCase().includes(query);
    });
  }, [sets, activeSearchQuery]);

  // Group sets by year
  const groupedSets = useMemo(() => {
    const groups: Record<string, ScryfallSet[]> = {};
    for (const set of filteredSets) {
      const year = new Date(set.released_at).getFullYear().toString();
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(set);
    }
    // Sort sets within each year by release date (oldest first)
    for (const year in groups) {
      groups[year].sort((a, b) =>
        new Date(a.released_at).getTime() - new Date(b.released_at).getTime()
      );
    }
    return groups;
  }, [filteredSets]);

  const years = Object.keys(groupedSets).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="space-y-6">
      {/* Search and Toggle */}
      <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search sets..."
            value={activeSearchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="px-9 h-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus:ring-primary text-sm"
          />
          {activeSearchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCodes(!showCodes)}
          className="h-10 px-3 bg-secondary/50"
          title={showCodes ? "Show full names" : "Show codes"}
        >
          {showCodes ? (
            <AlignLeft className="size-4" />
          ) : (
            <Hash className="size-4" />
          )}
        </Button>
      </div>

      {/* Results count */}
      {activeSearchQuery && (
        <p className="text-center text-xs text-muted-foreground">
          Found <span className="font-semibold text-foreground">{filteredSets.length}</span> sets
        </p>
      )}

      {/* Grouped sets */}
      {years.map((year) => (
        <div key={year}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-16 bg-background/90 backdrop-blur-sm py-1.5 z-10">
            {year}
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
            {groupedSets[year].map((set) => (
              <SetTile key={set.id} set={set} showCode={showCodes} />
            ))}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {filteredSets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm font-medium text-muted-foreground">No sets found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try a different search term
          </p>
        </div>
      )}
    </div>
  );
}

interface SetTileProps {
  set: ScryfallSet;
  showCode?: boolean;
}

function SetTile({ set, showCode = false }: SetTileProps) {
  return (
    <Link
      href={`/set/${set.code}`}
      className={cn("group flex flex-col items-center p-2 rounded-lg bg-card hover:bg-secondary/50 border border-transparent hover:border-primary/30 transition-all duration-200 gap-1", showCode && "gap-2")}
      title={set.name}
    >
      <SetSymbol set={set} size="sm" />
      <p className={cn("mt-1 text-[10px] font-medium text-muted-foreground group-hover:text-primary transition-colors text-center line-clamp-2 w-full leading-tight flex h-full items-center justify-center", showCode && "uppercase text-xs")}>
        {showCode ? set.code : set.name}
      </p>
    </Link>
  );
}
