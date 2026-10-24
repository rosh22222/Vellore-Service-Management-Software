import type { CSSProperties, ReactNode } from "react";

type ChartItem = {
  id?: string;
  label: string;
  value: number;
  hint?: string;
  color?: string;
};

const palette = ["var(--primary)", "var(--chart-warm)", "var(--chart-cool)", "var(--chart-success)", "var(--chart-violet)"];

function chartKey(item: ChartItem, index: number) {
  return item.id ? `${item.id}-${index}` : `${item.label}-${index}`;
}

export function HorizontalBarList({
  items,
  max,
  formatValue = (value) => value.toString(),
}: {
  items: ChartItem[];
  max?: number;
  formatValue?: (value: number) => string;
}) {
  const resolvedMax = Math.max(max ?? 0, ...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const color = item.color ?? palette[index % palette.length];
        const width = Math.max(0, Math.min(100, (item.value / resolvedMax) * 100));
        return (
          <div key={chartKey(item, index)}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-brand-ink">
                  {item.label}
                </div>
                {item.hint && (
                  <div className="text-xs font-medium text-brand-muted">
                    {item.hint}
                  </div>
                )}
              </div>
              <div className="text-xs font-semibold text-brand-ink tabular-nums">
                {formatValue(item.value)}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-subtle">
              <div
                className="h-full rounded-full"
                style={{ width: `${width}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-brand-input bg-brand-subtle p-5 text-sm font-semibold text-brand-muted">
          No data available for this period.
        </div>
      )}
    </div>
  );
}

export function DonutChart({
  segments,
  center,
  caption,
}: {
  segments: ChartItem[];
  center: ReactNode;
  caption?: string;
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const background =
    total > 0
      ? `conic-gradient(${segments
          .map((item, index) => {
            const color = item.color ?? palette[index % palette.length];
            const start = cursor;
            const end = cursor + (item.value / total) * 100;
            cursor = end;
            return `${color} ${start}% ${end}%`;
          })
          .join(", ")})`
      : "var(--line)";

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div
        className="relative h-40 w-40 shrink-0 rounded-full"
        role="img"
        aria-label={segments.map((item) => `${item.label}: ${item.value}`).join(", ")}
        style={{ background } as CSSProperties}
      >
        <div className="absolute inset-6 flex items-center justify-center rounded-full bg-white text-center">
          <div>{center}</div>
        </div>
      </div>
      <div className="min-w-[180px] flex-1 space-y-3">
        {caption && (
          <div className="text-sm font-semibold leading-6 text-brand-muted">
            {caption}
          </div>
        )}
        <div className="space-y-2">
          {segments.map((item, index) => {
            const color = item.color ?? palette[index % palette.length];
            const percent = total
              ? Math.round((item.value / total) * 100)
              : 0;
            return (
              <div
                key={chartKey(item, index)}
                className="flex items-center justify-between gap-3 rounded-xl bg-brand-subtle px-3 py-2.5"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-brand-secondary">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  {item.label}
                </div>
                <div className="whitespace-nowrap text-xs font-semibold text-brand-ink tabular-nums">
                  {item.value} ({percent}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StackedMeter({
  items,
}: {
  items: ChartItem[];
}) {
  const total = Math.max(
    1,
    items.reduce((sum, item) => sum + item.value, 0),
  );

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-brand-subtle">
        {items.map((item, index) => (
          <div
            key={chartKey(item, index)}
            title={`${item.label}: ${item.value}`}
            style={{
              width: `${Math.max(0, (item.value / total) * 100)}%`,
              background: item.color ?? palette[index % palette.length],
            }}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item, index) => (
          <div
            key={chartKey(item, index)}
            className="rounded-lg border border-brand-border bg-brand-subtle p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: item.color ?? palette[index % palette.length] }}
              />
              <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                {item.label}
              </span>
            </div>
            <div className="mt-1 text-xl font-bold text-brand-ink">
              {item.hint ?? item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

