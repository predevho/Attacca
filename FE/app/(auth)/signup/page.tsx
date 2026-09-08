'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/api';
import { validateSignup, hasError, type SignupForm, type SignupErrors } from '@/lib/auth/signupValidation';

const EMPTY: SignupForm = {
  loginId: '', password: '', passwordConfirm: '', email: '', nickname: '',
  agreedTerms: false, agreedPrivacy: false,
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

  // 글자 칸과 체크박스는 다루는 값이 다르다(문자열 / 불리언). 키 타입을 나눠
  // 체크박스 키가 글자 칸 helper 로 새는 것을 타입 수준에서 막는다.
  type TextKey = 'loginId' | 'password' | 'passwordConfirm' | 'email' | 'nickname';

  function update(key: TextKey) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  }
  function toggle(key: 'agreedTerms' | 'agreedPrivacy') {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm({ ...form, [key]: e.target.checked });
      setTouched((t) => ({ ...t, [key]: true }));
    };
  }
  function blur(key: TextKey) {
    return () => setTouched((t) => ({ ...t, [key]: true }));
  }
  function messageFor(key: keyof SignupForm) {
    return touched[key] ? errors[key] : undefined;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasError(errors)) {
      // 제출을 눌렀다면 전부 확인한 것으로 보고 남은 오류를 모두 보여 준다.
      setTouched({
        loginId: true, password: true, passwordConfirm: true, email: true, nickname: true,
        agreedTerms: true, agreedPrivacy: true,
      });
      return;
    }
    setPending(true);
    setError(null);
    // 확인란은 서버로 보내지 않는다 — 서버가 확인할 것이 없다.
    // 동의는 보낸다. 서버가 확인하고 같은 트랜잭션에서 이력을 남긴다.
    const { passwordConfirm: _unused, ...payload } = form;
    void _unused;
    const res = await postBff('/api/bff/signup', { ...payload, nickname: payload.nickname.trim() });
    setPending(false);
    if (res.ok) router.push('/login');
    else setError(res.message ?? '회원가입에 실패했습니다.');
  }

  function field(key: TextKey, label: string, type = 'text', hint?: string) {
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

  function consent(key: 'agreedTerms' | 'agreedPrivacy', label: React.ReactNode) {
    const msg = messageFor(key);
    return (
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={form[key]} onChange={toggle(key)}
            aria-invalid={msg ? true : undefined}
            aria-describedby={msg ? `${key}-error` : undefined} />
          <span>{label}</span>
        </label>
        {msg && <p id={`${key}-error`} role="alert" className="mt-1 text-xs text-danger">{msg}</p>}
      </div>
    );
  }

  return (
    <main className="mx-auto my-16 max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-bold">회원가입</h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {field('loginId', '아이디', 'text', '영문 소문자·숫자·밑줄 4~20자')}
        {field('password', '비밀번호', 'password', '8자 이상 64자 이하')}
        {field('passwordConfirm', '비밀번호 확인', 'password')}
        {field('email', '이메일', 'email')}
        {field('nickname', '닉네임', 'text', '2~20자')}

        <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
          <legend className="sr-only">약관 동의</legend>
          {consent('agreedTerms', <><a href="/terms" target="_blank" className="underline">이용약관</a>에 동의합니다.</>)}
          {consent('agreedPrivacy', <><a href="/privacy" target="_blank" className="underline">개인정보 수집·이용</a>에 동의합니다.</>)}
          <p className="text-xs text-muted">두 항목 모두 동의해야 가입할 수 있습니다. 선택 동의 항목은 없습니다.</p>
        </fieldset>

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
