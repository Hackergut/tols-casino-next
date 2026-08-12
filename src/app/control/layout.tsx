import type { Metadata } from "next";

// Server layout for the operator console subtree. The admin UI itself lives in
// control/admin/layout.tsx ('use client'); this exists only to attach metadata,
// most importantly noindex — the operator console must never reach a search
// index. It renders children untouched.
export const metadata: Metadata = {
  title: "Operator Console",
  robots: { index: false, follow: false },
};

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return children;
}
