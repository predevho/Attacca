import { Client, type IMessage, type StompConfig } from '@stomp/stompjs';
import type { ChatMessage } from '@/lib/chat/types';

const WS_URL = process.env.NEXT_PUBLIC_BE_WS_URL ?? 'ws://localhost:8080/ws';

export type ChatSocket = {
  connect: (handlers?: { onConnect?: () => void; onError?: (msg: string) => void }) => void;
  subscribeRoom: (roomId: number, onMessage: (m: ChatMessage) => void) => () => void;
  send: (roomId: number, content: string) => void;
  disconnect: () => void;
};

/**
 * 테스트 전용 훅이 추가된 StompConfig.
 * beforeConnect가 비동기로 갱신한 connectHeaders를 테스트에서 검증할 수 있도록
 * 게터 함수를 config에 함께 실어 보낸다. 런타임 동작에는 영향이 없다.
 */
type ChatStompConfig = StompConfig & { __clientHeaders?: () => string };

/** BFF에서 STOMP CONNECT용 토큰을 가져온다. */
async function fetchWsToken(): Promise<string> {
  const res = await fetch('/api/bff/chat/ws-token');
  const body = await res.json();
  if (!body?.ok || !body?.data?.token) throw new Error('WS 토큰을 가져오지 못했습니다.');
  return body.data.token as string;
}

export function createChatSocket(): ChatSocket {
  let client: Client | null = null;

  function connect(handlers?: { onConnect?: () => void; onError?: (msg: string) => void }) {
    const c = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 3000,
      beforeConnect: async () => {
        const token = await fetchWsToken();
        c.connectHeaders = { Authorization: `Bearer ${token}` };
      },
      onConnect: () => handlers?.onConnect?.(),
      onStompError: (frame) => handlers?.onError?.(frame.headers['message'] ?? '실시간 연결 오류'),
      onWebSocketError: () => handlers?.onError?.('실시간 연결 오류'),
      // 테스트 훅: beforeConnect가 갱신한 헤더를 검증할 수 있게 노출(런타임 무해).
      __clientHeaders: () => c.connectHeaders?.Authorization ?? '',
    } as ChatStompConfig);
    client = c;
    c.activate();
  }

  function subscribeRoom(roomId: number, onMessage: (m: ChatMessage) => void): () => void {
    const sub = client!.subscribe(`/topic/rooms/${roomId}`, (msg: IMessage) => {
      const data = JSON.parse(msg.body);
      // 실 메시지는 숫자 id를 가진다. typing 등 비메시지 프레임은 무시.
      if (data && typeof data.id === 'number') onMessage(data as ChatMessage);
    });
    return () => sub.unsubscribe();
  }

  function send(roomId: number, content: string) {
    client?.publish({ destination: `/app/rooms/${roomId}/send`, body: JSON.stringify({ content }) });
  }

  function disconnect() {
    client?.deactivate();
    client = null;
  }

  return { connect, subscribeRoom, send, disconnect };
}
