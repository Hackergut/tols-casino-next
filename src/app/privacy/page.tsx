import { InfoPage } from "@/components/InfoPage";

export const metadata = {
  title: "Privacy Policy — TOLS Casino",
  description: "How TOLS Casino collects, uses, stores and protects your personal data, and the rights you hold over it.",
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 text-lg font-bold text-foreground">{children}</h2>
);

export default function Page() {
  return (
    <InfoPage title="Privacy Policy">
      <p className="text-muted-foreground">Last updated: January 2026</p>

      <p>
        TOLS Casino (&quot;TOLS&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy.
        This Privacy Policy explains what information we collect, why we collect it, how we use and protect it, and the
        choices you have. By using the Platform you acknowledge this Policy. If you do not agree, please stop using the
        Platform.
      </p>

      <H2>1. Data Controller</H2>
      <p>
        The data controller is TOLS Casino. For any privacy matter you may contact our Data Protection team at
        privacy@tols.fun or through Live Support.
      </p>

      <H2>2. Information We Collect</H2>
      <p>We collect only the information needed to operate the Platform and meet our legal obligations:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Account data</strong> — username, email address, and a password hash (never the plain-text password).</li>
        <li><strong>Identity &amp; age verification</strong> — date of birth for age verification, and, for withdrawals above threshold or where required by law, KYC documents (government ID, proof of address).</li>
        <li><strong>Financial data</strong> — wallet balances, deposit and withdrawal records, and on-chain transaction hashes.</li>
        <li><strong>Gaming data</strong> — bet history, game outcomes, and provably-fair seeds and nonces.</li>
        <li><strong>Technical data</strong> — IP address, device and browser information, and approximate location derived from your IP for jurisdictional and fraud checks.</li>
        <li><strong>Third-party sign-in data</strong> — if you sign in via Google or Telegram, the identifier and email those providers share with us.</li>
      </ul>

      <H2>3. How We Use Your Data</H2>
      <p>We process personal data for the following purposes:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>To create and manage your account and provide the gaming services.</li>
        <li>To process deposits and withdrawals and prevent fraud, money laundering and abuse.</li>
        <li>To verify your age and identity where legally required.</li>
        <li>To comply with our legal, regulatory and licensing obligations.</li>
        <li>To maintain the security and integrity of the Platform.</li>
        <li>To provide customer support and respond to your requests.</li>
        <li>To send you service communications and, only with your consent, marketing communications.</li>
      </ul>

      <H2>4. Legal Basis for Processing</H2>
      <p>
        We process your data on the following legal grounds: performance of our contract with you, compliance with legal
        obligations, our legitimate interests (security, fraud prevention, service improvement), and, where applicable,
        your consent.
      </p>

      <H2>5. How We Store and Protect Your Data</H2>
      <p>
        Data is stored in an encrypted PostgreSQL database. Passwords are hashed with bcrypt and are never stored in
        plain text. Sessions are authenticated using signed, HTTP-only cookies. We apply encryption in transit (TLS) and
        at rest, access controls, and logging, and we restrict access to personal data to personnel who need it.
      </p>

      <H2>6. Data Retention</H2>
      <p>
        We retain personal data only as long as necessary to provide the service and satisfy legal, accounting and
        anti-money-laundering requirements. Bet records and transaction logs are retained for the period required by
        applicable law, after which they are deleted or anonymised.
      </p>

      <H2>7. Sharing and Disclosure</H2>
      <p>
        We do not sell your personal data. We may share data with: service providers who operate the Platform (hosting,
        payment, identity verification); game providers whose titles you launch; and competent authorities where
        required by law. All processors are bound by data-protection obligations.
      </p>

      <H2>8. Cookies and Similar Technologies</H2>
      <p>
        We use strictly necessary cookies to keep you signed in and to remember your compliance choices (age and consent).
        With your permission we may also use analytics and marketing cookies. You can manage your preferences at any time
        from the cookie settings.
      </p>

      <H2>9. Your Rights</H2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Access the personal data we hold about you.</li>
        <li>Request correction of inaccurate data.</li>
        <li>Request deletion of your account and associated data.</li>
        <li>Restrict or object to certain processing.</li>
        <li>Receive your data in a portable format.</li>
        <li>Withdraw consent where processing is consent-based.</li>
      </ul>
      <p>To exercise any of these rights, contact us at privacy@tols.fun. We will respond within the timeframe required by law.</p>

      <H2>10. International Transfers</H2>
      <p>
        Where data is transferred outside your country, we rely on appropriate safeguards such as standard contractual
        clauses to ensure an equivalent level of protection.
      </p>

      <H2>11. Children</H2>
      <p>
        The Platform is restricted to adults. We do not knowingly collect data from anyone under the legal gambling age
        in their jurisdiction, and we verify age at registration.
      </p>

      <H2>12. Changes to This Policy</H2>
      <p>
        We may update this Policy from time to time. Material changes will be communicated on the Platform and, where
        required, we will seek renewed consent.
      </p>
    </InfoPage>
  );
}
