export default function BookingsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="h-11 animate-pulse border-b border-slate-200 bg-slate-50" />
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-slate-100 px-4 py-4">
            <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
            <div className="h-5 flex-1 animate-pulse rounded bg-slate-100" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
