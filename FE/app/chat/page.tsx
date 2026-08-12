'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toRoomCursorPage, toCreateDirectRequest } from '@/lib/chat/logic';
import { RoomListItem } from '@/components/chat/RoomListItem';
import { NewChatForm } from '@/components/chat/NewChatForm';
import type { CursorPage } from '@/lib/feed/types';
import type { NewChatFormValues, RoomDetail, RoomSummary, SpringPage } from '@/lib/chat/types';

function RoomList() {
  const router = useRouter();
  const fetchPage = useCallback(async (cursor: number | null): Promise<CursorPage<RoomSummary> | null> => {
    const pageNum = cursor ?? 0;
    const r = await getBff<SpringPage<RoomSummary>>(`/api/bff/chat/rooms?page=${pageNum}`);
    return r.ok ? toRoomCursorPage(r.data as SpringPage<RoomSummary>) : null;
  }, []);
  const { items, isLoading, error, hasMore, sentinelRef } = useInfiniteList<RoomSummary>(fetchPage);
  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-3">
        {items.map((r) => <RoomListItem key={r.id} room={r} onOpen={() => router.push(`/chat/${r.id}`)} />)}
      </div>
      {isLoading && <p className="py-4 text-center text-sm text-gray-400">불러오는 중...</p>}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {!hasMore && items.length === 0 && !isLoading && (
        <p className="py-8 text-center text-sm text-gray-400">대화가 없습니다. 새 대화를 시작해 보세요.</p>
      )}
    </>
  );
}

export default function ChatListPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setReady(true); else router.push('/login'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startChat(v: NewChatFormValues) {
    setSubmitting(true);
    setError(null);
    const r = await postBff<RoomDetail>('/api/bff/chat/rooms', toCreateDirectRequest(v));
    setSubmitting(false);
    if (r.ok && r.data) router.push(`/chat/${r.data.id}`);
    else setError(r.message ?? '대화를 시작하지 못했습니다.');
  }

  if (!ready) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">채팅</h1>
      <div className="mb-4"><NewChatForm submitting={submitting} onStart={startChat} /></div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <RoomList />
    </main>
  );
}
