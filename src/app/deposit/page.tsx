import DepositPanel from "@/components/casino/DepositPanel";

export const metadata = { title: "Deposit — TOLS Casino" };

export default function DepositPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight">Deposit</h1>
        <p className="mb-6 text-center text-xs text-muted-foreground">Top up your balance with crypto or Telegram Stars.</p>
        <DepositPanel />
      </div>
    </main>
  );
}
