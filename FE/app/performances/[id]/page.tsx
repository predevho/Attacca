'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getBff, deleteBff } from '@/lib/api';
import { canEdit, canDelete } from '@/lib/feed/logic';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { formatDateTime } from '@/lib/performance/logic';
import type { Me } from '@/lib/feed/types';
import type { Performance } from '@/lib/performance/types';
import { isHttpUrl } from '@/lib/url';

export default function PerformanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id;
  const posterFailed = search.get('posterFailed') === '1';

  // undefined = 아직 모름, null = 비로그인. 어느 경로로 상세를 읽을지 정하는 데 쓴다.
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 실패해도 로그인으로 보내지 않는다. 이 화면은 비로그인도 볼 수 있어야 한다.
  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => setMe(r.ok ? (r.data as Me) : null));
  }, []);

  // 로그인했으면 인증 경로로 읽는다 — 공개 응답에는 주최자의 회원 id가 없어서
  // 본인이어도 수정·삭제 버튼을 띄울 수 없기 때문이다(PublicMemberDisplay).
  // 비로그인이면 공개 경로로 읽는다.
  useEffect(() => {
    if (me === undefined) return;
    const path = me ? `/api/bff/performances/${id}` : `/api/bff/public/performances/${id}`;
    getBff<Performance>(path).then((r) => {
      if (r.ok) setPerformance(r.data as Performance);
      else setNotFound(true);
    });
  }, [id, me]);

  async function remove() {
    if (!performance) return;
    const r = await deleteBff(`/api/bff/performances/${performance.id}`);
    if (r.ok) router.push('/performances');
    else setError(r.message ?? '삭제에 실패했습니다.');
  }

  if (notFound) {
    return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-muted">삭제되었거나 없는 공연입니다.</main>;
  }
  if (!performance) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-faint">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-6 max-w-3xl px-4 pb-10 sm:mt-8" aria-label={`${performance.title} 공연 상세`}>
      <button
        type="button"
        onClick={() => router.push('/performances')}
        aria-label="공연 목록으로 돌아가기"
        className="mb-5 inline-flex min-h-10 items-center rounded px-2 text-sm text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        ← 공연 목록
      </button>

      {posterFailed && (
        <p className="mb-4 rounded border border-warn bg-surface-muted px-3 py-2 text-sm text-warn">
          공연은 등록됐지만 포스터 업로드에 실패했습니다. 수정에서 다시 시도해 주세요.
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-start sm:gap-8">
        {performance.posterImageUrl && (
          <img src={performance.posterImageUrl} alt={`${performance.title} 포스터`} className="max-h-[28rem] w-full rounded object-contain sm:max-h-80" />
        )}

        <div className={performance.posterImageUrl ? '' : 'sm:col-span-2'}>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="min-w-0 break-words text-2xl font-bold leading-tight">{performance.title}</h1>
            <div className="flex shrink-0 gap-1" aria-label="공연 관리 작업">
          {canEdit(me ?? null, performance.organizer.id) && (
            <button type="button" onClick={() => router.push(`/performances/${performance.id}/edit`)} aria-label="공연 수정" className="min-h-10 rounded px-3 text-sm text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">수정</button>
          )}
          {canDelete(me ?? null, performance.organizer.id) && (
            <button type="button" onClick={remove} aria-label="공연 삭제" className="min-h-10 rounded px-3 text-sm text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">삭제</button>
          )}
            </div>
          </div>

          <div className="mb-5 text-sm text-ink-muted"><AuthorBadge author={performance.organizer} /></div>

          {error && <p className="mb-3 text-sm text-danger" role="alert">{error}</p>}

          <dl className="grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2">
            <div><dt className="mb-1 text-xs font-medium text-ink-muted">일시</dt><dd>{formatDateTime(performance.performedAt)}</dd></div>
            <div><dt className="mb-1 text-xs font-medium text-ink-muted">장소</dt><dd>{performance.venue}</dd></div>
            {performance.ticketInfo && <div><dt className="mb-1 text-xs font-medium text-ink-muted">관람료</dt><dd>{performance.ticketInfo}</dd></div>}
            {performance.ticketUrl && (
              <div>
                <dt className="mb-1 text-xs font-medium text-ink-muted">티켓</dt>
                <dd>
                  {isHttpUrl(performance.ticketUrl)
                    ? <a href={performance.ticketUrl} aria-label="티켓 예매하기 (새 창)" className="inline-flex min-h-10 items-center rounded bg-brand px-3 text-sm font-medium text-on-brand underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" target="_blank" rel="noreferrer">티켓 예매하기 ↗</a>
                    : <span className="text-ink-muted">{performance.ticketUrl}</span>}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {(performance.description || performance.program) && (
        <div className="mt-8 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
          {performance.description && <section><h2 className="mb-2 text-sm font-semibold">소개</h2><p className="whitespace-pre-wrap text-sm leading-6">{performance.description}</p></section>}
          {performance.program && <section><h2 className="mb-2 text-sm font-semibold">프로그램</h2><p className="whitespace-pre-wrap text-sm leading-6">{performance.program}</p></section>}
        </div>
      )}
    </main>
  );
}
