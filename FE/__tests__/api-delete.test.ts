import { describe, it, expect, vi, afterEach } from 'vitest';
import { deleteBff } from '@/lib/api';

afterEach(() => vi.unstubAllGlobals());

describe('deleteBff', () => {
  it('DELETE 메서드로 호출하고 BffResult를 반환한다', async () => {
    const fetchMock = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ ok: true, data: null, message: null }),
      { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await deleteBff('/api/bff/feed/posts/1/like');

    expect(res.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/bff/feed/posts/1/like');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });
});
