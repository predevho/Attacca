'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ComposeForm } from '@/components/feed/ComposeForm';
import { getBff, postBff } from '@/lib/api';
import type { Post } from '@/lib/feed/types';

export default function FeedNewPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((response) => {
      if (response.ok) setReady(true);
      else router.push('/login');
    });
  }, [router]);

  async function createPost(content: string, attachmentIds: number[] = []): Promise<boolean> {
    setError(null);
    const response = await postBff<Post>('/api/bff/feed/posts', { content, attachmentIds });
    if (response.ok && response.data) {
      router.push(`/feed/${response.data.id}`);
      return true;
    }
    setError(response.message ?? '게시글을 작성하지 못했습니다. 다시 시도해 주세요.');
    return false;
  }

  if (!ready) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-faint">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <button
        type="button"
        onClick={() => router.push('/feed')}
        className="mb-6 rounded px-1 text-sm text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        ← 피드
      </button>
      <h1 className="mb-4 text-2xl font-bold">게시글 작성</h1>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      <div className="rounded-lg border border-line bg-surface p-4">
        <ComposeForm
          placeholder="게시글 내용"
          maxLength={2000}
          buttonLabel="게시"
          allowAttachments
          onSubmit={createPost}
        />
      </div>
    </main>
  );
}
