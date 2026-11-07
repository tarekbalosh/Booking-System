import type { SeriesPoint } from "@/server/services/admin-stats";

/** Server-rendered bar chart (inline SVG, no dependencies). */
export function BarChart({
  points,
  field,
  label,
  formatKey,
}: {
  points: SeriesPoint[];
  field: "bookings" | "revenue";
  label: string;
  formatKey: (key: string) => string;
}) {
  const values = points.map((point) => point[field]);
  const max = Math.max(1, ...values);
  const width = 600;
  const height = 160;
  const gap = 4;
  const barWidth = Math.max(2, (width - gap * (points.length - 1)) / points.length);
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height + 22}`}
        role="img"
        aria-label={label}
        className="h-auto w-full"
      >
        {points.map((point, index) => {
          const value = point[field];
          const barHeight = value === 0 ? 1 : Math.max(2, (value / max) * height);
          const x = index * (barWidth + gap);
          return (
            <g key={point.key}>
              <title>{`${formatKey(point.key)}: ${value}`}</title>
              <rect
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx={2}
                className={value === 0 ? "fill-slate-200" : "fill-brand-600"}
              />
              {index % labelEvery === 0 && (
                <text x={x} y={height + 16} className="fill-slate-500" fontSize="10">
                  {formatKey(point.key)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

/** Horizontal ranked bars. */
export function RankedBars({
  rows,
  emptyLabel,
}: {
  rows: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex justify-between text-sm">
            <span className="truncate text-slate-700">{row.label}</span>
            <span className="font-semibold text-slate-900">{row.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-brand-600"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Stacked proportion bar with legend for status distribution. */
export function DistributionBar({
  segments,
}: {
  segments: Array<{ label: string; count: number; color: string }>;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  return (
    <div>
      <div
        className="flex h-3 overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.count}`).join(", ")}
      >
        {segments
          .filter((segment) => segment.count > 0)
          .map((segment) => (
            <div
              key={segment.label}
              className={segment.color}
              style={{ width: `${(segment.count / Math.max(1, total)) * 100}%` }}
            />
          ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-slate-700">
              <span className={`h-2.5 w-2.5 rounded-full ${segment.color}`} aria-hidden="true" />
              {segment.label}
            </span>
            <span className="font-semibold text-slate-900">
              {segment.count}
              <span className="ms-1 text-xs font-normal text-slate-500">
                {total ? Math.round((segment.count / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

