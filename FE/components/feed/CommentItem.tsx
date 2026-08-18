import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { LikeButton } from '@/components/feed/LikeButton';
import { canDelete } from '@/lib/feed/logic';
import type { Comment, Me } from '@/lib/feed/types';

export function CommentItem({
  comment, me, onLike, onDelete,
}: {
  comment: Comment; me: Me | null; onLike: () => void; onDelete: () => void;
}) {
  return (
    <div className="border-b border-line py-3">
      <div className="mb-1 flex items-center justify-between text-sm text-ink-muted">
        <AuthorBadge author={comment.author} />
        {canDelete(me, comment.author.id) && (
          <button type="button" onClick={onDelete} className="text-xs text-ink-faint">삭제</button>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
      <div className="mt-1"><LikeButton liked={comment.likedByMe} count={comment.likeCount} onToggle={onLike} /></div>
    </div>
  );
}
