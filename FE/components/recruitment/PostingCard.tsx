import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { formatDeadline } from '@/lib/recruitment/logic';
import type { Posting } from '@/lib/recruitment/types';

export function PostingCard({ posting, onOpen }: { posting: Posting; onOpen: () => void }) {
  return (
    <article className="relative rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        {/* 제목은 heading으로 남기고 그 안의 버튼이 카드를 연다(PostCard와 같은 방식). */}
        <h3 className="min-w-0 font-semibold">
          <button
            type="button"
            onClick={onOpen}
            className="block w-full cursor-pointer truncate text-left after:absolute after:inset-0 after:rounded-lg"
          >
            {posting.title}
          </button>
        </h3>
        {posting.closed && <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-ink-muted">마감</span>}
      </div>
      <div className="mt-1 text-sm text-ink-muted"><AuthorBadge author={posting.author} /></div>
      <p className="mt-1 text-sm text-ink-muted">
        {posting.instruments.join(', ')}
        {posting.location ? ` · ${posting.location}` : ''}
        {` · 마감 ${formatDeadline(posting.deadline)}`}
      </p>
    </article>
  );
}
