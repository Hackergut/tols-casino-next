import { InfoPage } from "@/components/InfoPage";

export const metadata = { title: "AML Policy — TOLS Casino" };

export default function Page() {
  return (
    <InfoPage title="AML Policy">
        <p>Anti-Money Laundering (AML) policy. Placeholder — replace with your compliance program before going live.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">KYC Verification</h2>
        <p>Withdrawals above a threshold require identity verification (KYC). The platform reserves the right to request documentation at any time.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Transaction Monitoring</h2>
        <p>All deposits and withdrawals are logged with on-chain transaction hashes. Suspicious activity is flagged for review.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Reporting</h2>
        <p>Suspicious transactions are reported to the relevant authorities in accordance with local regulations.</p>
    </InfoPage>
  );
}
