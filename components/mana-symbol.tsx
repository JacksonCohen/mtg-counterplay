"use client";

import Image from "next/image";

interface ManaSymbolProps {
  symbol: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

/**
 * Converts a mana symbol to its SVG filename.
 * Examples:
 *   {W} -> W.svg
 *   {2} -> 2.svg
 *   {U/B} -> UB.svg
 *   {W/P} -> WP.svg (Phyrexian white)
 *   {G/U} -> GU.svg (Hybrid green/blue)
 */
function getManaSvgPath(symbol: string): string {
  // Remove braces from symbol like {W} -> W
  const cleanSymbol = symbol.replace(/[{}]/g, "");

  // Handle hybrid mana (e.g., "W/U" -> "WU.svg")
  if (cleanSymbol.includes("/")) {
    const parts = cleanSymbol.split("/");
    // Join without slash for filename (W/U -> WU, W/P -> WP)
    return `/mana/${parts.join("")}.svg`;
  }

  // Handle everything else (numbers, X, colors, colorless)
  return `/mana/${cleanSymbol}.svg`;
}

export function ManaSymbol({ symbol, size = "md" }: ManaSymbolProps) {
  const svgPath = getManaSvgPath(symbol);
  const cleanSymbol = symbol.replace(/[{}]/g, "");

  return (
    <span
      className={`inline-flex items-center justify-center ${SIZE_CLASSES[size]}`}
      title={cleanSymbol}
    >
      <Image
        src={svgPath}
        alt={cleanSymbol}
        width={24}
        height={24}
        className="size-full object-contain"
        unoptimized
      />
    </span>
  );
}

interface ManaCostProps {
  cost: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Converts a plain mana cost string into the Scryfall format with curly braces.
 * Examples:
 *   "WUBRG" -> "{W}{U}{B}{R}{G}"
 *   "2UU" -> "{2}{U}{U}"
 *   "3RG" -> "{3}{R}{G}"
 *   "XUU" -> "{X}{U}{U}"
 */
export function formatManaCost(plainCost: string): string {
  if (!plainCost) return "";

  // If already formatted with curly braces, return as-is
  if (plainCost.includes("{")) return plainCost;

  const formatted: string[] = [];
  let i = 0;

  while (i < plainCost.length) {
    const char = plainCost[i];

    // Check for multi-digit numbers
    if (/\d/.test(char)) {
      let number = char;
      while (i + 1 < plainCost.length && /\d/.test(plainCost[i + 1])) {
        i++;
        number += plainCost[i];
      }
      formatted.push(`{${number}}`);
    }
    // Check for X
    else if (char === "X") {
      formatted.push("{X}");
    }
    // Check for mana symbols (W, U, B, R, G, C)
    else if (/[WUBRGC]/.test(char)) {
      formatted.push(`{${char}}`);
    }
    // Check for hybrid/phyrexian notation (e.g., "W/U" or "2/W")
    else if (char === "/") {
      // Look back to get the previous symbol
      const prev = formatted.pop() || "";
      const prevClean = prev.replace(/[{}]/g, "");
      // Look ahead to get the next symbol
      i++;
      const next = plainCost[i];
      formatted.push(`{${prevClean}/${next}}`);
    }

    i++;
  }

  return formatted.join("");
}

export function ManaCost({ cost, size = "md" }: ManaCostProps) {
  if (!cost) return null;

  // Format the cost if it's not already formatted
  const formattedCost = formatManaCost(cost);
  const symbols = formattedCost.match(/\{[^}]+\}/g) || [];

  return (
    <span className="inline-flex items-center gap-0.5">
      {symbols.map((symbol, index) => (
        <ManaSymbol key={`${symbol}-${index}`} symbol={symbol} size={size} />
      ))}
    </span>
  );
}
