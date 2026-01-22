"use client";

import type { ScryfallSet, ScryfallCard } from "@/lib/scryfall";
import Link from "next/link";
import Image from "next/image";
import { SetViewContent } from "./set-view-content";
import { SetSearch } from "@/components/set-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

interface SetPageClientProps {
  set: ScryfallSet;
  sets: ScryfallSet[];
  cards: ScryfallCard[];
}

export function SetPageClient({ set, sets, cards }: SetPageClientProps) {
  return (
    <>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="container px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                  <Link href="/">
                    <ArrowLeft className="size-5" />
                    <span className="sr-only">Back to sets</span>
                  </Link>
                </Button>
                <div className="flex items-center gap-3 min-w-0">
                  <Image
                    src={set.icon_svg_uri || "/placeholder.svg"}
                    alt={`${set.name} set symbol`}
                    width={32}
                    height={32}
                    className="size-8 object-contain shrink-0 invert light:invert-0"
                  />
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold text-foreground truncate">
                      {set.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {cards.length} card{cards.length !== 1 ? "s" : ""} found
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden md:block">
                  <SetSearch sets={sets} currentSetCode={set.code} />
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        <main className="container px-4 py-8">
          <Suspense fallback={<LoadingSkeleton />}>
            <SetViewContent cards={cards} />
          </Suspense>
        </main>
      </div>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="aspect-488/680 rounded-lg bg-secondary animate-pulse"
        />
      ))}
    </div>
  );
}
