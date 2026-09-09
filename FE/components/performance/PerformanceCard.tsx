import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { formatDateTime } from '@/lib/performance/logic';
import type { Performance } from '@/lib/performance/types';

export function PerformanceCard({ performance, onOpen }: { performance: Performance; onOpen: () => void }) {
  return (
    <article className="relative flex gap-4 rounded-lg border border-line bg-surface p-4">
      {performance.posterImageUrl
        ? <img src={performance.posterImageUrl} alt="" className="h-24 w-16 flex-shrink-0 rounded object-cover" />
        : <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center rounded bg-surface-muted text-center text-xs text-ink-muted">포스터 없음</div>}
      <div className="min-w-0">
        {/* 제목은 heading으로 남기고 그 안의 버튼이 카드를 연다(PostCard와 같은 방식). */}
        <h3 className="font-semibold">
          <button
            type="button"
            onClick={onOpen}
            className="block w-full cursor-pointer truncate text-left after:absolute after:inset-0 after:rounded-lg"
          >
            {performance.title}
          </button>
        </h3>
        <div className="mt-1 text-sm text-ink-muted"><AuthorBadge author={performance.organizer} /></div>
        <p className="mt-1 text-sm text-ink-muted">{formatDateTime(performance.performedAt)} · {performance.venue}</p>
      </div>
    </article>
  );
}
