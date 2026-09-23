'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff, deleteBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toggleLike } from '@/lib/feed/logic';
import { PostCard } from '@/components/feed/PostCard';
import type { CursorPage, Post } from '@/lib/feed/types';

export default function FeedPage() {
  const router = useRouter();

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => {
      if (!r.ok) router.push('/login');
    });
  }, [router]);

  const fetchPage = useCallback(async (cursor: number | null): Promise<CursorPage<Post> | null> => {
    const qs = cursor == null ? '' : `?cursor=${cursor}`;
    const r = await getBff<CursorPage<Post>>(`/api/bff/feed/posts${qs}`);
    return r.ok ? (r.data as CursorPage<Post>) : null;
  }, []);

  const { items, setItems, isLoading, error, loaded, hasMore, sentinelRef } = useInfiniteList<Post>(fetchPage);

  async function like(post: Post) {
    const after = toggleLike(post);
    setItems((prev) => prev.map((p) => (p.id === post.id ? after : p)));
    const r = after.likedByMe
      ? await postBff(`/api/bff/feed/posts/${post.id}/like`)
      : await deleteBff(`/api/bff/feed/posts/${post.id}/like`);
    if (!r.ok) setItems((prev) => prev.map((p) => (p.id === post.id ? toggleLike(p) : p)));
  }

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">피드</h1>
        <button
          type="button"
          onClick={() => router.push('/feed/new')}
          className="rounded bg-brand px-4 py-2 text-sm text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          게시하기
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-4">
        {items.map((p) => (
          <PostCard key={p.id} post={p} onLike={() => like(p)} onOpen={() => router.push(`/feed/${p.id}`)} />
        ))}
      </div>

      {isLoading && <p className="py-4 text-center text-sm text-ink-faint">불러오는 중...</p>}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {loaded && items.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-faint">아직 게시글이 없습니다.</p>
      )}
    </main>
  );
}
