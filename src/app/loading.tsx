export default function Loading() {
  return (
    <div role="status" aria-label="Loading page">
      <div className="loading-bar" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
