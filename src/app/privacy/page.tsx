import { InfoPage } from "@/components/InfoPage";

export const metadata = { title: "Privacy Policy — TOLS Casino" };

export default function Page() {
  return (
    <InfoPage title="Privacy Policy">
        <p>This privacy policy describes how TOLS Casino handles your data. Placeholder — replace before going live.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Data We Collect</h2>
        <p>Username, email, date of birth (for age verification), wallet balance, bet history, and Telegram ID (if you sign in via Telegram).</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">How We Use Data</h2>
        <p>To provide gaming services, process payments, prevent fraud, and comply with legal obligations.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Data Storage</h2>
        <p>Data is stored in a PostgreSQL database. Passwords are bcrypt-hashed (never stored in plain text). Sessions are signed HTTP-only cookies.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Your Rights</h2>
        <p>You may request deletion of your account and associated data at any time by contacting support.</p>
    </InfoPage>
  );
}
