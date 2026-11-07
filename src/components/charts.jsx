import { useId, useMemo, useState } from "react";

// SVG coordinate space; the charts scale to their container's width.
const W = 640;
const AREA_PAD = { top: 12, right: 8, bottom: 24, left: 44 };

/**
 * Single-series area/line chart (SVG) with crosshair + tooltip.
 * data: [{ x: label, y: number }]; formatY formats tooltip/axis values.
 */
export function AreaChart({
  data,
  formatY = (v) => v,
  height = 220,
  color = "var(--accent)",
}) {
  const [hover, setHover] = useState(null); // index
  // Unique per chart: a shared id would make every chart on the page use the
  // first one's gradient (and color).
  const gradientId = `area-fill-${useId().replace(/[^\w-]/g, "")}`;

  const H = height;

  const { points, ticks } = useMemo(() => {
    const ys = data.map((d) => d.y);
    const rawMax = Math.max(1, ...ys);
    // round the axis max up to a friendly step
    const mag = 10 ** Math.floor(Math.log10(rawMax));
    const niced =
      [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= rawMax / 4) ??
      mag;
    const maxY = Math.ceil(rawMax / niced) * niced;

    const iw = W - AREA_PAD.left - AREA_PAD.right;
    const ih = H - AREA_PAD.top - AREA_PAD.bottom;
    const n = Math.max(1, data.length - 1);
    const points = data.map((d, i) => ({
      ...d,
      px: AREA_PAD.left + (i / n) * iw,
      py: AREA_PAD.top + ih - (d.y / maxY) * ih,
    }));

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      v: maxY * f,
      py: AREA_PAD.top + ih - f * ih,
    }));

    return { points, ticks };
  }, [data, H]);

  if (!data.length) return null;

  const line = points
    .map((p, i) => `${i ? "L" : "M"}${p.px.toFixed(1)},${p.py.toFixed(1)}`)
    .join("");
  const area = `${line}L${points.at(-1).px.toFixed(1)},${H - AREA_PAD.bottom}L${points[0].px.toFixed(1)},${H - AREA_PAD.bottom}Z`;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.px - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;

  // Sparse x labels: first, middle, last.
  const labelIdx = new Set([
    0,
    Math.floor((data.length - 1) / 2),
    data.length - 1,
  ]);

  return (
    <div className="viz-root">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          touchAction: "pan-y",
        }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          onMove({ currentTarget: e.currentTarget, clientX: t.clientX });
        }}
        role="img"
        aria-label="Trend chart"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t.v}>
            <line
              x1={AREA_PAD.left}
              x2={W - AREA_PAD.right}
              y1={t.py}
              y2={t.py}
              stroke="var(--grid)"
              strokeWidth="1"
            />
            <text
              x={AREA_PAD.left - 8}
              y={t.py + 4}
              textAnchor="end"
              fontSize="10.5"
              fill="var(--ink-3)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatY(t.v)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map(
          (p, i) =>
            labelIdx.has(i) && (
              <text
                key={i}
                x={p.px}
                y={H - 6}
                textAnchor={
                  i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"
                }
                fontSize="10.5"
                fill="var(--ink-3)"
              >
                {p.x}
              </text>
            ),
        )}

        {hp && (
          <g>
            <line
              x1={hp.px}
              x2={hp.px}
              y1={AREA_PAD.top}
              y2={H - AREA_PAD.bottom}
              stroke="var(--ink-3)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={hp.px}
              cy={hp.py}
              r="4.5"
              fill={color}
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {hp && (
        <div
          className="viz-tip"
          style={{
            left: `${(hp.px / W) * 100}%`,
            top: `${(hp.py / H) * 100}%`,
          }}
        >
          <div className="t-label">{hp.x}</div>
          <div className="t-val">{formatY(hp.y)}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Horizontal labeled bar list — magnitude with visible names + values,
 * so identity is never color-alone. `color` may be a fn(row) for the
 * status breakdown.
 */
export function BarList({ data, formatV = (v) => v, color = "var(--accent)" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="barlist">
      {data.map((d) => (
        <div
          className="bl-row"
          key={d.id ?? d.name}
          title={`${d.name}: ${formatV(d.value)}`}
        >
          <span className="bl-name">{d.name}</span>
          <div className="bl-track">
            <div
              className="bl-fill"
              style={{
                width: `${(d.value / max) * 100}%`,
                "--bl-c": typeof color === "function" ? color(d) : color,
              }}
            />
          </div>
          <span className="bl-val">{formatV(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Donut chart for a small share-of-whole (<= 6 slices). Always paired
 * with the legend list beside it — identity is never color-alone.
 */
export function Donut({ data, formatV = (v) => v, size = 168 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;

  const R = 48;
  const C = 2 * Math.PI * R;
  // Where each slice starts, as a fraction of the circle (running total).
  const fractions = data.map((d) => d.value / total);
  const starts = fractions.map((_, i) =>
    fractions.slice(0, i).reduce((sum, f) => sum + f, 0),
  );

  return (
    <div className="donut-wrap">
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        role="img"
        aria-label="Share chart"
      >
        {data.map((d, i) => {
          const dash = Math.max(0, fractions[i] * C - 2); // 2px gap between slices
          return (
            <circle
              key={d.name}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={d.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-starts[i] * C + C / 4}
              strokeLinecap="butt"
            />
          );
        })}
        <text
          x="60"
          y="57"
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill="var(--ink)"
        >
          {formatV(total)}
        </text>
        <text
          x="60"
          y="72"
          textAnchor="middle"
          fontSize="8.5"
          fill="var(--ink-3)"
        >
          total
        </text>
      </svg>
      <div className="donut-legend">
        {data.map((d) => (
          <div key={d.name} className="dl-row">
            <span className="dot" style={{ background: d.color }} />
            <span className="dl-name">{d.name}</span>
            <span className="dl-val">
              {formatV(d.value)} · {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Grouped two-series bar chart (e.g. money in vs out per month).
 * Legend always shown; hover tooltip per group.
 */
export function GroupedBars({
  data,
  series,
  formatV = (v) => v,
  height = 220,
}) {
  const [hover, setHover] = useState(null);

  const H = height;
  const PAD = { top: 14, right: 8, bottom: 24, left: 48 };

  const max = Math.max(
    1,
    ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)),
  );
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const groupW = iw / Math.max(1, data.length);
  const barW = Math.min(22, (groupW * 0.7) / series.length);

  const ticks = [0, 0.5, 1].map((f) => ({
    v: max * f,
    py: PAD.top + ih - f * ih,
  }));

  return (
    <div className="viz-root">
      <div className="row small" style={{ gap: 14, marginBottom: 6 }}>
        {series.map((s) => (
          <span key={s.key} className="row" style={{ gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: s.color,
              }}
            />
            <span className="muted">{s.label}</span>
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Grouped bar chart"
      >
        {ticks.map((t) => (
          <g key={t.v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.py}
              y2={t.py}
              stroke="var(--grid)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={t.py + 4}
              textAnchor="end"
              fontSize="10.5"
              fill="var(--ink-3)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatV(t.v)}
            </text>
          </g>
        ))}
        {data.map((d, gi) => {
          const gx = PAD.left + gi * groupW + groupW / 2;
          return (
            <g key={d.label} onMouseEnter={() => setHover(gi)}>
              <rect
                x={PAD.left + gi * groupW}
                y={PAD.top}
                width={groupW}
                height={ih}
                fill="transparent"
              />
              {series.map((s, si) => {
                const v = Number(d[s.key]) || 0;
                const bh = (v / max) * ih;
                const x = gx - (series.length * barW) / 2 + si * barW;
                return (
                  <rect
                    key={s.key}
                    x={x + 1}
                    y={PAD.top + ih - bh}
                    width={barW - 2}
                    height={Math.max(bh, v > 0 ? 2 : 0)}
                    rx="3"
                    fill={s.color}
                  />
                );
              })}
              {(data.length <= 8 || gi % Math.ceil(data.length / 8) === 0) && (
                <text
                  x={gx}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="var(--ink-3)"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && data[hover] && (
        <div
          className="viz-tip"
          style={{
            left: `${((PAD.left + hover * groupW + groupW / 2) / W) * 100}%`,
            top: `${(PAD.top / H) * 100}%`,
          }}
        >
          <div className="t-label">{data[hover].label}</div>
          {series.map((s) => (
            <div key={s.key} className="t-val">
              {s.label}: {formatV(Number(data[hover][s.key]) || 0)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatCard({ label, value, delta, deltaLabel, icon }) {
  return (
    <div className="stat">
      <div className="k">
        {icon}
        {label}
      </div>
      <div className="v">{value}</div>
      {delta != null && (
        <div className="d">
          <span className={delta >= 0 ? "up" : "down"}>
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(0)}%
          </span>{" "}
          {deltaLabel}
        </div>
      )}
      {delta == null && deltaLabel && <div className="d">{deltaLabel}</div>}
    </div>
  );
}
