// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { proxyAuthed } = vi.hoisted(() => ({
  proxyAuthed: vi.fn(async () => new Response(null, { status: 204 })),
}));

vi.mock('@/lib/server/bffProxy', () => ({ proxyAuthed }));

describe('BFF IMPORT 어드민 라우트', () => {
  beforeEach(() => vi.clearAllMocks());

  it('목록과 최근 실행 조회의 쿼리를 BE에 그대로 전달한다', async () => {
    const { GET: list } = await import('@/app/api/bff/admin/imports/route');
    const { GET: latest } = await import('@/app/api/bff/admin/imports/runs/latest/route');

    await list(new Request('http://attacca.test/api/bff/admin/imports?status=NEW&page=2'));
    await latest(new Request('http://attacca.test/api/bff/admin/imports/runs/latest?source=KOPIS'));

    expect(proxyAuthed).toHaveBeenNthCalledWith(1, '/api/admin/imports?status=NEW&page=2');
    expect(proxyAuthed).toHaveBeenNthCalledWith(2, '/api/admin/imports/runs/latest?source=KOPIS');
  });

  it('수동 실행은 쿼리를 보존한 POST로 전달한다', async () => {
    const { POST } = await import('@/app/api/bff/admin/imports/runs/route');

    await POST(new Request('http://attacca.test/api/bff/admin/imports/runs?source=KOPIS', { method: 'POST' }));

    expect(proxyAuthed).toHaveBeenCalledWith('/api/admin/imports/runs?source=KOPIS', { method: 'POST' });
  });

  it('승인은 JSON 본문을, 거절은 빈 POST를 해당 항목 경로로 전달한다', async () => {
    const approve = await import('@/app/api/bff/admin/imports/[id]/approve/route');
    const reject = await import('@/app/api/bff/admin/imports/[id]/reject/route');

    await approve.POST(
      new Request('http://attacca.test', { method: 'POST', body: JSON.stringify({ title: '공연' }) }),
      { params: Promise.resolve({ id: '41' }) },
    );
    await reject.POST(new Request('http://attacca.test', { method: 'POST' }), { params: Promise.resolve({ id: '42' }) });

    expect(proxyAuthed).toHaveBeenNthCalledWith(1, '/api/admin/imports/41/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '공연' }),
    });
    expect(proxyAuthed).toHaveBeenNthCalledWith(2, '/api/admin/imports/42/reject', { method: 'POST' });
  });
});
