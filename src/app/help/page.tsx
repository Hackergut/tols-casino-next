import { InfoPage } from "@/components/InfoPage";

export const metadata = { title: "Help Center — TOLS Casino" };

export default function Page() {
  return (
    <InfoPage title="Help Center">
        <p>Welcome to the TOLS Casino Help Center.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Getting Started</h2>
        <p>Sign up or log in from the header. Guests can play in Fun Mode (no real money). To play for real, register and deposit.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Deposits</h2>
        <p>Click your balance → Deposit tab → choose a chain and amount → send crypto to the address shown → paste your tx hash to register → credited automatically after on-chain confirmation. Inside Telegram, you can also pay with Telegram Stars.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Withdrawals</h2>
        <p>Click your balance → Withdraw tab → enter your wallet address and amount → your request is reviewed and processed manually (usually within a few hours).</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Provably Fair</h2>
        <p>See our <a href="/provably-fair" className="text-lime underline">Provably Fair</a> page to learn how to verify your bets.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Responsible Gaming</h2>
        <p>Set deposit, wager, loss, and session limits from your profile. See <a href="/responsible-gaming" className="text-lime underline">Responsible Gambling</a>.</p>
        <h2 className="mt-6 text-lg font-bold text-foreground">Contact</h2>
        <p>For support, use the Live Support option in your profile menu, or reach us on Telegram.</p>
    </InfoPage>
  );
}
