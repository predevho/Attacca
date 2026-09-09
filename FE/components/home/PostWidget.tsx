'use client';

import Link from 'next/link';
import type { PostSort, PublicPost } from '@/lib/home/types';

const TABS: { key: PostSort; label: string }[] = [
  { key: 'LATEST', label: '최신글' },
  { key: 'POPULAR', label: '인기글' },
];

/**
 * 홈의 게시글 위젯. 최신글·인기글 탭을 오간다.
 * 항목을 누르면 인증 경로인 상세로 간다 — 비로그인이면 미들웨어가 로그인으로 보내고,
 * 로그인 후 이 글로 되돌아온다.
 */
export function PostWidget({
  posts,
  sort,
  isLoading,
  onSortChange,
}: {
  posts: PublicPost[];
  sort: PostSort;
  isLoading: boolean;
  onSortChange: (sort: PostSort) => void;
}) {
  return (
    <section aria-label="게시글" className="min-w-0 rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-2 p-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSortChange(tab.key)}
            aria-pressed={sort === tab.key}
            className={
              sort === tab.key
                ? 'rounded-full bg-brand px-3 py-1 text-sm text-on-brand'
                : 'rounded-full bg-surface-muted px-3 py-1 text-sm text-ink-muted transition-colors hover:text-ink'
            }
          >
            {tab.label}
          </button>
        ))}
        <Link href="/feed" className="ml-auto text-sm text-ink-muted transition-colors hover:text-ink">
          피드 전체보기 →
        </Link>
      </div>

      {isLoading && <p className="px-4 pb-4 text-sm text-ink-faint">불러오는 중...</p>}

      {!isLoading && posts.length === 0 && (
        <div className="px-4 pb-6">
          {/* 빈 문구만 두면 막다른 길이다. 무엇을 할 수 있는지 함께 준다. */}
          <p className="text-sm text-ink-faint">아직 게시글이 없습니다.</p>
          <Link href="/feed" className="mt-1 inline-block text-sm text-brand-strong">
            첫 글 남기기 →
          </Link>
        </div>
      )}

      <ul>
        {posts.map((post) => (
          <li key={post.id} className="border-t border-line">
            <Link
              href={`/feed/${post.id}`}
              // 목록 행은 누를 수 있다는 신호가 전혀 없었다. 배경으로 알린다.
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-muted"
            >
              <span className="min-w-0 flex-1 truncate">{post.content}</span>
              <span className="flex shrink-0 items-center gap-1 text-sm text-ink-muted">
                {post.author?.nickname ?? '알 수 없음'}
                {post.author?.verified && (
                  <span className="rounded-full bg-brand px-1.5 py-0.5 text-xs text-on-brand">
                    인증
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-ink-muted">
                <span aria-hidden>♥</span>
                <span className="sr-only">좋아요</span> {post.likeCount} · 댓글 {post.commentCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
