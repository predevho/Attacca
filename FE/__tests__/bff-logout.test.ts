// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/server/cookies';

const jar: Record<string, string> = {};
const cookieStore = {
  set: vi.fn((n: string, v: string) => { jar[n] = v; }),
  delete: vi.fn((n: string) => { delete jar[n]; }),
  get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
};
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(jar)) delete jar[k];
});
afterEach(() => vi.unstubAllGlobals());

function beJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}

describe('BFF 로그아웃', () => {
  it('BE에 refresh 철회를 알리고 쿠키를 지운다', async () => {
    // 쿠키만 지우면 탈취된 refresh가 만료까지 유효하다 — 그래서 BE 호출이 필요하다.
    jar[ACCESS_COOKIE] = 'a';
    jar[REFRESH_COOKIE] = 'r';
    const f = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: null, error: null }));
    vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/logout/route');

    const res = await POST();

    expect(res.status).toBe(200);
    expect(String(f.mock.calls[0][0])).toContain('/api/auth/logout');
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).toEqual({ refreshToken: 'r' });
    expect(jar[ACCESS_COOKIE]).toBeUndefined();
    expect(jar[REFRESH_COOKIE]).toBeUndefined();
  });

  it('BE 호출이 실패해도 쿠키는 지운다', async () => {
    // 사용자 입장에서 로그아웃은 언제나 성공해야 한다.
    jar[ACCESS_COOKIE] = 'a';
    jar[REFRESH_COOKIE] = 'r';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    const { POST } = await import('@/app/api/bff/logout/route');

    const res = await POST();

    expect(res.status).toBe(200);
    expect(jar[ACCESS_COOKIE]).toBeUndefined();
    expect(jar[REFRESH_COOKIE]).toBeUndefined();
  });

  it('refresh 쿠키가 없으면 BE를 부르지 않는다', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/logout/route');

    const res = await POST();

    expect(res.status).toBe(200);
    expect(f).not.toHaveBeenCalled();
  });
});
