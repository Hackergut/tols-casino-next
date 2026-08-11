// scripts/seed-admin.mjs
// Idempotently creates (or promotes) an operator/admin CasinoUser so the
// /control/admin panel can be signed into. Registration forces role:"user",
// so without this there is no way to bootstrap an operator.
//
// Usage:
//   node scripts/seed-admin.mjs                                   # defaults
//   node scripts/seed-admin.mjs --email=ops@tols.gg --password=Secret123 --username=ops
//
// Re-running updates the password and re-asserts role:"admin" + status:"active".

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

// Minimal .env loader so DATABASE_URL is picked up without a dotenv dep.
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {}

const db = new PrismaClient();

function arg(name, fallback) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}

async function main() {
  const email = arg("email", "admin@tols.gg").toLowerCase();
  const username = arg("username", "admin");
  const password = arg("password", "changeme-admin-123");

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.casinoUser.upsert({
    where: { email },
    update: { role: "admin", status: "active", password: passwordHash },
    create: {
      username,
      email,
      password: passwordHash,
      role: "admin",
      status: "active",
      avatarColor: "#ccff00",
      level: 99,
      xp: 0,
      wallet: { create: { balance: 0, currency: "USDT", vipLevel: 5, totalWagered: 0, totalWon: 0 } },
    },
    include: { wallet: true },
  });

  console.log("Admin user ready:");
  console.log("  id:       " + user.id);
  console.log("  username: " + user.username);
  console.log("  email:    " + user.email);
  console.log("  role:     " + user.role);
  console.log("  status:   " + user.status);
  console.log("");
  console.log("Sign in at /control/admin with this email and the password you passed.");
  console.log("IMPORTANT: change the default password before exposing the panel.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
