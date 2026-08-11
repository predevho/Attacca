'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { toPostingRequest } from '@/lib/recruitment/logic';
import { PostingForm } from '@/components/recruitment/PostingForm';
import type { InstrumentOption, Posting, PostingFormValues } from '@/lib/recruitment/types';

export default function NewRecruitmentPage() {
  const router = useRouter();
  const [options, setOptions] = useState<InstrumentOption[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setReady(true); else router.push('/login'); });
    getBff('/api/bff/profile-options').then((r) => {
      if (r.ok) setOptions((r.data as { instruments: InstrumentOption[] }).instruments);
    });
  }, [router]);

  async function submit(v: PostingFormValues) {
    setSubmitting(true);
    setError(null);
    const r = await postBff<Posting>('/api/bff/recruitments', toPostingRequest(v));
    setSubmitting(false);
    if (r.ok && r.data) router.push(`/recruitments/${r.data.id}`);
    else setError(r.message ?? '등록에 실패했습니다.');
  }

  if (!ready) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">공고 등록</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <PostingForm options={options} submitting={submitting} submitLabel="등록" onSubmit={submit} />
    </main>
  );
}
