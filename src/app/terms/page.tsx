import { InfoPage } from "@/components/InfoPage";

export const metadata = {
  title: "Terms of Service — TOLS Casino",
  description: "The terms governing your use of TOLS Casino, including eligibility, accounts, deposits, withdrawals and responsible gaming.",
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 text-lg font-bold text-foreground">{children}</h2>
);

export default function Page() {
  return (
    <InfoPage title="Terms of Service">
      <p className="text-muted-foreground">Last updated: January 2026</p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the TOLS Casino platform
        (&quot;the Platform&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account or using the
        Platform you agree to be bound by these Terms, our Privacy Policy, and our Responsible Gaming policy. If you do
        not agree, do not use the Platform.
      </p>

      <H2>1. Eligibility</H2>
      <p>
        You must be at least 18 years of age (or the legal gambling age in your jurisdiction, whichever is higher) to use
        the Platform. You must not access the Platform from a jurisdiction where online gambling is prohibited. It is
        your responsibility to ensure your use of the Platform is lawful where you live. We may request proof of age and
        identity at any time and suspend accounts that fail verification.
      </p>

      <H2>2. Your Account</H2>
      <p>
        You are responsible for maintaining the confidentiality of your login credentials and for all activity under your
        account. You must provide accurate information at registration and keep it up to date. One account per person is
        permitted. You must not transfer, sell or share your account. Notify us immediately of any unauthorised use.
      </p>

      <H2>3. Provably Fair Gaming</H2>
      <p>
        All TOLS Original game outcomes are determined by a provably-fair random number generator. Before each round a
        server seed is committed as a SHA-256 hash; the outcome is derived from that committed seed, your client seed and
        an incrementing nonce using HMAC-SHA256. You may rotate and reveal your seed to independently verify every
        result. Third-party games are provided by their respective vendors and governed by their own fairness mechanisms.
      </p>

      <H2>4. Deposits and Withdrawals</H2>
      <p>
        Deposits are credited to your balance after the required on-chain confirmations. Withdrawals are subject to
        review and may require identity verification (KYC) before processing. The Platform never holds your private keys;
        you are solely responsible for the security of any external wallet you use and for the accuracy of the addresses
        you provide. We reserve the right to delay or refuse withdrawals where required by law or to prevent fraud.
      </p>

      <H2>5. Prohibited Conduct</H2>
      <p>You agree not to:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Attempt to manipulate, exploit or reverse-engineer the Platform or its games.</li>
        <li>Use automated systems, bots or multiple accounts to gain an unfair advantage.</li>
        <li>Use the Platform for money laundering, fraud or any illegal purpose.</li>
        <li>Attempt to gain unauthorised access to other accounts or systems.</li>
        <li>Misuse bonuses or promotions in a manner inconsistent with their terms.</li>
      </ul>

      <H2>6. Intellectual Property</H2>
      <p>
        The Platform, including its software, design, trademarks and content, is owned by or licensed to us and is
        protected by applicable law. You are granted a limited, non-exclusive, revocable licence to use the Platform for
        its intended purpose only.
      </p>

      <H2>7. Limitation of Liability</H2>
      <p>
        The Platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the maximum extent
        permitted by law, we are not liable for indirect, incidental or consequential losses, or for losses arising from
        events outside our reasonable control (including blockchain network failures and third-party service outages).
        Nothing in these Terms limits liability that cannot be limited by law.
      </p>

      <H2>8. Suspension and Termination</H2>
      <p>
        We may suspend or terminate your account and access to the Platform at our discretion if you breach these Terms,
        if we reasonably suspect fraud or unlawful activity, or where required by law or regulation.
      </p>

      <H2>9. Responsible Gaming</H2>
      <p>
        Gambling involves risk and can be addictive. We provide responsible-gaming tools, including deposit and wager
        limits, session time-outs and self-exclusion. Please see our Responsible Gaming page and seek help if gambling
        stops being entertainment.
      </p>

      <H2>10. Changes to These Terms</H2>
      <p>
        We may amend these Terms from time to time. Continued use of the Platform after changes take effect constitutes
        acceptance of the revised Terms. Where required, we will notify you of material changes in advance.
      </p>

      <H2>11. Governing Law</H2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which the operator is licensed, without regard to
        conflict-of-law principles. Any dispute shall be subject to the exclusive jurisdiction of the courts of that
        jurisdiction.
      </p>

      <H2>12. Contact</H2>
      <p>For questions about these Terms, contact us via Live Support or at support@tols.fun.</p>
    </InfoPage>
  );
}
