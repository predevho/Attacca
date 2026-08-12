'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { canReapply, toApplyRequest } from '@/lib/verification/logic';
import { ApplyForm } from '@/components/verification/ApplyForm';
import { MyStatusCard } from '@/components/verification/MyStatusCard';
import type { Application, ApplyFormValues } from '@/lib/verification/types';

export default function VerifiedPerformerPage() {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const r = await getBff<Application | null>('/api/bff/verified-performers/applications/me');
    if (r.ok) setApplication((r.data as Application | null) ?? null);
  }, []);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (!r.ok) router.push('/login'); });
    getBff<Application | null>('/api/bff/verified-performers/applications/me').then((r) => {
      if (r.ok) setApplication((r.data as Application | null) ?? null);
      setLoaded(true);
    });
    // 마운트 시 1회만 조회한다. router는 매 렌더마다 새 참조가 될 수 있어 의존성에서 제외한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(v: ApplyFormValues) {
    setSubmitting(true);
    setError(null);
    const r = await postBff('/api/bff/verified-performers/applications', toApplyRequest(v));
    setSubmitting(false);
    if (r.ok) { await loadStatus(); }
    else setError(r.message ?? '신청에 실패했습니다.');
  }

  if (!loaded) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  const showForm = application === null || canReapply(application.status);

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">인증 연주자</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {application && <div className="mb-4"><MyStatusCard application={application} /></div>}
      {showForm && (
        <ApplyForm submitting={submitting} submitLabel={application ? '재신청' : '신청'} onSubmit={submit} />
      )}
    </main>
  );
}
