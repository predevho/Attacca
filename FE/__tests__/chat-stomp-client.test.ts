import { describe, it, expect, vi, beforeEach } from 'vitest';

// @stomp/stompjs의 Client를 목으로 대체해 배선을 검증한다.
const activate = vi.fn();
const deactivate = vi.fn();
const publish = vi.fn();
// 인자를 선언해야 subscribe.mock.calls[0][0](목적지)·[1](콜백)이 타입을 갖는다.
const subscribe = vi.fn((_destination: string, _cb: unknown) => ({ unsubscribe: vi.fn() }));
let lastConfig: Record<string, unknown> = {};
let lastClient: MockClient | null = null;
/**
 * 실제 @stomp/stompjs는 CONNECTED 프레임 전에 subscribe를 호출하면 예외를 던진다.
 * 목이 이 제약을 흉내내지 않으면 "연결 전 구독" 결함을 테스트가 통과시켜 버린다.
 */
function rememberClient(c: MockClient) { lastClient = c; }
class MockClient {
  connected = false;
  connectHeaders: Record<string, string> = {};
  constructor(config: Record<string, unknown>) { lastConfig = config; rememberClient(this); }
  activate = activate;
  deactivate = deactivate;
  publish = publish;
  subscribe = (destination: string, cb: unknown) => {
    if (!this.connected) throw new Error('There is no underlying STOMP connection');
    return subscribe(destination, cb);
  };
}
vi.mock('@stomp/stompjs', () => ({ Client: MockClient }));

/** 서버의 CONNECTED 프레임 도착을 흉내낸다. */
function simulateConnected() {
  lastClient!.connected = true;
  (lastConfig.onConnect as () => void)();
}

beforeEach(() => { vi.clearAllMocks(); lastConfig = {}; lastClient = null; });

async function load() {
  const mod = await import('@/lib/chat/stompClient');
  return mod.createChatSocket();
}

describe('stompClient', () => {
  it('connect는 brokerURL 설정 후 activate', async () => {
    const s = await load();
    s.connect();
    expect(lastConfig.brokerURL).toBeTruthy();
    expect(activate).toHaveBeenCalled();
  });

  it('beforeConnect가 ws-token을 가져와 Authorization 헤더 설정', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { token: 'TK' }, message: null }), { status: 200 })));
    const s = await load();
    s.connect();
    const before = lastConfig.beforeConnect as () => Promise<void>;
    await before();
    expect(String((lastConfig.__clientHeaders as () => string)())).toContain('Bearer TK');
    vi.unstubAllGlobals();
  });

  it('연결 전에 subscribeRoom을 호출해도 던지지 않고, 연결되면 그때 구독한다', async () => {
    const s = await load();
    s.connect();
    const onMessage = vi.fn();
    expect(() => s.subscribeRoom(3, onMessage)).not.toThrow();
    expect(subscribe).not.toHaveBeenCalled(); // 아직 CONNECTED 전
    simulateConnected();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe.mock.calls[0][0]).toBe('/topic/rooms/3');
  });

  it('재연결되면 기존 구독을 다시 건다', async () => {
    const s = await load();
    s.connect();
    s.subscribeRoom(3, vi.fn());
    simulateConnected();
    expect(subscribe).toHaveBeenCalledTimes(1);
    simulateConnected(); // 끊겼다가 재연결 → 서버측 구독은 사라졌으므로 다시 걸어야 한다
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  it('구독 해제 후 재연결되면 다시 구독하지 않는다', async () => {
    const s = await load();
    s.connect();
    const unsub = s.subscribeRoom(3, vi.fn());
    simulateConnected();
    unsub();
    simulateConnected();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('subscribeRoom은 /topic/rooms/{id} 구독, 콜백은 id 있는 메시지만 전달', async () => {
    const s = await load();
    s.connect();
    const onMessage = vi.fn();
    s.subscribeRoom(3, onMessage);
    simulateConnected();
    expect(subscribe.mock.calls[0][0]).toBe('/topic/rooms/3');
    const cb = subscribe.mock.calls[0][1] as (m: { body: string }) => void;
    cb({ body: JSON.stringify({ id: 10, roomId: 3, sender: { id: 2, nickname: 'A', verified: false }, content: 'hi', createdAt: '' }) });
    cb({ body: JSON.stringify({ type: 'TYPING', senderId: 2 }) }); // id 없음 → 무시
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0].id).toBe(10);
  });

  it('send는 /app/rooms/{id}/send로 publish', async () => {
    const s = await load();
    s.connect();
    s.send(3, '안녕');
    expect(publish).toHaveBeenCalledWith({ destination: '/app/rooms/3/send', body: JSON.stringify({ content: '안녕' }) });
  });

  it('disconnect는 deactivate', async () => {
    const s = await load();
    s.connect();
    s.disconnect();
    expect(deactivate).toHaveBeenCalled();
  });
});
