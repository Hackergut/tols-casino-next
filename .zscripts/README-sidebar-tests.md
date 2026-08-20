# Sidebar interactive tests (jsdom)

Component-level interaction tests for the side menus, runnable without a
browser. They mount the REAL components with the same wiring as
`src/app/page.tsx` and `/control/admin`, simulate clicks, and assert on
classes, routing and store state.

- `sidebar-component-test.tsx` — lobby sidebar (`src/components/lobby/CasinoSidebar.tsx`)
  + header hamburger: open/close, scrim, all 15 nav items, navigation,
  auto-close on select, search input.
- `admin-sidebar-test.tsx` — admin sidebar (`src/components/admin/admin-sidebar.tsx`):
  collapse/expand (w-64 ↔ w-16), group toggle, navigation via the zustand
  store, search input presence, mobile hamburger.

Run from the repo root (requires the `esbuild` and `jsdom` devDependencies):

```bash
./node_modules/.bin/esbuild .zscripts/sidebar-component-test.tsx \
  --bundle --platform=node --format=esm --outfile=/tmp/sidebar-test.mjs \
  --alias:@=./src --alias:next/navigation=./.zscripts/next-shims.mjs \
  --jsx=automatic --loader:.css=empty --loader:.woff2=dataurl \
  --external:jsdom --log-level=error \
&& node /tmp/sidebar-test.mjs

./node_modules/.bin/esbuild .zscripts/admin-sidebar-test.tsx \
  --bundle --platform=node --format=esm --outfile=/tmp/admin-sidebar-test.mjs \
  --alias:@=./src --alias:next/navigation=./.zscripts/next-shims.mjs \
  --alias:next-themes=./.zscripts/next-themes-shim.mjs \
  --jsx=automatic --loader:.css=empty --loader:.woff2=dataurl \
  --external:jsdom --log-level=error \
&& node /tmp/admin-sidebar-test.mjs
```

Known jsdom limits (test artifacts, NOT app bugs):

- React 19 `onChange` does not react to synthetic `input` events in jsdom, so
  search-field filtering is asserted by code review instead of simulation.
- The full-page harness mounting all of `src/app/page.tsx` hangs on the game
  canvases' rAF loops; keep tests scoped to the menu components.
