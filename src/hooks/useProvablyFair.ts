"use client";

import { useCallback, useEffect, useState } from "react";
import type { FairCommitment } from "@/shared/types";

interface FairState {
  active: FairCommitment | null;
  revealed: Array<{
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    revealedAt: string | null;
  }>;
  howToVerify: string;
}

export function useProvablyFair() {
  const [state, setState] = useState<FairState>({ active: null, revealed: [], howToVerify: "" });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/fair");
    const json = await res.json();
    if (json.success) setState(json.data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setClientSeed = useCallback(
    async (clientSeed: string) => {
      setBusy(true);
      try {
        await fetch("/api/fair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientSeed }),
        });
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const rotate = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/fair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate: true }),
      });
      const json = await res.json();
      await refresh();
      return json.data;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const verify = useCallback(async (serverSeed: string, clientSeed: string, nonce: number, cursor = 0) => {
    const res = await fetch("/api/fair", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverSeed, clientSeed, nonce, cursor }),
    });
    const json = await res.json();
    return json.data as { serverSeedHash: string; float: number } | undefined;
  }, []);

  return { ...state, busy, refresh, setClientSeed, rotate, verify };
}
