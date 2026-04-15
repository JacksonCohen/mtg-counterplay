"use cache";

import { Suspense } from "react";
import { fetchSets } from "@/lib/scryfall-compressed";
import { HomeLayout } from "@/components/home-layout";

export default async function HomePage() {
  const sets = await fetchSets();

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<SetGridSkeleton />}>
        <HomeLayout sets={sets} />
      </Suspense>

      <footer className="border-t border-border py-8 mt-16">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground">
            Card data provided by{" "}
            <a
              href="https://scryfall.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Scryfall
            </a>
            . Not affiliated with Wizards of the Coast.
          </p>
        </div>
      </footer>
    </div>
  );
}

function SetGridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="max-w-md mx-auto h-10 bg-secondary rounded-lg animate-pulse" />
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
        {Array.from({ length: 36 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center p-2 rounded-lg bg-card"
          >
            <div className="size-8 bg-secondary rounded-full animate-pulse" />
            <div className="mt-1.5 w-full">
              <div className="h-3 bg-secondary rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
