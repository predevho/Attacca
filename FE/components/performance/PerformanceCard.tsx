import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { formatDateTime } from '@/lib/performance/logic';
import type { Performance } from '@/lib/performance/types';

export function PerformanceCard({ performance, onOpen }: { performance: Performance; onOpen: () => void }) {
  return (
    <article onClick={onOpen} className="flex cursor-pointer gap-4 rounded-lg border p-4">
      {performance.posterImageUrl
        ? <img src={performance.posterImageUrl} alt="" className="h-24 w-16 flex-shrink-0 rounded object-cover" />
        : <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center rounded bg-gray-200 text-center text-[10px] text-gray-500">포스터 없음</div>}
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{performance.title}</h3>
        <div className="mt-1 text-sm text-gray-600"><AuthorBadge author={performance.organizer} /></div>
        <p className="mt-1 text-sm text-gray-500">{formatDateTime(performance.performedAt)} · {performance.venue}</p>
      </div>
    </article>
  );
}
