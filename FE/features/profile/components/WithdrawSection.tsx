import { useMemberWithdrawal, WITHDRAW_CONFIRMATION } from '@/features/profile/hooks/useMemberWithdrawal';

export function WithdrawSection() {
  const {
    withdrawing,
    confirmText,
    pending,
    error,
    setWithdrawing,
    setConfirmText,
    withdraw,
    cancel,
  } = useMemberWithdrawal();
  const controlClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  return (
    <section className="mt-12 border-t border-line pt-6">
      <h2 className="text-sm font-medium text-ink-muted">회원 탈퇴</h2>
      <p className="mt-2 text-sm">
        탈퇴하면 아이디·이메일·닉네임·프로필이 지워집니다. <b>되돌릴 수 없습니다.</b>
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        이미 올린 글과 댓글은 남고 작성자만 “탈퇴한 회원”으로 바뀝니다.
        다른 분들의 대화가 함께 무너지기 때문입니다. 글까지 지우려면 탈퇴 전에 직접 지워 주세요.
      </p>

      {!withdrawing ? (
        <button onClick={() => setWithdrawing(true)} className={`mt-4 min-h-11 rounded border border-danger px-4 text-sm text-danger ${controlClass}`}>
          탈퇴하기
        </button>
      ) : (
        <div className="mt-4 rounded border border-danger p-4">
          <label className="block text-sm">
            확인을 위해 <b>{WITHDRAW_CONFIRMATION}</b> 를 그대로 입력해 주세요.
            <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} className="mt-2 w-full rounded border border-line px-3 py-2 text-sm" />
          </label>
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={withdraw} disabled={confirmText !== WITHDRAW_CONFIRMATION || pending}
              aria-busy={pending} className={`min-h-11 rounded bg-danger px-4 text-sm text-on-brand disabled:opacity-50 ${controlClass}`}>
              {pending ? '삭제 중' : '영구 삭제'}
            </button>
            <button onClick={cancel} className={`min-h-11 rounded border border-line px-4 text-sm ${controlClass}`}>취소</button>
          </div>
        </div>
      )}
    </section>
  );
}
