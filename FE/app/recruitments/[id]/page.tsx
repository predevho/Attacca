'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, postBff, deleteBff } from '@/lib/api';
import { canEdit, canDelete } from '@/lib/feed/logic';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { ApplyPanel } from '@/components/recruitment/ApplyPanel';
import { ApplicantList } from '@/components/recruitment/ApplicantList';
import { formatDeadline } from '@/lib/recruitment/logic';
import type { Me } from '@/lib/feed/types';
import type { Application, Posting, SpringPage } from '@/lib/recruitment/types';

export default function RecruitmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [posting, setPosting] = useState<Posting | null>(null);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [applied, setApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
  }, [router]);

  useEffect(() => {
    getBff<Posting>(`/api/bff/recruitments/${id}`).then((r) => {
      if (r.ok) setPosting(r.data as Posting); else setNotFound(true);
    });
  }, [id]);

  const isAuthor = me != null && posting != null && me.id === posting.author.id;

  // 작성자면 지원자 첫 페이지 로드.
  useEffect(() => {
    if (isAuthor && posting) {
      getBff<SpringPage<Application>>(`/api/bff/recruitments/${posting.id}/applications?page=0`).then((r) => {
        if (r.ok) setApplicants((r.data as SpringPage<Application>).content);
      });
    }
  }, [isAuthor, posting]);

  async function apply(message: string) {
    if (!posting) return;
    setSubmitting(true);
    setError(null);
    const r = await postBff(`/api/bff/recruitments/${posting.id}/applications`, { message });
    setSubmitting(false);
    if (r.ok) setApplied(true);
    else setError(r.message ?? '지원에 실패했습니다.');
  }

  async function decide(applicationId: number, action: 'accept' | 'reject') {
    const r = await postBff(`/api/bff/recruitments/applications/${applicationId}/${action}`);
    if (r.ok) {
      setApplicants((cur) => cur.map((a) =>
        a.id === applicationId ? { ...a, status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' } : a));
    } else setError(r.message ?? '처리에 실패했습니다.');
  }

  async function close() {
    if (!posting) return;
    const r = await postBff(`/api/bff/recruitments/${posting.id}/close`);
    if (r.ok) setPosting({ ...posting, status: 'CLOSED', closed: true });
    else setError(r.message ?? '마감에 실패했습니다.');
  }

  async function remove() {
    if (!posting) return;
    const r = await deleteBff(`/api/bff/recruitments/${posting.id}`);
    if (r.ok) router.push('/recruitments');
    else setError(r.message ?? '삭제에 실패했습니다.');
  }

  if (notFound) {
    return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-500">삭제되었거나 없는 공고입니다.</main>;
  }
  if (!posting) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <button type="button" onClick={() => router.push('/recruitments')} className="mb-4 text-sm text-gray-500">← 구인</button>

      <div className="mb-3 flex items-start justify-between">
        <h1 className="text-2xl font-bold">{posting.title}</h1>
        <div className="flex gap-2">
          {canEdit(me, posting.author.id) && (
            <button type="button" onClick={() => router.push(`/recruitments/${posting.id}/edit`)} className="text-xs text-gray-400">수정</button>
          )}
          {isAuthor && !posting.closed && (
            <button type="button" onClick={close} className="text-xs text-gray-400">마감</button>
          )}
          {canDelete(me, posting.author.id) && (
            <button type="button" onClick={remove} className="text-xs text-gray-400">삭제</button>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600"><AuthorBadge author={posting.author} /></div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <dl className="mb-6 flex flex-col gap-2 text-sm">
        <div><dt className="text-gray-500">모집 파트</dt><dd>{posting.instruments.join(', ')}</dd></div>
        {posting.recruitCount != null && <div><dt className="text-gray-500">모집 인원</dt><dd>{posting.recruitCount}명</dd></div>}
        {posting.location && <div><dt className="text-gray-500">활동 지역</dt><dd>{posting.location}</dd></div>}
        {posting.fee && <div><dt className="text-gray-500">보수</dt><dd>{posting.fee}</dd></div>}
        <div><dt className="text-gray-500">마감</dt><dd>{formatDeadline(posting.deadline)}</dd></div>
        {posting.description && <div><dt className="text-gray-500">설명</dt><dd className="whitespace-pre-wrap">{posting.description}</dd></div>}
      </dl>

      {isAuthor ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-500">지원자</h2>
          <ApplicantList applications={applicants} onAccept={(aid) => decide(aid, 'accept')} onReject={(aid) => decide(aid, 'reject')} />
        </section>
      ) : posting.closed ? (
        <p className="text-sm text-gray-500">마감된 공고입니다.</p>
      ) : (
        <ApplyPanel submitting={submitting} applied={applied} onApply={apply} />
      )}
    </main>
  );
}
