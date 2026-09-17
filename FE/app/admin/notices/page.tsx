'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff, putBff, deleteBff } from '@/lib/api';
import { NoticeForm } from '@/components/notice/NoticeForm';
import { EMPTY_NOTICE_FORM, toFormValues, toNoticeRequest } from '@/lib/notice/logic';
import { noticeLabel, formatDateTime } from '@/lib/home/logic';
import type { Me } from '@/lib/feed/types';
import type { AdminNotice, NoticeFormValues, SpringPage } from '@/lib/notice/types';

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; notice: AdminNotice };

/**
 * 어드민 공지 관리.
 *
 * <p>BE는 처음부터 CRUD가 있었는데 화면이 없어 **공지를 올릴 방법이 없었다**(2026-09-09 발견).
 * 홈 캐러셀과 달력이 공지를 원천으로 쓰므로, 이 화면이 없으면 홈이 채워지지 않는다.
 */
export default function AdminNoticesPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await getBff<SpringPage<AdminNotice>>('/api/bff/admin/notices?page=0&size=50');
    if (r.ok) setNotices((r.data as SpringPage<AdminNotice>).content);
    else setError(r.message ?? '공지를 불러오지 못했습니다.');
    setLoading(false);
  }, []);

  // 어드민이 아니면 BE가 403을 준다. 화면에서도 먼저 걸러 빈 화면을 보여주지 않는다.
  useEffect(() => {
    getBff<Me>('/api/bff/me/identity').then((r) => {
      if (!r.ok) { router.push('/login'); return; }
      if ((r.data as Me).role !== 'ADMIN') { router.push('/'); return; }
      void load();
    });
  }, [router, load]);

  async function create(values: NoticeFormValues) {
    setPending(true);
    setError(null);
    const r = await postBff('/api/bff/admin/notices', toNoticeRequest(values));
    setPending(false);
    if (r.ok) { setMode({ kind: 'list' }); void load(); }
    else setError(r.message ?? '등록하지 못했습니다.');
  }

  async function update(id: number, values: NoticeFormValues) {
    setPending(true);
    setError(null);
    const r = await putBff(`/api/bff/admin/notices/${id}`, toNoticeRequest(values));
    setPending(false);
    if (r.ok) { setMode({ kind: 'list' }); void load(); }
    else setError(r.message ?? '수정하지 못했습니다.');
  }

  async function remove(notice: AdminNotice) {
    // 되돌릴 수 없으므로 한 번 묻는다. 목록에서 바로 사라지는 동작이라 실수하기 쉽다.
    if (!window.confirm(`"${notice.title}" 공지를 지웁니다. 되돌릴 수 없습니다.`)) return;
    setError(null);
    const r = await deleteBff(`/api/bff/admin/notices/${notice.id}`);
    if (r.ok) void load();
    else setError(r.message ?? '삭제하지 못했습니다.');
  }

  if (mode.kind === 'new' || mode.kind === 'edit') {
    const editing = mode.kind === 'edit' ? mode.notice : null;
    return (
      <main className="mx-auto mt-8 max-w-xl px-4">
        <button type="button" onClick={() => setMode({ kind: 'list' })}
          className="mb-4 rounded text-sm text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">← 공지 관리</button>
        <h1 className="mb-6 text-2xl font-bold">{editing ? '공지 수정' : '공지 등록'}</h1>
        {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}
        <NoticeForm
          initial={editing ? toFormValues(editing) : EMPTY_NOTICE_FORM}
          submitLabel={editing ? '저장' : '등록'}
          pending={pending}
          onSubmit={(v) => (editing ? update(editing.id, v) : create(v))}
          onCancel={() => setMode({ kind: 'list' })}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto mt-8 max-w-4xl px-4 pb-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">공지 관리</h1>
        <button type="button" onClick={() => { setError(null); setMode({ kind: 'new' }); }}
          className="rounded bg-brand px-3 py-1.5 text-sm text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">공지 등록</button>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-surface-muted px-4 py-3 text-sm">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}
            className="rounded text-sm font-medium text-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            공지 목록 다시 시도
          </button>
        </div>
      )}
      {loading && <p role="status" aria-live="polite" className="py-8 text-center text-sm text-ink-faint">불러오는 중...</p>}

      {!loading && notices.length === 0 && (
        <div className="border-y border-line py-12 text-center">
          <p className="text-sm text-ink-faint">등록된 공지가 없습니다.</p>
          <p className="mt-1 text-xs text-ink-faint">새 공지를 등록하면 이곳에서 관리할 수 있습니다.</p>
        </div>
      )}

      <ul aria-label="공지 목록" className="flex flex-col divide-y divide-line border-y border-line">
        {notices.map((n) => (
          <li key={n.id} className="grid min-w-0 gap-4 px-1 py-4 sm:px-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
                  {noticeLabel(n.type)}
                </span>
                {n.pinned && (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-on-brand">고정</span>
                )}
              </div>
              <h2 className="mt-2 break-words font-medium">{n.title}</h2>
              <p className="mt-1 break-words text-xs text-ink-faint">
                {n.scheduledAt ? formatDateTime(n.scheduledAt) : '일시 없음 · 달력에 표시되지 않음'}
                {n.place && ` · ${n.place}`}
              </p>
            </div>
            <div role="group" aria-label="공지 작업" className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
                <button type="button" onClick={() => { setError(null); setMode({ kind: 'edit', notice: n }); }}
                  aria-label={`"${n.title}" 수정`}
                  className="rounded text-xs text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">수정</button>
                <button type="button" onClick={() => remove(n)}
                  aria-label={`"${n.title}" 삭제`}
                  className="rounded text-xs text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">삭제</button>
              </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
