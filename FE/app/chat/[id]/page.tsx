'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, postBff, deleteBff } from '@/lib/api';
import { MemberSearchInput } from '@/components/chat/MemberSearchInput';
import { createChatSocket } from '@/lib/chat/stompClient';
import { mergeMessages, sortByIdAsc, prependOlder, shouldStickToBottom } from '@/lib/chat/logic';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageComposer } from '@/components/chat/MessageComposer';
import type { Me } from '@/lib/feed/types';
import type { ChatMessage, RoomDetail } from '@/lib/chat/types';

// 이력 응답 타입(로컬): feed CursorPage와 동일 형태.
type History = { items: ChatMessage[]; nextCursor: number | null };

export default function ChatRoomPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const roomId = Number(params.id);

  const [me, setMe] = useState<Me | null>(null);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  // 더 불러올 과거가 있으면 커서, 없으면 null. BE 이력은 최신→과거라 이 값이 "위쪽" 커서다.
  const [olderCursor, setOlderCursor] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 다음 렌더에서 바닥으로 내릴지. 새 메시지를 받은 순간의 스크롤 위치로 판단해 둔다.
  const stickRef = useRef(true);

  // 최신 메시지 id로 읽음 처리(부수효과라 catch로 unhandled rejection 방어).
  const markRead = useCallback((msgs: ChatMessage[]) => {
    if (msgs.length === 0) return;
    const last = msgs[msgs.length - 1].id;
    postBff(`/api/bff/chat/rooms/${roomId}/read`, { lastReadMessageId: last }).catch(() => {});
  }, [roomId]);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    const socket = createChatSocket();
    socketRef.current = socket;

    async function init() {
      const detail = await getBff<RoomDetail>(`/api/bff/chat/rooms/${roomId}`);
      if (cancelled) return;
      if (!detail.ok) { setNotFound(true); return; }
      setRoom(detail.data as RoomDetail);

      const hist = await getBff<History>(`/api/bff/chat/rooms/${roomId}/messages`);
      if (cancelled) return;
      if (hist.ok) {
        const page = hist.data as History;
        const initial = sortByIdAsc(page.items);
        setMessages(initial);
        setOlderCursor(page.nextCursor);
        stickRef.current = true; // 처음 열면 최신 대화가 보여야 한다
        markRead(initial);
      }

      socket.connect({
        onConnect: () => { setConnected(true); setConnError(null); },
        onError: (m) => setConnError(m),
      });
      // 브로드캐스트 수신: 상태 업데이터는 순수하게 병합만, 읽음 처리는 업데이터 밖에서.
      unsub = socket.subscribeRoom(roomId, (incoming: ChatMessage) => {
        // 붙이기 전에 지금 위치를 봐 둔다. 붙인 뒤에는 이미 늘어난 높이라 판단할 수 없다.
        const el = scrollRef.current;
        stickRef.current = el == null || shouldStickToBottom(el);
        setMessages((cur) => mergeMessages(cur, [incoming]));
        markRead([incoming]);
      });
    }
    init();

    return () => { cancelled = true; if (unsub) unsub(); socket.disconnect(); setConnected(false); };
  }, [roomId, markRead]);

  // 바닥 고정. 이전 대화를 읽는 중이면 stickRef가 false라 건드리지 않는다.
  useEffect(() => {
    if (!stickRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (olderCursor == null || loadingOlder) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;

    const r = await getBff<History>(`/api/bff/chat/rooms/${roomId}/messages?cursor=${olderCursor}`);
    if (r.ok) {
      const page = r.data as History;
      stickRef.current = false; // 과거를 붙이는 중이다 — 바닥으로 끌어내리면 안 된다
      setMessages((cur) => prependOlder(cur, page.items));
      setOlderCursor(page.nextCursor);
      // 위로 내용이 늘어난 만큼 보정하지 않으면 읽던 자리가 아래로 밀려난다.
      requestAnimationFrame(() => {
        const now = scrollRef.current;
        if (now) now.scrollTop = now.scrollHeight - before;
      });
    }
    setLoadingOlder(false);
  }

  function sendMessage(content: string) {
    // 내가 보낸 것은 브로드캐스트로 돌아온다. 그때 바닥으로 따라가도록 표시해 둔다.
    stickRef.current = true;
    socketRef.current?.send(roomId, content);
  }

  async function invite(memberId: number) {
    const r = await postBff<RoomDetail>(`/api/bff/chat/rooms/${roomId}/participants`, { memberIds: [memberId] });
    // BE가 갱신된 방을 돌려주므로 참여자 목록이 바로 반영된다. 이미 있는 사람이면 no-op(멱등).
    if (r.ok && r.data) { setRoom(r.data as RoomDetail); setInviting(false); }
    else setActionError(r.message ?? '초대하지 못했습니다.');
  }

  async function leave() {
    // 되돌릴 수 없다(다시 들어오려면 누군가 초대해야 한다).
    if (!window.confirm('이 방에서 나갑니다. 다시 들어오려면 초대를 받아야 합니다.')) return;
    const r = await deleteBff(`/api/bff/chat/rooms/${roomId}/participants/me`);
    if (r.ok) router.push('/chat');
    else setActionError(r.message ?? '나가지 못했습니다.');
  }

  if (notFound) {
    return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-muted">없거나 접근할 수 없는 방입니다.</main>;
  }

  const isGroup = room?.type === 'GROUP';
  // DIRECT 방은 title이 없으므로 본인을 제외한 참여자 닉네임으로 헤더를 만든다.
  const headerName = room?.title
    ?? room?.participants.filter((p) => p.id !== me?.id).map((p) => p.nickname).join(', ')
    ?? '';

  return (
    <main className="mx-auto flex h-[calc(100vh-2rem)] max-w-xl flex-col px-4 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <button type="button" onClick={() => router.push('/chat')} className="text-sm text-ink-muted">← 채팅</button>
        <h1 className="font-semibold">{headerName}</h1>
        {/*
          초대·나가기는 GROUP 방에만 둔다. DIRECT에 사람을 더하면 1:1의 의미가 깨지고
          BE도 400으로 막는다(DOMAIN-CHAT-STATUTE §139). 방장은 없다 — 참여자 누구나 초대한다.
        */}
        {isGroup && (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => { setActionError(null); setInviting((v) => !v); }}
              className="text-xs text-ink-faint">초대</button>
            <button type="button" onClick={leave} className="text-xs text-ink-faint">나가기</button>
          </div>
        )}
      </div>

      {isGroup && room && (
        <div role="group" aria-label="참여자" className="mb-2 flex flex-wrap gap-1.5">
          {room.participants.map((p) => (
            <span key={p.id} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-muted">
              {p.nickname}{p.id === me?.id ? ' (나)' : ''}
            </span>
          ))}
        </div>
      )}

      {inviting && (
        <div className="mb-2 rounded border border-line p-3">
          <MemberSearchInput onPick={(m) => invite(m.id)} clearOnPick />
        </div>
      )}

      {actionError && <p role="alert" className="mb-2 text-sm text-danger">{actionError}</p>}
      {connError && <p className="mb-2 rounded bg-surface-muted px-3 py-1 text-xs text-warn">실시간 연결이 끊겼습니다. 재연결 중…</p>}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {olderCursor != null && (
          <div className="flex justify-center py-2">
            <button type="button" onClick={loadOlder} disabled={loadingOlder}
              className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-50">
              {loadingOlder ? '불러오는 중...' : '이전 메시지 더 보기'}
            </button>
          </div>
        )}
        <div className="flex flex-col gap-3 py-2">
          {messages.map((m) => <MessageBubble key={m.id} message={m} mine={me != null && m.sender.id === me.id} />)}
        </div>
      </div>

      <MessageComposer onSend={sendMessage} disabled={!connected} />
    </main>
  );
}
