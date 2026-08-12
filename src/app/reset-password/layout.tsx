import type { Metadata } from "next";

// Server layout to give the (client) reset-password page its own title and
// keep it out of search indexes (the URL carries a one-time token).
export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a new password for your TOLS Casino account.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
