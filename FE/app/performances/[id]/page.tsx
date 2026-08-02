'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getBff, deleteBff } from '@/lib/api';
import { canEdit, canDelete } from '@/lib/feed/logic';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { formatDateTime } from '@/lib/performance/logic';
import type { Me } from '@/lib/feed/types';
import type { Performance } from '@/lib/performance/types';

export default function PerformanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id;
  const posterFailed = search.get('posterFailed') === '1';

  const [me, setMe] = useState<Me | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
  }, [router]);

  useEffect(() => {
    getBff<Performance>(`/api/bff/performances/${id}`).then((r) => {
      if (r.ok) setPerformance(r.data as Performance);
      else setNotFound(true);
    });
  }, [id]);

  async function remove() {
    if (!performance) return;
    const r = await deleteBff(`/api/bff/performances/${performance.id}`);
    if (r.ok) router.push('/performances');
    else setError(r.message ?? '삭제에 실패했습니다.');
  }

  if (notFound) {
    return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-500">삭제되었거나 없는 공연입니다.</main>;
  }
  if (!performance) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <button type="button" onClick={() => router.push('/performances')} className="mb-4 text-sm text-gray-500">← 공연</button>

      {posterFailed && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          공연은 등록됐지만 포스터 업로드에 실패했습니다. 수정에서 다시 시도해 주세요.
        </p>
      )}

      {performance.posterImageUrl && (
        <img src={performance.posterImageUrl} alt="" className="mb-4 max-h-96 w-full rounded object-contain" />
      )}

      <div className="mb-3 flex items-start justify-between">
        <h1 className="text-2xl font-bold">{performance.title}</h1>
        <div className="flex gap-2">
          {canEdit(me, performance.organizer.id) && (
            <button type="button" onClick={() => router.push(`/performances/${performance.id}/edit`)} className="text-xs text-gray-400">수정</button>
          )}
          {canDelete(me, performance.organizer.id) && (
            <button type="button" onClick={remove} className="text-xs text-gray-400">삭제</button>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600"><AuthorBadge author={performance.organizer} /></div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <dl className="flex flex-col gap-2 text-sm">
        <div><dt className="text-gray-500">일시</dt><dd>{formatDateTime(performance.performedAt)}</dd></div>
        <div><dt className="text-gray-500">장소</dt><dd>{performance.venue}</dd></div>
        {performance.description && <div><dt className="text-gray-500">소개</dt><dd className="whitespace-pre-wrap">{performance.description}</dd></div>}
        {performance.program && <div><dt className="text-gray-500">프로그램</dt><dd className="whitespace-pre-wrap">{performance.program}</dd></div>}
        {performance.ticketInfo && <div><dt className="text-gray-500">관람료</dt><dd>{performance.ticketInfo}</dd></div>}
        {performance.ticketUrl && <div><dt className="text-gray-500">티켓</dt><dd><a href={performance.ticketUrl} className="text-indigo-600" target="_blank" rel="noreferrer">예매 링크</a></dd></div>}
      </dl>
    </main>
  );
}
