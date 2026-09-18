'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/api';
import { safeNext } from '@/lib/home/logic';

export function NicknameForm({ next = null }: { next?: string | null }) {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedTerms || !agreedPrivacy) {
      setError('필수 약관에 동의해 주세요.');
      return;
    }
    setPending(true);
    setError(null);
    const res = await postBff('/api/bff/members/me', {
      nickname: nickname.trim(), agreedTerms, agreedPrivacy,
    });
    setPending(false);
    if (res.ok) router.push(safeNext(next));
    else setError(res.message ?? '닉네임 저장에 실패했습니다.');
  }

  return <main className="mx-auto mt-24 max-w-sm px-4">
    <h1 className="mb-6 text-2xl font-bold">닉네임 설정</h1>
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">닉네임
        <input className="rounded border border-line px-3 py-2" value={nickname}
          onChange={(e) => setNickname(e.target.value)} minLength={2} maxLength={20} required />
      </label>
      <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
        <legend className="sr-only">약관 동의</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)} />
          <span><a href="/terms" target="_blank" className="underline">이용약관</a>에 동의합니다.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={agreedPrivacy}
            onChange={(e) => setAgreedPrivacy(e.target.checked)} />
          <span><a href="/privacy" target="_blank" className="underline">개인정보 수집·이용</a>에 동의합니다.</span>
        </label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={pending} className="rounded bg-brand py-2 text-on-brand disabled:opacity-50">닉네임 저장</button>
    </form>
  </main>;
}
