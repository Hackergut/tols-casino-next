export default function Loading() {
  return (
    <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        aria-label="Loading"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid color-mix(in oklab, var(--color-lime, #ccff00) 25%, transparent)',
          borderTopColor: 'var(--color-lime, #ccff00)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
