export function LikeButton({ liked, count, onToggle }: { liked: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm ${liked ? 'text-brand-strong' : 'text-ink-muted'}`}
      aria-pressed={liked}
    >
      <span aria-hidden>{liked ? '♥' : '♡'}</span>
      <span>{count}</span>
    </button>
  );
}
