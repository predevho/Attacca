import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { formatDeadline } from '@/lib/recruitment/logic';
import type { Posting } from '@/lib/recruitment/types';

export function PostingCard({ posting, onOpen }: { posting: Posting; onOpen: () => void }) {
  return (
    <article onClick={onOpen} className="cursor-pointer rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate font-semibold">{posting.title}</h3>
        {posting.closed && <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-muted">마감</span>}
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
