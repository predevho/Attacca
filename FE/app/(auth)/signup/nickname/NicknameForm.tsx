'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { patchBff } from '@/lib/api';
import { safeNext } from '@/lib/home/logic';

export function NicknameForm({ next = null }: { next?: string | null }) {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await patchBff('/api/bff/members/me', { nickname: nickname.trim() });
    setPending(false);
    if (res.ok) router.push(safeNext(next, '/feed'));
    else setError(res.message ?? '닉네임 저장에 실패했습니다.');
  }

  return <main className="mx-auto mt-24 max-w-sm px-4">
    <h1 className="mb-6 text-2xl font-bold">닉네임 설정</h1>
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">닉네임
        <input className="rounded border border-line px-3 py-2" value={nickname}
          onChange={(e) => setNickname(e.target.value)} minLength={2} maxLength={20} required />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={pending} className="rounded bg-brand py-2 text-on-brand disabled:opacity-50">닉네임 저장</button>
    </form>
  </main>;
}
