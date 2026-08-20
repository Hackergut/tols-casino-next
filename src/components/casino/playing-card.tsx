"use client";

interface PlayingCardProps {
  rank?: string;
  suit?: string;
  red?: boolean;
  hidden?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}

function Face({ rank, suit }: { rank?: string; suit?: string }) {
  const wide = rank === "10";
  return (
    <>
      <span className="bj-corner bj-corner-tl">
        <span className={`bj-rank${wide ? " bj-rank-wide" : ""}`}>{rank}</span>
        <span className="bj-suit">{suit}</span>
      </span>
      <span className="bj-pip" aria-hidden>
        {suit}
      </span>
      <span className="bj-corner bj-corner-br" aria-hidden>
        <span className={`bj-rank${wide ? " bj-rank-wide" : ""}`}>{rank}</span>
        <span className="bj-suit">{suit}</span>
      </span>
    </>
  );
}

export function PlayingCard({
  rank,
  suit,
  red,
  hidden,
  onClick,
  disabled,
  title,
}: PlayingCardProps) {
  if (hidden) {
    return <div className="bj-card bj-card-back" aria-hidden />;
  }

  const cls = `bj-card ${red ? "bj-red" : "bj-black"}${onClick ? " scopa-card" : ""}${onClick && !disabled ? " scopa-playable" : ""}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls} title={title}>
        <Face rank={rank} suit={suit} />
      </button>
    );
  }

  return (
    <div className={cls}>
      <Face rank={rank} suit={suit} />
    </div>
  );
}
