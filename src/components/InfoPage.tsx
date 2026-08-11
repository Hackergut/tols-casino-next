export function InfoPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="mb-6 inline-block text-xs text-muted-foreground transition-colors hover:text-lime">← Back to TOLS</a>
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-lime">{title}</h1>
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </main>
  );
}
