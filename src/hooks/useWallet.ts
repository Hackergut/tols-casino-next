"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessionStore } from "@/lib/store";

export function useWallet() {
  const balance = useSessionStore((s) => s.balance);
  const setBalance = useSessionStore((s) => s.setBalance);
  const currency = useSessionStore((s) => s.currency);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet");
      const json = await res.json();
      if (json.success && json.data) setBalance(Number(json.data.balance));
    } finally {
      setLoading(false);
    }
  }, [setBalance]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, currency, loading, refresh, setBalance };
}
