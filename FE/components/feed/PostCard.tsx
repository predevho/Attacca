import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { LikeButton } from '@/components/feed/LikeButton';
import type { Post } from '@/lib/feed/types';

export function PostCard({ post, onLike, onOpen }: { post: Post; onLike: () => void; onOpen: () => void }) {
  return (
    <article className="relative rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 text-sm text-ink-muted"><AuthorBadge author={post.author} /></div>
      {/*
        카드를 여는 진짜 버튼. 예전에는 `<article onClick>`이라 **마우스로만** 열렸고
        키보드·스크린리더 사용자는 상세로 갈 방법이 없었다.
        `after:inset-0`이 카드 전체를 덮어 마우스 동작은 그대로 두면서, 탭 정지는 하나만 늘린다.
        버튼 이름은 본문이라 목록에서 어느 글인지 구분된다.
      */}
      <button
        type="button"
        onClick={onOpen}
        className="block w-full cursor-pointer text-left after:absolute after:inset-0 after:rounded-lg"
      >
        <span className="whitespace-pre-wrap text-sm">{post.content}</span>
      </button>
      {/* 좋아요는 카드를 덮은 ::after 위에 있어야 눌린다. */}
      <div className="relative z-10 mt-3 flex items-center gap-4 text-sm text-ink-muted">
        <LikeButton liked={post.likedByMe} count={post.likeCount} onToggle={onLike} />
        <span>댓글 {post.commentCount}</span>
      </div>
    </article>
  );
}
