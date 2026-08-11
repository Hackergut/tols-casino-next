'use client';

import { useEffect } from 'react';

// Global error boundary: replaces the whole document when the root layout
// itself throws. Must render its own <html><body> since the layout is gone.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global-error]', error?.digest ?? '', error?.message);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0c0e17', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Application error</h1>
          <p style={{ color: '#999', maxWidth: 420 }}>
            A critical error occurred while loading the app. Refresh to try again.
          </p>
          {error?.digest ? <code style={{ fontSize: 11, color: '#666' }}>ref: {error.digest}</code> : null}
          <button onClick={reset} style={{ marginTop: 4, padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', background: '#ccff00', color: '#0c0e17' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
