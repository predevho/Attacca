'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getBff } from '@/lib/api';
import { isHttpUrl } from '@/lib/imports/logic';
import type { PublicNotice } from '@/lib/home/types';
export default function PublicNoticePage() {
  const { id } = useParams<{ id: string }>();
  const [notice, setNotice] = useState<PublicNotice | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { getBff<PublicNotice>(`/api/bff/public/notices/${id}`).then((r) => { if (r.ok) setNotice(r.data as PublicNotice); else setError(true); }); }, [id]);
  if (error) return <main className="mx-auto mt-8 max-w-2xl px-4"><p>공지를 불러오지 못했습니다.</p></main>;
  if (!notice) return <main className="mx-auto mt-8 max-w-2xl px-4"><p>불러오는 중...</p></main>;
  return <main className="mx-auto mt-8 max-w-2xl px-4 pb-12">
    <h1 className="text-3xl font-bold">{notice.title}</h1>
    <p className="mt-3 text-sm text-ink-muted">{notice.scheduledAt ?? ''}{notice.place ? ` · ${notice.place}` : ''}</p>
    <article className="mt-8 whitespace-pre-wrap">{notice.content}</article>
    {notice.sourceName && <p className="mt-8 border-t border-line pt-4 text-sm">출처: {notice.sourceName}{isHttpUrl(notice.sourceUrl) && <>{' '}<a href={notice.sourceUrl!} target="_blank" rel="noopener noreferrer" className="text-brand underline">원문 보기</a></>}</p>}
  </main>;
}
