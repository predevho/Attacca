/**
 * 비밀번호 변경 입력 검증 — 화면에서 즉시 알려 주기 위한 것.
 *
 * ⚠️ 방어는 서버가 한다(DOMAIN-MEMBER-STATUTE §3.5). 여기 규칙은 서버와 **같게** 유지한다 —
 * 여기가 더 엄격하면 서버가 받아 주는 값을 화면이 거부하게 된다.
 *
 * 서버 쪽 규칙: `BE/.../dto/ChangePasswordRequest.java`
 */

export type PasswordChangeForm = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
};

export type PasswordChangeErrors = Partial<Record<keyof PasswordChangeForm, string>>;

export function validatePasswordChange(form: PasswordChangeForm): PasswordChangeErrors {
  const e: PasswordChangeErrors = {};

  if (!form.currentPassword) e.currentPassword = '현재 비밀번호를 입력해 주세요.';

  if (!form.newPassword) e.newPassword = '새 비밀번호를 입력해 주세요.';
  else if (form.newPassword.length < 8 || form.newPassword.length > 64) {
    e.newPassword = '8자 이상 64자 이하로 입력해 주세요.';
  } else if (/\s/.test(form.newPassword)) e.newPassword = '공백은 쓸 수 없습니다.';
  // 서버도 같은 값을 거절한다(400-06). 여기서 먼저 잡아 왕복을 아낀다.
  else if (form.currentPassword && form.newPassword === form.currentPassword) {
    e.newPassword = '지금과 다른 비밀번호를 입력해 주세요.';
  }

  // 확인란은 서버로 보내지 않는다. 오타로 모르는 비밀번호가 저장되는 것만 막는다 —
  // 비밀번호 변경에서 오타가 나면 되돌릴 방법이 없다(재설정 기능이 아직 없다).
  if (!form.newPasswordConfirm) e.newPasswordConfirm = '새 비밀번호를 한 번 더 입력해 주세요.';
  else if (form.newPassword !== form.newPasswordConfirm) {
    e.newPasswordConfirm = '비밀번호가 일치하지 않습니다.';
  }

  return e;
}

export function hasError(errors: PasswordChangeErrors): boolean {
  return Object.keys(errors).length > 0;
}
