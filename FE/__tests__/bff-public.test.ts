// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 공개 라우트는 쿠키를 읽지 않아야 한다. 읽으면 이 목이 호출된 것으로 잡힌다.
const cookies = vi.fn();
vi.mock('next/headers', () => ({ cookies }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

function beJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function pageBody<T>(content: T[]) {
  return {
    success: true,
    data: { content, page: 0, size: 20, totalElements: content.length, totalPages: 1, first: true, last: true },
    error: null,
  };
}

describe('BFF 공개 라우트', () => {
  it('공지 목록은 쿼리를 BE 공개 경로로 전달한다', async () => {
    const f = vi.fn(async () => beJson(pageBody([])));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/public/notices/route');

    const res = await GET(new Request('http://x/api/bff/public/notices?scope=PINNED&size=5'));

    expect(res.status).toBe(200);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/public/notices');
    expect(url).toContain('scope=PINNED');
  });

  it('공연 목록도 마찬가지다', async () => {
    const f = vi.fn(async () => beJson(pageBody([])));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/public/performances/route');

    await GET(new Request('http://x/api/bff/public/performances?scope=UPCOMING&size=3'));

    expect(String(f.mock.calls[0][0])).toContain('/api/public/performances?scope=UPCOMING');
  });

  it('게시글 목록은 sort를 전달한다', async () => {
    const f = vi.fn(async () => beJson(pageBody([])));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/public/feed/posts/route');

    await GET(new Request('http://x/api/bff/public/feed/posts?sort=POPULAR&size=8'));

    expect(String(f.mock.calls[0][0])).toContain('/api/public/feed/posts?sort=POPULAR');
  });

  it('공개 라우트는 쿠키를 읽지 않는다', async () => {
    // 토큰이 있든 없든 같은 응답이어야 한다. 쿠키를 읽는 순간 그 보장이 깨진다.
    vi.stubGlobal('fetch', vi.fn(async () => beJson(pageBody([]))));
    const { GET } = await import('@/app/api/bff/public/notices/route');

    await GET(new Request('http://x/api/bff/public/notices'));

    expect(cookies).not.toHaveBeenCalled();
  });

  it('BE 연결 실패는 502로 내린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    const { GET } = await import('@/app/api/bff/public/notices/route');

    const res = await GET(new Request('http://x/api/bff/public/notices'));

    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBe(false);
  });
});

describe('BFF 달력 합본', () => {
  const PERFORMANCE = {
    id: 1, organizer: { nickname: '주최자', verified: true }, title: '공연',
    description: null, performedAt: '2026-09-26T19:30:00', venue: '한강아트홀',
    program: null, ticketInfo: null, ticketUrl: null, posterImageUrl: null,
    createdAt: '2026-09-01T00:00:00',
  };
  const NOTICE = {
    id: 2, type: 'EVENT', title: '심사 발표', content: '본문',
    scheduledAt: '2026-09-16T10:00:00', place: '온라인', coverImageUrl: null,
    createdAt: '2026-09-01T00:00:00',
  };

  it('공연과 공지를 각각 조회해 시각순 한 벌로 합친다', async () => {
    const f = vi.fn(async (url: string) =>
      String(url).includes('/api/public/performances')
        ? beJson(pageBody([PERFORMANCE]))
        : beJson(pageBody([NOTICE])));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/public/calendar/route');

    const res = await GET(new Request(
      'http://x/api/bff/public/calendar?from=2026-09-01T00:00:00&to=2026-10-01T00:00:00'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.map((e: { title: string }) => e.title)).toEqual(['심사 발표', '공연']);
    expect(body.data[1].href).toBe('/performances/1');
    // 두 도메인을 같은 scope/범위로 부른다.
    for (const call of f.mock.calls) {
      expect(String(call[0])).toContain('scope=SCHEDULED');
    }
  });

  it('범위가 없으면 400으로 막는다', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { GET } = await import('@/app/api/bff/public/calendar/route');

    const res = await GET(new Request('http://x/api/bff/public/calendar'));

    expect(res.status).toBe(400);
  });

  it('한쪽이라도 실패하면 반쪽 달력을 그리지 않는다', async () => {
    // 빠진 일정이 "없는 일정"으로 보이면 안 된다.
    const f = vi.fn(async (url: string) =>
      String(url).includes('/api/public/performances')
        ? beJson(pageBody([PERFORMANCE]))
        : beJson({ success: false, data: null, error: { resultCode: '500-01', code: 'X', message: '실패' } }, 500));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/public/calendar/route');

    const res = await GET(new Request(
      'http://x/api/bff/public/calendar?from=2026-09-01T00:00:00&to=2026-10-01T00:00:00'));

    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
  });
});
