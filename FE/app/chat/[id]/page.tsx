'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { createChatSocket } from '@/lib/chat/stompClient';
import { mergeMessages, sortByIdAsc } from '@/lib/chat/logic';
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
  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);

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
        const initial = sortByIdAsc((hist.data as History).items);
        setMessages(initial);
        markRead(initial);
      }

      socket.connect({
        onConnect: () => { setConnected(true); setConnError(null); },
        onError: (m) => setConnError(m),
      });
      // 브로드캐스트 수신: 상태 업데이터는 순수하게 병합만, 읽음 처리는 업데이터 밖에서.
      unsub = socket.subscribeRoom(roomId, (incoming: ChatMessage) => {
        setMessages((cur) => mergeMessages(cur, [incoming]));
        markRead([incoming]);
      });
    }
    init();

    return () => { cancelled = true; if (unsub) unsub(); socket.disconnect(); setConnected(false); };
  }, [roomId, markRead]);

  function sendMessage(content: string) {
    socketRef.current?.send(roomId, content);
  }

  if (notFound) {
    return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-muted">없거나 접근할 수 없는 방입니다.</main>;
  }

  // DIRECT 방은 title이 없으므로 본인을 제외한 참여자 닉네임으로 헤더를 만든다.
  const headerName = room?.title
    ?? room?.participants.filter((p) => p.id !== me?.id).map((p) => p.nickname).join(', ')
    ?? '';

  return (
    <main className="mx-auto flex h-[calc(100vh-2rem)] max-w-xl flex-col px-4 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <button type="button" onClick={() => router.push('/chat')} className="text-sm text-ink-muted">← 채팅</button>
        <h1 className="font-semibold">{headerName}</h1>
      </div>
      {connError && <p className="mb-2 rounded bg-surface-muted px-3 py-1 text-xs text-warn">실시간 연결이 끊겼습니다. 재연결 중…</p>}

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 py-2">
          {messages.map((m) => <MessageBubble key={m.id} message={m} mine={me != null && m.sender.id === me.id} />)}
        </div>
      </div>

      <MessageComposer onSend={sendMessage} disabled={!connected} />
    </main>
  );
}
