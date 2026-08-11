"use client";

const SECT: Record<string, React.CSSProperties> = {};

export function CasinoFooter({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const link = "text-xs text-muted-foreground transition-colors hover:text-lime";
  const heading = "mb-2 text-[10px] font-bold uppercase tracking-widest text-lime/60";
  return (
    <footer className="mt-auto border-t border-lime/10 bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {/* Support */}
          <div>
            <p className={heading}>Support</p>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => onNavigate?.("live-support")} className={link + " text-left"}>Live Support</button>
              <a href="/help" className={link}>Help Center</a>
              <a href="/responsible-gaming" className={link}>Game Responsibly</a>
            </div>
          </div>
          {/* Platform */}
          <div>
            <p className={heading}>Platform</p>
            <div className="flex flex-col gap-1.5">
              <a href="/provably-fair" className={link}>Provably Fair</a>
              <button onClick={() => onNavigate?.("affiliate")} className={link + " text-left"}>Affiliate Program</button>
              <button onClick={() => onNavigate?.("riscatta-codice")} className={link + " text-left"}>Redeem Code</button>
              <button onClick={() => onNavigate?.("vip")} className={link + " text-left"}>VIP Program</button>
            </div>
          </div>
          {/* Policy */}
          <div>
            <p className={heading}>Policy</p>
            <div className="flex flex-col gap-1.5">
              <a href="/terms" className={link}>Terms of Service</a>
              <a href="/privacy" className={link}>Privacy Policy</a>
              <a href="/responsible-gaming" className={link}>Responsible Gambling</a>
              <a href="/aml" className={link}>AML Policy</a>
            </div>
          </div>
          {/* Community */}
          <div>
            <p className={heading}>Community</p>
            <div className="flex flex-col gap-1.5">
              <a href="https://t.me/tolscasinobot" target="_blank" rel="noopener" className={link}>Telegram</a>
              <a href="https://x.com" target="_blank" rel="noopener" className={link}>X</a>
              <a href="https://instagram.com" target="_blank" rel="noopener" className={link}>Instagram</a>
              <a href="https://t.me/tolscasinobot" target="_blank" rel="noopener" className={link}>Forum</a>
            </div>
          </div>
        </div>
        <div className="mt-6 border-t border-lime/5 pt-4 text-center">
          <p className="text-xs text-muted-foreground/50">© 2025 TOLS Casino — Provably Fair Gaming · 18+ Only · Play Responsibly</p>
        </div>
      </div>
    </footer>
  );
}
