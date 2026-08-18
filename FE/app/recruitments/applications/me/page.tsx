'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { ApplicationCard } from '@/components/recruitment/ApplicationCard';
import type { Application, SpringPage } from '@/lib/recruitment/types';

export default function MyApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (!r.ok) router.push('/login'); });
    getBff<SpringPage<Application>>('/api/bff/recruitments/applications/me?page=0').then((r) => {
      if (r.ok) setApplications((r.data as SpringPage<Application>).content);
      setLoaded(true);
    });
  }, [router]);

  async function withdraw(applicationId: number) {
    const r = await postBff(`/api/bff/recruitments/applications/${applicationId}/withdraw`);
    if (r.ok) {
      setApplications((cur) => cur.map((a) => (a.id === applicationId ? { ...a, status: 'WITHDRAWN' as const } : a)));
    } else setError(r.message ?? '철회에 실패했습니다.');
  }

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <button type="button" onClick={() => router.push('/recruitments')} className="mb-4 text-sm text-ink-muted">← 구인</button>
      <h1 className="mb-4 text-2xl font-bold">내 지원 현황</h1>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-4">
        {applications.map((a) => (
          <ApplicationCard key={a.id} application={a}
            onWithdraw={withdraw} onOpen={() => router.push(`/recruitments/${a.postingId}`)} />
        ))}
      </div>
      {loaded && applications.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-faint">지원한 공고가 없습니다.</p>
      )}
    </main>
  );
}
