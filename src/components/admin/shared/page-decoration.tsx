'use client';

import React from 'react';

type DecorationVariant =
  | 'emerald'
  | 'amber'
  | 'purple'
  | 'orange'
  | 'teal'
  | 'rose'
  | 'sky'
  | 'red'
  | 'blue';

interface PageDecorationProps {
  variant: DecorationVariant;
  className?: string;
}

const VARIANT_COLORS: Record<DecorationVariant, string> = {
  emerald: 'oklch(0.7 0.17 162)',
  amber: 'oklch(0.75 0.18 80)',
  purple: 'oklch(0.65 0.2 300)',
  orange: 'oklch(0.7 0.19 55)',
  teal: 'oklch(0.7 0.12 180)',
  rose: 'oklch(0.65 0.2 10)',
  sky: 'oklch(0.7 0.15 230)',
  red: 'oklch(0.6 0.22 25)',
  blue: 'oklch(0.6 0.18 260)',
};

export function PageDecoration({ variant, className }: PageDecorationProps) {
  const color = VARIANT_COLORS[variant];

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none z-0 ${className ?? ''}`}>
      {/* Top-right: large blurred circle */}
      <div
        className="deco-blob"
        style={{
          width: 200,
          height: 200,
          top: '-40px',
          right: '-40px',
          background: color,
          opacity: 0.05,
        }}
      />

      {/* Bottom-left: medium blurred circle */}
      <div
        className="deco-blob"
        style={{
          width: 150,
          height: 150,
          bottom: '-30px',
          left: '-30px',
          background: color,
          opacity: 0.03,
        }}
      />

      {/* Top-left: small blurred circle */}
      <div
        className="deco-blob"
        style={{
          width: 100,
          height: 100,
          top: '-20px',
          left: '-20px',
          background: 'var(--foreground)',
          opacity: 0.02,
        }}
      />
    </div>
  );
}
