import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 64, fontWeight: 800, color: 'var(--color-lime, #ccff00)', letterSpacing: -2 }}>404</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Page not found</h1>
      <p style={{ color: 'var(--color-muted, #999)', maxWidth: 380, margin: 0 }}>
        This table doesn&apos;t exist. Head back to the lobby.
      </p>
      <Link href="/" style={{ marginTop: 4, padding: '10px 18px', borderRadius: 10, fontWeight: 700, background: 'var(--color-lime, #ccff00)', color: 'var(--color-bg, #0c0e17)', textDecoration: 'none' }}>
        Back to lobby
      </Link>
    </div>
  );
}
