'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toRoomCursorPage, toCreateDirectRequest, toCreateGroupRequest } from '@/lib/chat/logic';
import { RoomListItem } from '@/components/chat/RoomListItem';
import { NewChatForm } from '@/components/chat/NewChatForm';
import { NewGroupForm } from '@/components/chat/NewGroupForm';
import type { CursorPage } from '@/lib/feed/types';
import type { GroupFormValues, NewChatFormValues, RoomDetail, RoomSummary, SpringPage } from '@/lib/chat/types';

function RoomList() {
  const router = useRouter();
  const fetchPage = useCallback(async (cursor: number | null): Promise<CursorPage<RoomSummary> | null> => {
    const pageNum = cursor ?? 0;
    const r = await getBff<SpringPage<RoomSummary>>(`/api/bff/chat/rooms?page=${pageNum}`);
    return r.ok ? toRoomCursorPage(r.data as SpringPage<RoomSummary>) : null;
  }, []);
  const { items, isLoading, error, loaded, hasMore, sentinelRef } = useInfiniteList<RoomSummary>(fetchPage);
  return (
    <>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-3">
        {items.map((r) => <RoomListItem key={r.id} room={r} onOpen={() => router.push(`/chat/${r.id}`)} />)}
      </div>
      {isLoading && <p className="py-4 text-center text-sm text-ink-faint">불러오는 중...</p>}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {loaded && items.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-faint">대화가 없습니다. 새 대화를 시작해 보세요.</p>
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

  async function createGroup(v: GroupFormValues) {
    setSubmitting(true);
    setError(null);
    const r = await postBff<RoomDetail>('/api/bff/chat/rooms', toCreateGroupRequest(v));
    setSubmitting(false);
    if (r.ok && r.data) router.push(`/chat/${r.data.id}`);
    else setError(r.message ?? '그룹을 만들지 못했습니다.');
  }

  if (!ready) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-faint">불러오는 중...</main>;

  return (
    <main aria-labelledby="chat-page-title" className="mx-auto mt-6 max-w-2xl px-4 pb-8 sm:mt-8 sm:px-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <h1 id="chat-page-title" className="text-2xl font-bold leading-tight">채팅</h1>
      </header>
      <section aria-label="새 채팅 시작" className="mb-7 grid gap-3 sm:grid-cols-2">
        <NewChatForm submitting={submitting} onStart={startChat} />
        <NewGroupForm submitting={submitting} onCreate={createGroup} />
      </section>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <section aria-labelledby="chat-room-list-title">
        <h2 id="chat-room-list-title" className="mb-3 text-base font-semibold">대화 목록</h2>
        <RoomList />
      </section>
    </main>
  );
}
