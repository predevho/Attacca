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
  const [kakaoConsent, setKakaoConsent] = useState(false);

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
      {/*
        카카오는 최초 사용 시 곧바로 가입이 된다. 그래서 버튼을 누르기 전에 동의를 받는다 —
        가입인지 아닌지는 인가코드를 교환해 봐야 알 수 있어서, 나중에 물을 기회가 없다.
        이미 가입한 회원에게는 한 번 더 확인하는 셈이지만, 동의 없이 가입되는 경로를
        남기는 것보다 낫다(DOMAIN-MEMBER-STATUTE §3.4).
      */}
      <label className="mt-6 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={kakaoConsent}
          onChange={(e) => setKakaoConsent(e.target.checked)} />
        <span>
          <a href="/terms" target="_blank" className="underline">이용약관</a>과{' '}
          <a href="/privacy" target="_blank" className="underline">개인정보 수집·이용</a>에 동의합니다.
          <span className="block text-xs text-muted">카카오로 처음 로그인하면 가입이 함께 이루어집니다.</span>
        </span>
      </label>
      <a
        href={kakaoConsent ? '/api/bff/oauth/kakao/start?consent=1' : undefined}
        aria-disabled={!kakaoConsent}
        onClick={(e) => { if (!kakaoConsent) e.preventDefault(); }}
        className={kakaoConsent
          ? 'mt-3 block rounded bg-[#FEE500] py-2 text-center text-sm font-medium text-black'
          : 'mt-3 block cursor-not-allowed rounded bg-[#FEE500] py-2 text-center text-sm font-medium text-black opacity-50'}
      >카카오 로그인</a>
      <p className="mt-4 text-sm">
        계정이 없으신가요? <a href="/signup" className="underline">회원가입</a>
      </p>
    </main>
  );
}
