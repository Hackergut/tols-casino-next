"use client";

import { GameBetControls } from "@/components/casino/game-shared";

export function BetPanel({
  betAmount,
  setBetAmount,
  balance,
  disabled,
  onBet,
  label = "Bet",
  extra,
}: {
  betAmount: number;
  setBetAmount: (n: number) => void;
  balance: number;
  disabled?: boolean;
  onBet?: () => void;
  label?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <GameBetControls betAmount={betAmount} setBetAmount={setBetAmount} balance={balance} disabled={disabled} />
      {extra}
      {onBet && (
        <button onClick={onBet} disabled={disabled || betAmount <= 0 || betAmount > balance} className="g-btn g-btn-play">
          {label}
        </button>
      )}
    </div>
  );
}
