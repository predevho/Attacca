'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, putBff, putBffForm } from '@/lib/api';
import { canEdit } from '@/lib/feed/logic';
import { PerformanceForm } from '@/components/performance/PerformanceForm';
import type { Me } from '@/lib/feed/types';
import type { Performance, PerformanceFormValues } from '@/lib/performance/types';

function toFormValues(p: Performance): PerformanceFormValues {
  return {
    title: p.title, description: p.description ?? '', performedAt: p.performedAt.slice(0, 16),
    venue: p.venue, program: p.program ?? '', ticketInfo: p.ticketInfo ?? '', ticketUrl: p.ticketUrl ?? '',
  };
}

export default function EditPerformancePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
  }, [router]);

  useEffect(() => {
    getBff<Performance>(`/api/bff/performances/${id}`).then((r) => {
      if (r.ok) setPerformance(r.data as Performance);
      else router.push(`/performances/${id}`);
    });
  }, [id, router]);

  // 주최자 아니면 상세로 (신원+공연 둘 다 준비된 뒤 판정)
  useEffect(() => {
    if (me && performance && !canEdit(me, performance.organizer.id)) {
      router.push(`/performances/${performance.id}`);
    }
  }, [me, performance, router]);

  async function save(values: PerformanceFormValues) {
    setSubmitting(true);
    setError(null);
    const r = await putBff<Performance>(`/api/bff/performances/${id}`, values);
    setSubmitting(false);
    if (r.ok) router.push(`/performances/${id}`);
    else setError(r.message ?? '저장에 실패했습니다.');
  }

  async function onPoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const r = await putBffForm<Performance>(`/api/bff/performances/${id}/poster`, fd);
    setUploading(false);
    if (r.ok) setPerformance(r.data as Performance);
    else setError(r.message ?? '포스터 업로드에 실패했습니다.');
  }

  if (!performance || !me) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">공연 수정</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex items-center gap-4">
        {performance.posterImageUrl
          ? <img src={performance.posterImageUrl} alt="" className="h-24 w-16 rounded object-cover" />
          : <div className="flex h-24 w-16 items-center justify-center rounded bg-gray-200 text-[10px] text-gray-500">포스터 없음</div>}
        <label className="cursor-pointer rounded border px-3 py-1.5 text-sm">
          {uploading ? '업로드 중...' : '포스터 변경'}
          <input type="file" accept="image/*" className="hidden" onChange={onPoster} disabled={uploading} />
        </label>
      </div>

      <PerformanceForm initial={toFormValues(performance)} submitting={submitting} submitLabel="저장" onSubmit={save} />
    </main>
  );
}
