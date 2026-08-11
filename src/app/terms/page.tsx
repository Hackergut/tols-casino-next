import { InfoPage } from "@/components/InfoPage";

export const metadata = { title: "Terms of Service — TOLS Casino" };

export default function Page() {
  return (
    <InfoPage title="Terms of Service">
        <p>By using TOLS Casino you agree to these terms. This is a placeholder — replace with your finalized legal text before going live.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">1. Eligibility</h2>
        <p>You must be of legal age in your jurisdiction (18+ or 21+ where applicable) to use this platform.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">2. Provably Fair Gaming</h2>
        <p>All game outcomes are determined by a provably-fair RNG using HMAC-SHA256 with committed server seeds, player-chosen client seeds, and incrementing nonces. You can verify every bet.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">3. Deposits & Withdrawals</h2>
        <p>Deposits are credited after on-chain confirmation. Withdrawals are reviewed and processed manually. The platform never stores private keys.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">4. Account Security</h2>
        <p>You are responsible for safeguarding your credentials. Two-factor authentication (2FA) is available for operators.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">5. Limitation of Liability</h2>
        <p>TOLS Casino is not liable for losses beyond your deposited funds. Play responsibly and within your means.</p>
    </InfoPage>
  );
}
