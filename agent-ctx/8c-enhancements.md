# Task 8c — Enhanced Global Footer, CSS, and StickyHeader

## Changes Made

### 1. Enhanced Global CSS (`src/app/globals.css`)
- **Custom scrollbar**: Thinner (5px), rounded pill thumb, primary-colored on hover with smooth transition
- **Selection highlight**: `oklch()` based primary/22% background
- **Focus ring animation**: Smooth 0.2s transition on outline-color and outline-offset for `:focus-visible`
- **Smooth scroll**: Already existed, preserved
- **Noise texture class**: `.noise-texture` — uses SVG fractalNoise data-URL as pseudo-element overlay at 3.5% opacity
- **Glass utility classes**: `.glass` and `.glass-hover` — backdrop-blur + saturate + semi-transparent card background + border. `.glass-hover` adds hover transitions for background, border-color, and subtle box-shadow

### 2. Enhanced StickyHeader (`src/app/page.tsx`)
- **Scroll shadow**: Added `useEffect` with scroll listener (passive) — when `scrollY > 8`, applies `shadow-[0_4px_24px_-4px_...]` with light/dark variants via `transition-shadow duration-300`
- **Backdrop blur**: Retained existing `backdrop-blur-xl`, gradient border line reduced to `primary/20`
- **Breadcrumb**: Added `aria-label="Breadcrumb"`, replaced `/` separator with `ChevronRight` icon, added hover background on group name button
- **Connection status**: Preserved as-is (green ping dot + red WifiOff)

### 3. Enhanced Global Footer (`src/app/page.tsx`)
- **New `EnhancedFooter` component** replacing the minimal footer
- **Left section**: "TOLS Admin" + heartbeat dot + "v1.0.0" + "All systems operational" (green text, hidden on xs)
- **Center section**: Quick links — Dashboard | Settings | Help — with icons, hidden on mobile (`hidden md:flex`)
- **Right section**: Real-time clock (HH:MM:SS, `setInterval` every 1s with cleanup), timezone abbreviation, "Synced: X ago" counter
- **Sticky**: Uses `mt-auto` pattern within flex column main
- **Gradient background**: `from-background via-background/60 to-background` with `backdrop-blur-sm`
- **Gradient top border**: `h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent`
- **Scroll-to-top button**: Absolute-positioned above footer, appears when `scrollY > 120`, smooth scrolls to top
- **Responsive**: Center quick links hidden on mobile, timezone/sync info hidden on xs screens

## Files Modified
- `src/app/globals.css` — CSS enhancements
- `src/app/page.tsx` — StickyHeader + EnhancedFooter components

## Pre-existing Issues
- Lint error in `src/components/admin/shared/data-table.tsx:161` (setState in effect) — not related to these changes
