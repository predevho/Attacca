import { describe, it, expect, vi, beforeEach } from 'vitest';

// @stomp/stompjs의 Client를 목으로 대체해 배선을 검증한다.
const activate = vi.fn();
const deactivate = vi.fn();
const publish = vi.fn();
const subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
let lastConfig: Record<string, unknown> = {};
class MockClient {
  connectHeaders: Record<string, string> = {};
  constructor(config: Record<string, unknown>) { lastConfig = config; }
  activate = activate;
  deactivate = deactivate;
  publish = publish;
  subscribe = subscribe;
}
vi.mock('@stomp/stompjs', () => ({ Client: MockClient }));

beforeEach(() => { vi.clearAllMocks(); lastConfig = {}; });

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

  it('subscribeRoom은 /topic/rooms/{id} 구독, 콜백은 id 있는 메시지만 전달', async () => {
    const s = await load();
    s.connect();
    const onMessage = vi.fn();
    s.subscribeRoom(3, onMessage);
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
