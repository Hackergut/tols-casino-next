'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface StatsBarChartProps {
  data: { name: string; value: number; color: string }[];
  height?: number;
  showLabels?: boolean;
}

function customTooltipStyle(): React.CSSProperties {
  return {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '10px',
    fontSize: 12,
    padding: '10px 14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  };
}

export function StatsBarChart({ data, height = 200, showLabels = true }: StatsBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: showLabels ? 0 : 10, right: 10, top: 5, bottom: 5 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={showLabels ? 70 : 0}
        />
        <Tooltip
          contentStyle={customTooltipStyle()}
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
          formatter={(value: number) => [value.toLocaleString(), 'Count']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
