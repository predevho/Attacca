'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, postBff, deleteBff } from '@/lib/api';
import { canEdit, canDelete } from '@/lib/feed/logic';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { ApplyPanel } from '@/components/recruitment/ApplyPanel';
import { ApplicantList } from '@/components/recruitment/ApplicantList';
import { AttachmentList } from '@/components/files/AttachmentList';
import { formatDeadline } from '@/lib/recruitment/logic';
import { instrumentText, toLabelMap, type InstrumentLabels } from '@/lib/recruitment/instruments';
import type { Me } from '@/lib/feed/types';
import type { Application, InstrumentOption, Posting, SpringPage } from '@/lib/recruitment/types';

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
  const [instrumentLabels, setInstrumentLabels] = useState<InstrumentLabels>({});
  // 어떤 액션이 진행 중인지. 연타로 같은 요청이 두 번 나가는 것을 막는다.
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
  }, [router]);

  useEffect(() => {
    getBff('/api/bff/profile-options').then((r) => {
      if (r.ok) setInstrumentLabels(toLabelMap((r.data as { instruments: InstrumentOption[] }).instruments));
    });
  }, []);

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
    const key = `${action}:${applicationId}`;
    if (pending) return;
    setPending(key);
    const r = await postBff(`/api/bff/recruitments/applications/${applicationId}/${action}`);
    setPending(null);
    if (r.ok) {
      setApplicants((cur) => cur.map((a) =>
        a.id === applicationId ? { ...a, status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' } : a));
    } else setError(r.message ?? '처리에 실패했습니다.');
  }

  async function close() {
    if (!posting || pending) return;
    setPending('close');
    const r = await postBff(`/api/bff/recruitments/${posting.id}/close`);
    setPending(null);
    if (r.ok) setPosting({ ...posting, status: 'CLOSED', closed: true });
    else setError(r.message ?? '마감에 실패했습니다.');
  }

  async function remove() {
    if (!posting || pending) return;
    setPending('remove');
    const r = await deleteBff(`/api/bff/recruitments/${posting.id}`);
    if (!r.ok) setPending(null); // 성공하면 목록으로 떠나므로 그대로 잠가 둔다
    if (r.ok) router.push('/recruitments');
    else setError(r.message ?? '삭제에 실패했습니다.');
  }

  if (notFound) {
    return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-muted">삭제되었거나 없는 공고입니다.</main>;
  }
  // me·posting 둘 다 로드된 뒤에 렌더한다. 신원보다 공고가 먼저 도착하면 isAuthor가 일시적으로 false가 되어
  // 작성자에게 지원 패널이 잠깐 보이는 레이스를 막는다.
  if (!posting || !me) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-ink-faint">불러오는 중...</main>;

  return (
    <main aria-labelledby="recruitment-title" className="mx-auto mt-8 max-w-xl px-4">
      <button type="button" aria-label="구인 목록으로 돌아가기" onClick={() => router.push('/recruitments')}
        className="mb-6 rounded px-1 text-sm text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">← 구인</button>

      <header className="mb-6 flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 id="recruitment-title" className="min-w-0 break-words text-2xl font-bold">{posting.title}</h1>
        <div aria-label="공고 관리" className="flex shrink-0 flex-wrap gap-x-4 gap-y-2">
          {canEdit(me, posting.author.id) && (
            <button type="button" aria-label="공고 수정" onClick={() => router.push(`/recruitments/${posting.id}/edit`)}
              className="rounded px-1 text-xs text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">수정</button>
          )}
          {isAuthor && !posting.closed && (
            <button type="button" onClick={close} disabled={pending !== null}
              aria-label={pending === 'close' ? '공고 마감 중' : '공고 마감'} className="rounded px-1 text-xs text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50">
              {pending === 'close' ? '마감 중...' : '마감'}
            </button>
          )}
          {canDelete(me, posting.author.id) && (
            <button type="button" onClick={remove} disabled={pending !== null}
              aria-label="공고 삭제" className="rounded px-1 text-xs text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50">
              {pending === 'remove' ? '삭제 중...' : '삭제'}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <AuthorBadge author={posting.author} />
        <div role="status" aria-label="공고 상태"
          className={posting.closed ? 'w-fit rounded-full border border-line px-3 py-1 text-xs text-ink-muted' : 'w-fit rounded-full border border-success px-3 py-1 text-xs text-success'}>
          {posting.closed ? '마감' : '모집 중'}
        </div>
      </div>
      </header>

      <section aria-label="모집 정보" className="mb-6">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-ink-muted">모집 파트</dt><dd>{instrumentText(posting.instruments, instrumentLabels)}</dd></div>
        {posting.recruitCount != null && <div><dt className="text-ink-muted">모집 인원</dt><dd>{posting.recruitCount}명</dd></div>}
        {posting.location && <div><dt className="text-ink-muted">활동 지역</dt><dd>{posting.location}</dd></div>}
        {posting.fee && <div><dt className="text-ink-muted">보수</dt><dd>{posting.fee}</dd></div>}
        <div><dt className="text-ink-muted">마감</dt><dd>{formatDeadline(posting.deadline)}</dd></div>
      </dl>
      {posting.description && <div className="mt-5 border-t border-line pt-4 text-sm"><p className="text-ink-muted">설명</p><p className="mt-1 whitespace-pre-wrap">{posting.description}</p></div>}
      <AttachmentList attachments={posting.attachments} />
      </section>

      {isAuthor ? (
        <section aria-label="지원자 목록" className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">지원자</h2>
          {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
          <ApplicantList applications={applicants} onAccept={(aid) => decide(aid, 'accept')} onReject={(aid) => decide(aid, 'reject')} />
        </section>
      ) : posting.closed ? (
        <section aria-label="지원 안내" className="mt-8"><p className="text-sm text-ink-muted">마감된 공고입니다.</p></section>
      ) : (
        <section aria-label="지원하기" className="mt-8">
          {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
          <ApplyPanel submitting={submitting} applied={applied} onApply={apply} />
        </section>
      )}
    </main>
  );
}
