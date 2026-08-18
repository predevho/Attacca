import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { LikeButton } from '@/components/feed/LikeButton';
import type { Post } from '@/lib/feed/types';

export function PostCard({ post, onLike, onOpen }: { post: Post; onLike: () => void; onOpen: () => void }) {
  return (
    <article
      onClick={onOpen}
      className="cursor-pointer rounded-lg border border-line bg-surface p-4"
    >
      <div className="mb-2 text-sm text-ink-muted"><AuthorBadge author={post.author} /></div>
      <p className="whitespace-pre-wrap text-sm">{post.content}</p>
      <div className="mt-3 flex items-center gap-4 text-sm text-ink-muted">
        <LikeButton liked={post.likedByMe} count={post.likeCount} onToggle={onLike} />
        <span>댓글 {post.commentCount}</span>
      </div>
    </article>
  );
}
