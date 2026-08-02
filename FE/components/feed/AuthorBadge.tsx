import type { Author } from '@/lib/feed/types';

export function AuthorBadge({ author }: { author: Author }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-medium">{author.nickname}</span>
      {author.verified && (
        <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">인증</span>
      )}
    </span>
  );
}
