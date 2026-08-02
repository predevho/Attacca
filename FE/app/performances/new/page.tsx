'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff, putBffForm } from '@/lib/api';
import { PerformanceForm } from '@/components/performance/PerformanceForm';
import type { Me } from '@/lib/feed/types';
import type { Performance, PerformanceFormValues } from '@/lib/performance/types';

export default function NewPerformancePage() {
  const router = useRouter();
  const [canRegister, setCanRegister] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poster, setPoster] = useState<File | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => {
      if (r.ok) {
        const me = r.data as Me;
        setCanRegister(me.verified || me.role === 'ADMIN');
      } else router.push('/login');
    });
  }, [router]);

  async function submit(values: PerformanceFormValues) {
    setSubmitting(true);
    setError(null);
    const created = await postBff<Performance>('/api/bff/performances', values);
    if (!created.ok) { setSubmitting(false); setError(created.message ?? '등록에 실패했습니다.'); return; }
    const id = (created.data as Performance).id;

    if (poster) {
      const fd = new FormData();
      fd.append('file', poster);
      const up = await putBffForm(`/api/bff/performances/${id}/poster`, fd);
      if (!up.ok) { router.push(`/performances/${id}?posterFailed=1`); return; }
    }
    router.push(`/performances/${id}`);
  }

  if (canRegister === null) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;
  if (!canRegister) {
    return (
      <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-500">
        인증 연주자만 공연을 등록할 수 있습니다.
        <div className="mt-4"><a href="/performances" className="text-indigo-600">공연 목록으로</a></div>
      </main>
    );
  }

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">공연 등록</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="mb-4 flex flex-col gap-1 text-sm">
        <span className="text-gray-500">포스터 (선택)</span>
        <input type="file" accept="image/*" onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
      </div>
      <PerformanceForm submitting={submitting} submitLabel="등록" onSubmit={submit} />
    </main>
  );
}
