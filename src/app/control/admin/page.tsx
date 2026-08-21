import { redirect } from "next/navigation";

/**
 * The Casino operator UI is retired. RTP, players, wallets, CMS and the
 * EuroVirtuals connection are driven from Governance (gov.tols.fun).
 * next.config.ts also 307s /control/* there; this is the in-app fallback.
 */
export default function RetiredCasinoAdmin() {
  redirect(process.env.GOVERNANCE_TOWER_URL || "https://gov.tols.fun");
}
