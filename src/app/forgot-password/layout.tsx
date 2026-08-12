import type { Metadata } from "next";

// Server layout to give the (client) forgot-password page its own title and
// keep it out of search indexes.
export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset link for your TOLS Casino account.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
