import { InfoPage } from "@/components/InfoPage";

export const metadata = { title: "Provably Fair — TOLS Casino" };

export default function Page() {
  return (
    <InfoPage title="Provably Fair">
        <p>Every bet on TOLS Casino is provably fair — you can independently verify that the outcome was not tampered with.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">How It Works</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><b className="text-foreground">Server seed</b> — 32 random bytes from a CSPRNG, kept secret while you play.</li>
          <li><b className="text-foreground">Commitment</b> — SHA-256(serverSeed) is published before any bet. You see the hash, not the seed.</li>
          <li><b className="text-foreground">Client seed</b> — chosen by you, changeable at any time.</li>
          <li><b className="text-foreground">Nonce</b> — increments by 1 for each bet, so every roll is a distinct input.</li>
          <li><b className="text-foreground">Outcome</b> — HMAC-SHA256(serverSeed, clientSeed:nonce:cursor) produces a uniform float in [0,1).</li>
        </ul>
        <h2 className="mt-6 text-lg font-bold text-foreground">Verification</h2>
        <p>When you rotate your seed, the old serverSeed is revealed. You can recompute every outcome it produced and confirm it hashes to the commitment you were shown. No third party needed.</p>
    </InfoPage>
  );
}
