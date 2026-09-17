'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/api';
import { safeNext } from '@/lib/home/logic';

export function LoginForm({
  initialError,
  next = null,
}: {
  initialError: string | null;
  /** 미들웨어가 넘긴 원래 목적지. 내부 경로가 아니면 무시한다(safeNext). */
  next?: string | null;
}) {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await postBff('/api/bff/login', { loginId, password });
    setPending(false);
    if (res.ok) router.push(safeNext(next));
    else setError(res.message ?? '로그인에 실패했습니다.');
  }

  return (
    <main className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-bold">로그인</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          아이디
          <input className="rounded border border-line px-3 py-2" value={loginId}
            onChange={(e) => setLoginId(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          비밀번호
          <input type="password" className="rounded border border-line px-3 py-2" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={pending}
          className="rounded bg-brand py-2 text-on-brand disabled:opacity-50">로그인</button>
      </form>
      <section aria-labelledby="kakao-login-heading" className="mt-8 border-t border-line pt-6">
        <h2 id="kakao-login-heading" className="text-sm font-semibold">카카오로 시작하기</h2>
        <a
          href={`/api/bff/oauth/kakao/start${next ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="mt-3 block rounded bg-[#FEE500] py-2 text-center text-sm font-medium text-black transition-colors hover:bg-[#F6DC00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >카카오 로그인</a>
      </section>
      <p className="mt-4 text-sm">
        계정이 없으신가요? <a href="/signup" className="underline">회원가입</a>
      </p>
    </main>
  );
}
