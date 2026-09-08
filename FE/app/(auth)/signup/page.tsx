'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/api';
import { validateSignup, hasError, type SignupForm, type SignupErrors } from '@/lib/auth/signupValidation';

const EMPTY: SignupForm = {
  loginId: '', password: '', passwordConfirm: '', email: '', nickname: '',
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupForm>(EMPTY);
  // 아직 건드리지 않은 칸에 빨간 글씨를 띄우면 첫 화면부터 야단맞는 기분이 든다.
  // 한 번이라도 벗어난(blur) 칸만 보여 준다.
  const [touched, setTouched] = useState<Partial<Record<keyof SignupForm, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const errors: SignupErrors = validateSignup(form);

  function update(key: keyof SignupForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  }
  function blur(key: keyof SignupForm) {
    return () => setTouched((t) => ({ ...t, [key]: true }));
  }
  function messageFor(key: keyof SignupForm) {
    return touched[key] ? errors[key] : undefined;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasError(errors)) {
      // 제출을 눌렀다면 전부 확인한 것으로 보고 남은 오류를 모두 보여 준다.
      setTouched({ loginId: true, password: true, passwordConfirm: true, email: true, nickname: true });
      return;
    }
    setPending(true);
    setError(null);
    // 확인란은 서버로 보내지 않는다 — 서버가 확인할 것이 없다.
    const { passwordConfirm: _unused, ...payload } = form;
    void _unused;
    const res = await postBff('/api/bff/signup', { ...payload, nickname: payload.nickname.trim() });
    setPending(false);
    if (res.ok) router.push('/login');
    else setError(res.message ?? '회원가입에 실패했습니다.');
  }

  function field(key: keyof SignupForm, label: string, type = 'text', hint?: string) {
    const msg = messageFor(key);
    return (
      <label className="flex flex-col gap-1 text-sm">{label}
        <input
          type={type}
          value={form[key]}
          onChange={update(key)}
          onBlur={blur(key)}
          aria-invalid={msg ? true : undefined}
          aria-describedby={msg ? `${key}-error` : undefined}
          // 두 갈래를 각각 완전한 문자열로 쓴다. `border ${cond ? 'border-danger' : ...}`
          // 처럼 조립하면 어느 색이 이기는지가 클래스 순서가 아니라 CSS 순서에 달려
          // 애매해지고, 색 토큰 검사기도 색을 못 찾는다.
          className={msg
            ? 'rounded border border-danger px-3 py-2'
            : 'rounded border border-line px-3 py-2'}
          required
        />
        {msg
          ? <span id={`${key}-error`} role="alert" className="text-xs text-danger">{msg}</span>
          : hint && <span className="text-xs text-muted">{hint}</span>}
      </label>
    );
  }

  return (
    <main className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-bold">회원가입</h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {field('loginId', '아이디', 'text', '영문 소문자·숫자·밑줄 4~20자')}
        {field('password', '비밀번호', 'password', '8자 이상 64자 이하')}
        {field('passwordConfirm', '비밀번호 확인', 'password')}
        {field('email', '이메일', 'email')}
        {field('nickname', '닉네임', 'text', '2~20자')}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={pending}
          className="rounded bg-brand py-2 text-on-brand disabled:opacity-50">회원가입</button>
      </form>
      <p className="mt-4 text-sm">
        이미 계정이 있으신가요? <a href="/login" className="underline">로그인</a>
      </p>
    </main>
  );
}
