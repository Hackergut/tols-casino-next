'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

// Route-level error boundary. Catches errors thrown in any route segment and
// shows a branded recovery UI instead of the raw Next.js error page. The
// "Try again" button resets the error boundary (Next re-renders the route).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep a server-side breadcrumb in the dev console; production should
    // forward this to the structured logger when one is wired in.
    console.error('[route-error]', error?.digest ?? '', error?.message);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'color-mix(in oklab, var(--color-loss, #ff4d5e) 14%, transparent)',
          color: 'var(--color-loss, #ff4d5e)',
        }}
      >
        <RotateCcw size={28} />
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
      <p style={{ color: 'var(--color-muted, #999)', maxWidth: 420, margin: 0 }}>
        The page hit an unexpected error. Your balance and account are unaffected.
      </p>
      {error?.digest ? (
        <code style={{ fontSize: 11, color: 'var(--color-muted, #999)' }}>ref: {error.digest}</code>
      ) : null}
      <button
        onClick={reset}
        style={{
          marginTop: 4,
          padding: '10px 18px',
          borderRadius: 10,
          border: 'none',
          fontWeight: 700,
          cursor: 'pointer',
          background: 'var(--color-lime, #ccff00)',
          color: 'var(--color-bg, #0c0e17)',
        }}
      >
        Try again
      </button>
    </div>
  );
}
