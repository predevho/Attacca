import { usePasswordChange } from '@/features/profile/hooks/usePasswordChange';
import type { PasswordChangeForm as PasswordChangeValues } from '@/lib/auth/passwordChangeValidation';

export function PasswordChangeForm() {
  const { form, errors, touched, pending, error, done, setField, touch, submit } = usePasswordChange();
  const controlClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  function field(key: keyof PasswordChangeValues, label: string, hint?: string) {
    const message = touched[key] ? errors[key] : undefined;
    return (
      <label className="flex flex-col gap-1 text-sm">{label}
        <input
          type="password"
          value={form[key]}
          onChange={(event) => setField(key, event.target.value)}
          onBlur={() => touch(key)}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${key}-error` : undefined}
          className={`${message ? 'rounded border border-danger px-3 py-2' : 'rounded border border-line px-3 py-2'} min-h-11 ${controlClass}`}
        />
        {message
          ? <span id={`${key}-error`} role="alert" className="text-xs text-danger">{message}</span>
          : hint && <span className="text-xs text-ink-faint">{hint}</span>}
      </label>
    );
  }

  return (
    <section className="mt-12 border-t border-line pt-6">
      <h2 className="text-sm font-medium text-ink-muted">비밀번호 변경</h2>
      <p className="mt-2 text-sm text-ink-muted">
        바꾸면 <b>다른 기기의 로그인이 모두 끊깁니다.</b> 이 화면은 그대로 쓸 수 있습니다.
      </p>
      <form onSubmit={submit} noValidate className="mt-4 flex max-w-sm flex-col gap-3">
        {field('currentPassword', '현재 비밀번호')}
        {field('newPassword', '새 비밀번호', '8자 이상 64자 이하')}
        {field('newPasswordConfirm', '새 비밀번호 확인')}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {done && <p role="status" className="text-sm text-success">비밀번호를 바꿨습니다. 다른 기기는 다시 로그인해야 합니다.</p>}
        <button type="submit" disabled={pending} aria-busy={pending}
          className={`min-h-11 w-fit rounded bg-brand px-4 text-sm text-on-brand disabled:opacity-50 ${controlClass}`}>
          {pending ? '변경 중' : '비밀번호 변경'}
        </button>
      </form>
    </section>
  );
}
