import DepositPanel from "@/components/casino/DepositPanel";
import WithdrawalPanel from "@/components/casino/WithdrawalPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit & Withdraw | TOLS Casino" };

export default function DepositPage() {
  return (
    <main className="min-h-screen bg-[#0a0b14] pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Cashier</h1>
        <p className="text-gray-400 text-center mb-8">
          Deposit crypto to play or withdraw your winnings.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <DepositPanel />
          <WithdrawalPanel />
        </div>
      </div>
    </main>
  );
}
