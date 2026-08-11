# Task ID: 9b - Login Page Enhancement

## Agent: Main Developer

## Work Log

### 1. API Connectivity Check
- Added `ConnectivityStatus` type: `'checking' | 'connected' | 'disconnected'`
- Added `useEffect` that fires a HEAD request to `/api/tols?entity=health&limit=1` on mount
- Added status indicator below the login card with three states:
  - Checking: `Loader2` spinner + "Checking connection..." text
  - Connected: Animated green ping dot + "Connected to TOLS API"
  - Disconnected: Static red dot + "Unable to reach API"
- Check is informational only — does not block the login form

### 2. Enhanced Login Transitions (framer-motion)
- Added `AnimatePresence` + `motion.div` wrapper on the entire login page for smooth enter/exit
- Login card: `initial={{ opacity: 0, scale: 0.9, y: 20 }}` → `animate={{ opacity: 1, scale: 1, y: 0 }}` with spring-like easing
- Logo area: separate fade-in + slide-up animation with delay
- **Card glow effect**: Dynamic `boxShadow` based on `keyLength / 32` — glow intensifies as user types more characters
- **Success animation**: `LoginPhase` state machine (`idle` → `connecting` → `success`)
  - On "success" phase, a green checkmark circle scales in with spring physics + rotation
  - Overlaid with emerald-tinted backdrop, then transitions to dashboard after 600ms
- Smooth transition when switching from login → dashboard via `AnimatePresence mode="wait"`

### 3. Better Login Form UX
- **Remember key toggle**: Added `Switch` component + `Label` below the input
  - Uses `localStorage` (`tols_api_key`, `tols_remember_key`)
  - Initialized via lazy `useState` initializer (avoids lint "set-state-in-effect" error)
- **Floating label animation**: Custom animated `<label>` that transitions from placeholder position to a floating position above the input on focus/fill, using framer-motion
- **Keyboard shortcut hint**: Shows "Press `Enter` to connect" below the button when input has content, with `AnimatePresence` fade
- **Key strength indicator**: Animated bar below input:
  - Red (`bg-red-500`) when < 8 chars
  - Amber (`bg-amber-500`) when 8-16 chars
  - Green (`bg-emerald-500`) when 16+ chars
  - Width animates proportionally, character count shown on the right

### 4. Global CSS Enhancements (in existing `<style jsx global>`)
- **Custom selection highlight**: `::selection` using `oklch(0.65 0.18 160 / 0.35)` — emerald-tinted
- **Focus ring animation**: `@keyframes focus-ring-pulse` — outline starts at offset 4px with 0.3 opacity, pulses to 2px at full opacity
- **Webkit scrollbar customization**: 8px width, dark track, rounded thumb with hover transition
- **`.glass` utility class**: `backdrop-filter: blur(12px) saturate(180%)` with `-webkit-` prefix
- **`.glass-hover` utility class**: Same base as `.glass`, on hover intensifies to `blur(16px) saturate(200%)` with smooth transition
- All existing animations preserved intact

### 5. StickyHeader Improvements
- **User avatar circle**: Added before Search button on the right side
  - Shows first character of the API key (uppercase)
  - Gradient background: `from-primary to-primary/70`
  - Hover effect: subtle glow shadow
- **Tooltip on hover**: Shows "API Key: ****...{last 4 chars}"
- **RippleButton component**: Custom button with ripple effect on click
  - Creates expanding white circles from click point using framer-motion
  - Ripples auto-remove after 600ms
  - Applied to the avatar button

### 6. Lint Fix
- Initial lint error: `react-hooks/set-state-in-effect` for calling `setTempKey`/`setRememberKey` in useEffect
- Fixed by converting to lazy `useState` initializer functions with `typeof window` guard
- Final lint: 0 errors (1 pre-existing warning in unrelated file)

## Stage Summary
- Login page now features a polished, animated experience with connectivity check, key strength indicator, remember-key toggle, floating labels, and smooth transitions
- Global CSS utility classes (`.glass`, `.glass-hover`) available for use across the platform
- StickyHeader includes user avatar with gradient and ripple interaction
- All changes pass ESLint with zero new errors
- Dev server compiles successfully
