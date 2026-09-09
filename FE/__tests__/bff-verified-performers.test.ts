// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const jar: Record<string, string> = { access_token: 'A' };
const cookieStore = {
  set: vi.fn((n: string, v: string) => { jar[n] = v; }),
  delete: vi.fn((n: string) => { delete jar[n]; }),
  get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
};
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

function beJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('BFF 인증 연주자 회원 라우트', () => {
  it('POST 신청은 본문을 BE로 전달', async () => {
    const f = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: { id: 1 }, error: null }));
    vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/verified-performers/applications/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ statement: 's' }) }));
    expect(res.status).toBe(200);
    expect(String(f.mock.calls[0][0])).toContain('/api/verified-performers/applications');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('GET 내 상태는 BE me 경로', async () => {
    const f = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: null, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/verified-performers/applications/me/route');
    await GET();
    expect(String(f.mock.calls[0][0])).toContain('/api/verified-performers/applications/me');
  });
});
