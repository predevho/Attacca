import { Client, type IMessage, type StompConfig, type StompSubscription } from '@stomp/stompjs';
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

/** 방 하나에 대한 구독 요청. 실제 STOMP 구독(sub)은 연결된 뒤에야 생긴다. */
type RoomSubscription = {
  roomId: number;
  onMessage: (m: ChatMessage) => void;
  sub: StompSubscription | null;
};

export function createChatSocket(): ChatSocket {
  let client: Client | null = null;
  // 구독 요청 목록. STOMP는 CONNECTED 프레임 전에 구독할 수 없고,
  // 재연결하면 서버측 구독도 사라지므로 연결될 때마다 이 목록으로 다시 건다.
  const rooms: RoomSubscription[] = [];

  /** 연결돼 있고 아직 구독 전이면 실제 STOMP 구독을 건다. */
  function bind(room: RoomSubscription) {
    if (!client?.connected || room.sub) return;
    room.sub = client.subscribe(`/topic/rooms/${room.roomId}`, (msg: IMessage) => {
      const data = JSON.parse(msg.body);
      // 실 메시지는 숫자 id를 가진다. typing 등 비메시지 프레임은 무시.
      if (data && typeof data.id === 'number') room.onMessage(data as ChatMessage);
    });
  }

  function connect(handlers?: { onConnect?: () => void; onError?: (msg: string) => void }) {
    const c = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 3000,
      beforeConnect: async () => {
        const token = await fetchWsToken();
        c.connectHeaders = { Authorization: `Bearer ${token}` };
      },
      onConnect: () => {
        // 재연결이면 이전 구독 핸들은 무효다. 초기화 후 다시 건다.
        rooms.forEach((room) => { room.sub = null; bind(room); });
        handlers?.onConnect?.();
      },
      onStompError: (frame) => handlers?.onError?.(frame.headers['message'] ?? '실시간 연결 오류'),
      onWebSocketError: () => handlers?.onError?.('실시간 연결 오류'),
      // 테스트 훅: beforeConnect가 갱신한 헤더를 검증할 수 있게 노출(런타임 무해).
      __clientHeaders: () => c.connectHeaders?.Authorization ?? '',
    } as ChatStompConfig);
    client = c;
    c.activate();
  }

  function subscribeRoom(roomId: number, onMessage: (m: ChatMessage) => void): () => void {
    const room: RoomSubscription = { roomId, onMessage, sub: null };
    rooms.push(room);
    bind(room); // 이미 연결돼 있으면 즉시, 아니면 onConnect에서 걸린다.
    return () => {
      room.sub?.unsubscribe();
      room.sub = null;
      const i = rooms.indexOf(room);
      if (i >= 0) rooms.splice(i, 1);
    };
  }

  function send(roomId: number, content: string) {
    client?.publish({ destination: `/app/rooms/${roomId}/send`, body: JSON.stringify({ content }) });
  }

  function disconnect() {
    client?.deactivate();
    client = null;
    rooms.length = 0;
  }

  return { connect, subscribeRoom, send, disconnect };
}
