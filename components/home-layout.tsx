"use client";

import { useState } from "react";
import { SetGrid } from "@/components/set-grid";
import { FloatingHeaderSearch } from "@/components/floating-header-search";
import { ScrollToTop } from "@/components/scroll-to-top";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ScryfallSet } from "@/lib/scryfall";
import { Zap } from "lucide-react";

interface HomeLayoutProps {
  sets: ScryfallSet[];
}

export function HomeLayout({ sets }: HomeLayoutProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      <header className="border-b border-border bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Zap className="size-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  MTG Instant Reference
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Find counterspells & interaction fast
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FloatingHeaderSearch searchQuery={searchQuery} onSearchChange={setSearchQuery} />
              <span className="hidden md:block">
                <ThemeToggle />
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-border py-6">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Browse instant-speed interaction by set
          </h2>
          <p className="text-sm text-muted-foreground">
            {sets.length} sets available · Powered by Scryfall
          </p>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        <SetGrid sets={sets} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </main>

      <ScrollToTop />
    </>
  );
}
