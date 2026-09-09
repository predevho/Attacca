export function LikeButton({ liked, count, onToggle }: { liked: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm ${liked ? 'text-brand-strong' : 'text-ink-muted'}`}
      // 하트는 aria-hidden이고 숫자만 남아 "3"으로만 읽히던 것을 고친다.
      // 눌림 여부는 aria-pressed가 전달하므로 이름에 넣지 않는다.
      aria-label={`좋아요 ${count}개`}
      aria-pressed={liked}
    >
      <span aria-hidden>{liked ? '♥' : '♡'}</span>
      <span>{count}</span>
    </button>
  );
}
