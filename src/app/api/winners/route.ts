import { NextResponse } from "next/server";

// GET /api/winners — recent big winners (hardcoded demo data)
export async function GET() {
  try {
    const winners = [
      {
        id: "w1",
        username: "CryptoKing99",
        avatarColor: "#ff6b35",
        gameName: "Sweet Bonanza",
        amount: 42.5,
        multiplier: 152.8,
        payout: 6494.0,
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      },
      {
        id: "w2",
        username: "LuckyAce",
        avatarColor: "#00d4aa",
        gameName: "Gates of Olympus",
        amount: 15.0,
        multiplier: 287.3,
        payout: 4309.5,
        createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      },
      {
        id: "w3",
        username: "NightOwl",
        avatarColor: "#a855f7",
        gameName: "TOLS Crash",
        amount: 200.0,
        multiplier: 18.42,
        payout: 3684.0,
        createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
      {
        id: "w4",
        username: "DiamondHands",
        avatarColor: "#f59e0b",
        gameName: "Sugar Rush",
        amount: 8.75,
        multiplier: 341.2,
        payout: 2985.5,
        createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      },
      {
        id: "w5",
        username: "MoonBet",
        avatarColor: "#06b6d4",
        gameName: "Wanted Dead or Wild",
        amount: 55.0,
        multiplier: 49.1,
        payout: 2700.5,
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      },
      {
        id: "w6",
        username: "WhaleAlert",
        avatarColor: "#ec4899",
        gameName: "Book of Dead",
        amount: 100.0,
        multiplier: 24.5,
        payout: 2450.0,
        createdAt: new Date(Date.now() - 33 * 60 * 1000).toISOString(),
      },
      {
        id: "w7",
        username: "SlotsMaster",
        avatarColor: "#22c55e",
        gameName: "Big Bass Bonanza",
        amount: 22.0,
        multiplier: 105.8,
        payout: 2327.6,
        createdAt: new Date(Date.now() - 41 * 60 * 1000).toISOString(),
      },
      {
        id: "w8",
        username: "HighRoller_X",
        avatarColor: "#ef4444",
        gameName: "TOLS Dice",
        amount: 500.0,
        multiplier: 4.32,
        payout: 2160.0,
        createdAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      },
      {
        id: "w9",
        username: "SpinQueen",
        avatarColor: "#8b5cf6",
        gameName: "Starlight Princess",
        amount: 12.0,
        multiplier: 167.5,
        payout: 2010.0,
        createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
      },
      {
        id: "w10",
        username: "DegenLord",
        avatarColor: "#f97316",
        gameName: "Mental",
        amount: 30.0,
        multiplier: 63.4,
        payout: 1902.0,
        createdAt: new Date(Date.now() - 62 * 60 * 1000).toISOString(),
      },
      {
        id: "w11",
        username: "BetMaximus",
        avatarColor: "#14b8a6",
        gameName: "Dog House",
        amount: 18.5,
        multiplier: 98.6,
        payout: 1824.1,
        createdAt: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
      },
      {
        id: "w12",
        username: "JackpotJay",
        avatarColor: "#eab308",
        gameName: "TOLS Mines",
        amount: 75.0,
        multiplier: 22.8,
        payout: 1710.0,
        createdAt: new Date(Date.now() - 78 * 60 * 1000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: winners,
    });
  } catch (error) {
    console.error("[winners] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch winners" },
      { status: 500 }
    );
  }
}
