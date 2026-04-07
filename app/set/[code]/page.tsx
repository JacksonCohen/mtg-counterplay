import { notFound } from "next/navigation";
import { fetchSets, fetchInstantsFromSet } from "@/lib/scryfall-server";
import { SetPageClient } from "./set-page-client";

interface SetPageProps {
  params: Promise<{ code: string }>;
}

// Pre-generate static pages for the 10 most recent sets
export async function generateStaticParams() {
  const sets = await fetchSets();

  // Generate static pages for the 10 most recent sets
  // Older sets will be generated on-demand with ISR
  // Revalidation is handled by fetch() calls with 7-day cache duration
  return sets.slice(0, 10).map((set) => ({
    code: set.code.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: SetPageProps) {
  const { code } = await params;
  const sets = await fetchSets();
  const set = sets.find((s) => s.code.toLowerCase() === code.toLowerCase());

  if (!set) {
    return {
      title: "Set Not Found - MTG Counterplay Reference",
    };
  }

  return {
    title: `${set.name} Instant-Speed Cards - MTG Counterplay Reference`,
    description: `Browse all instant-speed cards, counterspells, flash creatures, and interaction from ${set.name} (${set.code.toUpperCase()})`,
  };
}

export default async function SetPage({ params }: SetPageProps) {
  const { code } = await params;
  const [sets, cards] = await Promise.all([
    fetchSets(),
    fetchInstantsFromSet(code),
  ]);

  const set = sets.find((s) => s.code.toLowerCase() === code.toLowerCase());

  if (!set) {
    notFound();
  }

  return <SetPageClient set={set} sets={sets} cards={cards} />;
}
