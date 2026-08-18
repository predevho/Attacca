'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, putBff } from '@/lib/api';
import { canEdit } from '@/lib/feed/logic';
import { toFormValues, toPostingRequest } from '@/lib/recruitment/logic';
import { PostingForm } from '@/components/recruitment/PostingForm';
import type { Me } from '@/lib/feed/types';
import type { InstrumentOption, Posting, PostingFormValues } from '@/lib/recruitment/types';

export default function EditRecruitmentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [posting, setPosting] = useState<Posting | null>(null);
  const [options, setOptions] = useState<InstrumentOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
    getBff('/api/bff/profile-options').then((r) => {
      if (r.ok) setOptions((r.data as { instruments: InstrumentOption[] }).instruments);
    });
    getBff<Posting>(`/api/bff/recruitments/${id}`).then((r) => {
      if (r.ok) setPosting(r.data as Posting); else router.push('/recruitments');
    });
  }, [id, router]);

  // 신원+공고 모두 로드된 뒤 작성자 아니면 상세로 되돌림.
  useEffect(() => {
    if (me && posting && !canEdit(me, posting.author.id)) router.push(`/recruitments/${posting.id}`);
  }, [me, posting, router]);

  async function submit(v: PostingFormValues) {
    if (!posting) return;
    setSubmitting(true);
    setError(null);
    const r = await putBff<Posting>(`/api/bff/recruitments/${posting.id}`, toPostingRequest(v));
    setSubmitting(false);
    if (r.ok) router.push(`/recruitments/${posting.id}`);
    else setError(r.message ?? '수정에 실패했습니다.');
  }

  if (!posting) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-faint">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">공고 수정</h1>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <PostingForm options={options} initial={toFormValues(posting)} submitting={submitting} submitLabel="저장" onSubmit={submit} />
    </main>
  );
}
