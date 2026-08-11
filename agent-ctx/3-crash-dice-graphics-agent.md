# Task ID: 3 — Crash+Dice Graphics Agent

## Task
Professional graphics rebuild for Crash and Dice original casino games.

## Files Modified
- `/src/components/casino/game-crash.tsx` — Full rewrite (~290 lines)
- `/src/components/casino/game-dice.tsx` — Full rewrite (~280 lines)

## Key Implementation Details

### Crash Game
- SVG real-time chart (600x280 viewBox) with gradient fills, grid lines, axis labels
- Green line when running, red when crashed, SVG glow filter
- Chart points sampled every 3 frames, capped at 300
- Text-6xl/7xl multiplier with CSS text-shadow glow (glow-lime/green/red)
- 20 floating particles during running phase
- Crash: screen shake + red flash overlay
- Cashout: green flash + floating +$XX
- History badges: red <2x, orange 2-5x, green 5x+
- Collapsible Provably Fair panel

### Dice Game
- 200px vertical probability meter with green win/red lose zones
- Animated target line with glow
- 3D CSS perspective dice face with rotation animation
- Win: green pulse + floating +$XX. Lose: red shake
- Custom-styled range slider with gradient track
- Collapsible Provably Fair panel

## Quality
- ESLint: zero errors on both files
- No framer-motion (React 19 compatible)
- All CSS animations via @keyframes
