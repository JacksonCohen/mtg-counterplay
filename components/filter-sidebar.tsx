"use client";

import { useCallback, useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseManaString, isValidManaString } from "@/lib/mana-parser";

export interface FilterState {
  colors: string[];
  manaValues: number[];
  counterOnly: boolean;
  manaInput: string;
}

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCards: number;
  filteredCount: number;
}

const MTG_COLORS = [
  { code: "W", name: "White" },
  { code: "U", name: "Blue" },
  { code: "B", name: "Black" },
  { code: "R", name: "Red" },
  { code: "G", name: "Green" },
  { code: "C", name: "Colorless" },
];

const MANA_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function FilterSidebar({ filters, onChange, totalCards, filteredCount }: FilterSidebarProps) {
  const [localManaInput, setLocalManaInput] = useState(filters.manaInput);

  // Sync local input with external filter changes (e.g., clear filters button)
  useEffect(() => {
    setLocalManaInput(filters.manaInput);
  }, [filters.manaInput]);

  const toggleColor = useCallback(
    (colorCode: string) => {
      const newColors = filters.colors.includes(colorCode)
        ? filters.colors.filter((c) => c !== colorCode)
        : [...filters.colors, colorCode];
      onChange({ ...filters, colors: newColors });
    },
    [filters, onChange]
  );

  const toggleManaValue = useCallback(
    (mv: number) => {
      const newManaValues = filters.manaValues.includes(mv)
        ? filters.manaValues.filter((v) => v !== mv)
        : [...filters.manaValues, mv];
      onChange({ ...filters, manaValues: newManaValues });
    },
    [filters, onChange]
  );

  const toggleCounterOnly = useCallback(
    (checked: boolean) => {
      onChange({ ...filters, counterOnly: checked });
    },
    [filters, onChange]
  );


  const clearFilters = useCallback(() => {
    setLocalManaInput("");
    onChange({
      colors: [],
      manaValues: [],
      counterOnly: false,
      manaInput: "",
    });
  }, [onChange]);

  // Debounced mana input handler
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localManaInput !== filters.manaInput) {
        const parsed = parseManaString(localManaInput);
        onChange({
          ...filters,
          manaInput: localManaInput,
          colors: parsed.colors,
          manaValues: parsed.manaValues,
        });
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
    // Only depend on localManaInput to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localManaInput]);

  const hasActiveFilters = filters.colors.length > 0 || filters.manaValues.length > 0 || filters.counterOnly || filters.manaInput.trim() !== "";

  return (
    <div className="space-y-5 px-4">
      {/* Results count */}
      <div className="h-7 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filteredCount}</span> of{" "}
          <span className="font-semibold text-foreground">{totalCards}</span>
        </p>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-primary h-7 px-2 hover:bg-transparent hover:text-foreground cursor-pointer">
            Clear
          </Button>
        )}
      </div>

      {/* Color Filter with MTG Symbols */}
      <div>
        <Label className="text-xs font-semibold mb-2 block text-muted-foreground uppercase tracking-wide">Colors</Label>
        <div className="flex gap-1">
          {MTG_COLORS.map((color) => {
            const isSelected = filters.colors.includes(color.code);
            return (
              <button
                key={color.code}
                type="button"
                onClick={() => toggleColor(color.code)}
                className={cn(
                  "p-0.5 flex items-center justify-center transition-all duration-150 m-auto cursor-pointer",
                  isSelected
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110"
                    : "opacity-50 hover:opacity-100"
                )}
                title={color.name}
              >
                <Image
                  width={24}
                  height={24}
                  src={`/mana/${color.code}.svg`}
                  alt={color.name}
                  unoptimized
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Mana Value Filter with Checkboxes */}
      <div>
        <Label className="text-xs font-semibold mb-2 block text-muted-foreground uppercase tracking-wide">Mana Value</Label>
        <div className="grid grid-cols-6 gap-1">
          {MANA_VALUES.map((mv) => {
            const isSelected = filters.manaValues.includes(mv);
            const label = mv === 10 ? "10+" : mv.toString();
            return (
              <label
                key={mv}
                className={cn(
                  "flex items-center justify-center h-8 rounded cursor-pointer text-xs font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleManaValue(mv)}
                  className="sr-only"
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>

      {/* Mana Input */}
      <div>
        <Label htmlFor="mana-input" className="text-xs font-semibold mb-2 block text-muted-foreground uppercase tracking-wide">
          Available Mana
        </Label>
        <Input
          id="mana-input"
          type="text"
          placeholder="e.g., UUB or island island swamp"
          value={localManaInput}
          onChange={(e) => setLocalManaInput(e.target.value)}
          className={cn(
            "text-sm border-foreground/30",
            localManaInput && !isValidManaString(localManaInput) && "border-destructive focus-visible:ring-destructive"
          )}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Enter available mana (e.g., UUB, island island swamp, or blue blue black)
        </p>
      </div>

      {/* Counterspells Only Toggle */}
      <div className="flex items-center justify-between py-2">
        <Label htmlFor="counter-toggle" className="text-xs font-semibold cursor-pointer text-muted-foreground uppercase tracking-wide">
          Counterspells Only
        </Label>
        <Switch
          id="counter-toggle"
          checked={filters.counterOnly}
          onCheckedChange={toggleCounterOnly}
        />
      </div>
    </div>
  );
}
