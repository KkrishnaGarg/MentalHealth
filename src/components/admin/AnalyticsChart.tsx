"use client";

import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PRIMARY = "var(--color-primary)";
const SAGE = "var(--color-sage)";
const GRID = "var(--color-line)";
const TICK = { fill: "var(--color-muted)", fontSize: 12 };

/** Simple count bar chart (distributions). */
export function CountChart({ data, height = 220, color = "primary" }: { data: Array<{ name: string; count: number }>; height?: number; color?: "primary" | "sage" }) {
  return (
    <div style={{ height }} role="img" aria-label={`Bar chart: ${data.map((d) => `${d.name}: ${d.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "var(--color-primary-tint)" }} />
          <Bar dataKey="count" name="Respondents" fill={color === "primary" ? PRIMARY : SAGE} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type CorrChartRow = { factor: string; helplessness: number | null; selfEfficacy: number | null };

/** Grouped horizontal bars: 7 factors x 2 subscales, r on [-1, 1]. */
export function CorrelationChart({ data }: { data: CorrChartRow[] }) {
  return (
    <div style={{ height: 380 }} role="img" aria-label="Grouped bar chart of Pearson r for each stressor factor with perceived helplessness and lack of self-efficacy">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barCategoryGap="22%">
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" domain={[-1, 1]} tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis type="category" dataKey="factor" width={170} tick={TICK} tickLine={false} axisLine={false} />
          <ReferenceLine x={0} stroke="var(--color-line-strong)" />
          <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : "n/a")} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="helplessness" name="Perceived helplessness (r)" fill={PRIMARY} isAnimationActive={false} />
          <Bar dataKey="selfEfficacy" name="Lack of self-efficacy (r)" fill={SAGE} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
