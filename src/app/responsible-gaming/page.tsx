import { InfoPage } from "@/components/InfoPage";

export const metadata = { title: "Responsible Gambling — TOLS Casino" };

export default function Page() {
  return (
    <InfoPage title="Responsible Gambling">
        <p>TOLS Casino is committed to responsible gaming. Gambling should be entertainment, not a way to make money.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Tools Available</h2>
        <p>You can set the following limits from your profile:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><b className="text-foreground">Self-exclusion</b> — block yourself from playing for a set period.</li>
          <li><b className="text-foreground">Deposit limit</b> — cap how much you can deposit per day/week/month.</li>
          <li><b className="text-foreground">Wager limit</b> — cap how much you can bet per period.</li>
          <li><b className="text-foreground">Loss limit</b> — cap your net losses per period.</li>
          <li><b className="text-foreground">Session limit</b> — limit how long you play per session.</li>
        </ul>
        <h2 className="mt-6 text-lg font-bold text-foreground">Need Help?</h2>
        <p>If gambling is affecting your life, contact <a href="https://www.begambleaware.org" target="_blank" className="text-lime underline">BeGambleAware</a> or <a href="https://www.gamblersanonymous.org" target="_blank" className="text-lime underline">Gamblers Anonymous</a>.</p>
    </InfoPage>
  );
}
