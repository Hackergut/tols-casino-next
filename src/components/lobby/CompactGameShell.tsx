"use client";

/*
 * CompactGameShell — mobile game chrome + cinematic studio stage.
 *
 * Below lg the board fills the space between the app header and the bottom
 * nav, and the game's own controls panel is lifted into a fixed sheet docked
 * above the nav. Collapsed, that sheet shows only the primary action, so the
 * page itself never scrolls and placing a bet is always one tap away.
 * Expanded, it reveals the full controls with its own internal scroll.
 *
 * The layout is driven entirely by CSS (see `.compact-game` in globals.css) so
 * none of the eleven game components had to change.
 */

import { useEffect, useState } from "react";
import { Settings2, X } from "lucide-react";
import { originalArtUrl } from "./lobby-types";

export function CompactGameShell({ children, gameKey }: { children: React.ReactNode; gameKey: string | null }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Collapse the sheet whenever the player switches game.
  useEffect(() => { setSheetOpen(false); }, [gameKey]);

  // Close on Escape, matching the other overlays in the app.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheetOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  return (
    <div className={`compact-game game-stage${sheetOpen ? " sheet-open" : ""}`}>
      {gameKey && (
        <div
          className="game-stage-atmosphere"
          style={{ backgroundImage: `url(${originalArtUrl(gameKey)})` }}
          aria-hidden
        />
      )}
      {children}

      {/* Settings handle — icon only, tucked under the board (mobile only). */}
      <button
        type="button"
        onClick={() => setSheetOpen((o) => !o)}
        aria-expanded={sheetOpen}
        aria-label={sheetOpen ? "Chiudi impostazioni" : "Impostazioni di gioco"}
        title={sheetOpen ? "Chiudi impostazioni" : "Impostazioni di gioco"}
        className="game-sheet-toggle"
      >
        {sheetOpen ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
      </button>

      {/* Scrim behind the expanded sheet. */}
      {sheetOpen && <div className="game-sheet-scrim" onClick={() => setSheetOpen(false)} />}
    </div>
  );
}
