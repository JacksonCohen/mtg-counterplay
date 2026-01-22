export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="size-9 rounded-md bg-secondary animate-pulse" />
              <div className="h-8 w-48 rounded bg-secondary animate-pulse" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:block w-64 h-9 rounded bg-secondary animate-pulse" />
              <div className="size-9 rounded bg-secondary animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-488/680 rounded-lg bg-secondary animate-pulse"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
