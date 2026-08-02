'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, postBff, putBff, deleteBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toggleLike, canEdit, canDelete } from '@/lib/feed/logic';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { LikeButton } from '@/components/feed/LikeButton';
import { ComposeForm } from '@/components/feed/ComposeForm';
import { CommentItem } from '@/components/feed/CommentItem';
import type { Comment, CursorPage, Me, Post } from '@/lib/feed/types';

export default function FeedDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
  }, [router]);

  useEffect(() => {
    getBff<Post>(`/api/bff/feed/posts/${postId}`).then((r) => {
      if (r.ok) setPost(r.data as Post);
      else setNotFound(true);
    });
  }, [postId]);

  const fetchComments = useCallback(async (cursor: number | null): Promise<CursorPage<Comment> | null> => {
    const qs = cursor == null ? '' : `?cursor=${cursor}`;
    const r = await getBff<CursorPage<Comment>>(`/api/bff/feed/posts/${postId}/comments${qs}`);
    return r.ok ? (r.data as CursorPage<Comment>) : null;
  }, [postId]);

  const { items: comments, setItems: setComments, isLoading, hasMore, sentinelRef } =
    useInfiniteList<Comment>(fetchComments);

  async function likePost() {
    if (!post) return;
    const before = post;
    const after = toggleLike(post);
    setPost(after);
    const r = after.likedByMe
      ? await postBff(`/api/bff/feed/posts/${post.id}/like`)
      : await deleteBff(`/api/bff/feed/posts/${post.id}/like`);
    if (!r.ok) setPost(before);
  }

  async function likeComment(c: Comment) {
    const after = toggleLike(c);
    setComments((prev) => prev.map((x) => (x.id === c.id ? after : x)));
    const r = after.likedByMe
      ? await postBff(`/api/bff/feed/comments/${c.id}/like`)
      : await deleteBff(`/api/bff/feed/comments/${c.id}/like`);
    if (!r.ok) setComments((prev) => prev.map((x) => (x.id === c.id ? c : x)));
  }

  async function addComment(content: string): Promise<boolean> {
    const r = await postBff<Comment>(`/api/bff/feed/posts/${postId}/comments`, { content });
    if (r.ok) setComments((prev) => [...prev, r.data as Comment]);
    return r.ok;
  }

  async function deleteComment(c: Comment) {
    const r = await deleteBff(`/api/bff/feed/comments/${c.id}`);
    if (r.ok) setComments((prev) => prev.filter((x) => x.id !== c.id));
    else setError('댓글 삭제에 실패했습니다.');
  }

  async function saveEdit() {
    if (!post) return;
    const r = await putBff<Post>(`/api/bff/feed/posts/${post.id}`, { content: draft });
    if (r.ok) { setPost(r.data as Post); setEditing(false); setError(null); }
    else setError(r.message ?? '수정에 실패했습니다.');
  }

  async function deletePost() {
    if (!post) return;
    const r = await deleteBff(`/api/bff/feed/posts/${post.id}`);
    if (r.ok) router.push('/feed');
    else setError(r.message ?? '삭제에 실패했습니다.');
  }

  if (notFound) {
    return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-500">삭제되었거나 없는 게시글입니다.</main>;
  }
  if (!post) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <button type="button" onClick={() => router.push('/feed')} className="mb-4 text-sm text-gray-500">← 피드</button>

      <article className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
          <AuthorBadge author={post.author} />
          <div className="flex gap-2">
            {canEdit(me, post.author.id) && !editing && (
              <button type="button" onClick={() => { setDraft(post.content); setEditing(true); }} className="text-xs text-gray-400">수정</button>
            )}
            {canDelete(me, post.author.id) && (
              <button type="button" onClick={deletePost} className="text-xs text-gray-400">삭제</button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)}
              className="min-h-24 w-full rounded border px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button type="button" onClick={saveEdit} className="rounded bg-black px-4 py-2 text-sm text-white">저장</button>
              <button type="button" onClick={() => { setEditing(false); setError(null); }} className="rounded border px-4 py-2 text-sm">취소</button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{post.content}</p>
        )}

        <div className="mt-3"><LikeButton liked={post.likedByMe} count={post.likeCount} onToggle={likePost} /></div>
      </article>

      {error && <p className="my-3 text-sm text-red-600">{error}</p>}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-gray-500">댓글</h2>
        <div className="mb-4 rounded-lg border p-3">
          <ComposeForm placeholder="댓글을 입력하세요" maxLength={500} buttonLabel="댓글 작성" onSubmit={addComment} />
        </div>
        <div className="flex flex-col">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} me={me} onLike={() => likeComment(c)} onDelete={() => deleteComment(c)} />
          ))}
        </div>
        {isLoading && <p className="py-3 text-center text-sm text-gray-400">불러오는 중...</p>}
        {hasMore && <div ref={sentinelRef} className="h-8" />}
        {!hasMore && comments.length === 0 && !isLoading && (
          <p className="py-4 text-center text-sm text-gray-400">첫 댓글을 남겨보세요.</p>
        )}
      </section>
    </main>
  );
}
