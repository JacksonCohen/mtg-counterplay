"use client";

import type { ScryfallSet } from "@/lib/scryfall";
import Image from "next/image";

interface SetSymbolProps {
  set: ScryfallSet;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showName?: boolean;
}

const SIZE_CLASSES = {
  xs: "size-5",
  sm: "size-7",
  md: "size-10",
  lg: "size-14",
  xl: "size-20",
};

export function SetSymbol({ set, size = "md", showName = false }: SetSymbolProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${SIZE_CLASSES[size]} flex items-center justify-center`}
        style={{
          filter: "drop-shadow(0 0 4px rgba(45, 212, 191, 0.3))",
        }}
      >
        <Image
          width={32}
          height={32}
          src={set.icon_svg_uri || "/placeholder.svg"}
          alt={`${set.name} set symbol`}
          className="size-full object-contain opacity-90 dark:invert"
        />
      </div>
      {showName && (
        <span className="text-sm text-muted-foreground text-center line-clamp-2">
          {set.name}
        </span>
      )}
    </div>
  );
}
