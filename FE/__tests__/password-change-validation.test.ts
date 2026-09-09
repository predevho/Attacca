import { describe, it, expect } from 'vitest';
import {
  validatePasswordChange,
  hasError,
  type PasswordChangeForm,
} from '@/lib/auth/passwordChangeValidation';

const ok: PasswordChangeForm = {
  currentPassword: 'oldpassword1',
  newPassword: 'newpassword2',
  newPasswordConfirm: 'newpassword2',
};

const withField = (patch: Partial<PasswordChangeForm>) =>
  validatePasswordChange({ ...ok, ...patch });

describe('비밀번호 변경 입력 검증', () => {
  it('올바른 입력은 통과한다', () => {
    expect(hasError(validatePasswordChange(ok))).toBe(false);
  });

  it('현재 비밀번호가 비면 거부한다', () => {
    expect(withField({ currentPassword: '' }).currentPassword).toBeTruthy();
  });

  it('새 비밀번호는 가입과 같은 규칙을 따른다', () => {
    expect(withField({ newPassword: 'short7c', newPasswordConfirm: 'short7c' }).newPassword)
      .toBeTruthy();
    expect(withField({ newPassword: 'with space12', newPasswordConfirm: 'with space12' }).newPassword)
      .toBeTruthy();
  });

  it('지금과 같은 값이면 거부한다', () => {
    // 서버도 400-06으로 거절한다. 여기서 먼저 잡아 왕복을 아낀다.
    const e = withField({ newPassword: 'oldpassword1', newPasswordConfirm: 'oldpassword1' });
    expect(e.newPassword).toBeTruthy();
  });

  it('확인란이 다르면 확인란에 오류를 붙인다', () => {
    const e = withField({ newPasswordConfirm: 'newpassword3' });
    expect(e.newPasswordConfirm).toBeTruthy();
    expect(e.newPassword).toBeUndefined();
  });

  it('확인란이 비어도 거부한다', () => {
    // 비밀번호 변경에서 오타가 나면 되돌릴 방법이 없다(재설정 기능이 아직 없다).
    expect(withField({ newPasswordConfirm: '' }).newPasswordConfirm).toBeTruthy();
  });
});
