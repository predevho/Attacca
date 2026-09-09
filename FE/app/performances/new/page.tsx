'use client';

import Link from 'next/link';
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

  if (canRegister === null) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-faint">불러오는 중...</main>;
  if (!canRegister) {
    return (
      <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-muted">
        인증 연주자만 공연을 등록할 수 있습니다.
        <div className="mt-4"><Link href="/performances" className="text-brand-strong">공연 목록으로</Link></div>
      </main>
    );
  }

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">공연 등록</h1>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {/* label로 감싸야 파일 입력에 접근명이 생긴다(수정 화면과 같은 방식). */}
      <label className="mb-4 flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">포스터 (선택)</span>
        <input type="file" accept="image/*" onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
      </label>
      <PerformanceForm submitting={submitting} submitLabel="등록" onSubmit={submit} />
    </main>
  );
}
