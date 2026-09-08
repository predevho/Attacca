import { describe, it, expect } from 'vitest';
import { validateSignup, hasError, type SignupForm } from '@/lib/auth/signupValidation';

const ok: SignupForm = {
  loginId: 'gooduser',
  password: 'goodpassword',
  passwordConfirm: 'goodpassword',
  email: 'a@attacca.com',
  nickname: '닉네임',
};

function withField(patch: Partial<SignupForm>) {
  return validateSignup({ ...ok, ...patch });
}

describe('회원가입 입력 검증', () => {
  it('올바른 입력은 통과한다', () => {
    expect(hasError(validateSignup(ok))).toBe(false);
  });

  it('운영에서 실제로 통과했던 조합을 잡는다', () => {
    // 2026-09-09 이전에는 이 값들이 서버까지 통과해 가입됐다.
    const e = withField({ password: '1', passwordConfirm: '1', email: 'not-an-email', nickname: ' ' });
    expect(e.password).toBeTruthy();
    expect(e.email).toBeTruthy();
    expect(e.nickname).toBeTruthy();
  });

  it.each([
    ['abc', '4자 미만'],
    ['Uppercase', '대문자'],
    ['has space', '공백'],
    ['한글아이디', '한글'],
  ])('아이디 "%s" 는 거부한다 (%s)', (loginId) => {
    expect(withField({ loginId }).loginId).toBeTruthy();
  });

  it('비밀번호가 8자 미만이면 거부한다', () => {
    expect(withField({ password: 'short7c', passwordConfirm: 'short7c' }).password).toBeTruthy();
  });

  it('비밀번호에 공백이 있으면 거부한다', () => {
    expect(withField({ password: 'with space12', passwordConfirm: 'with space12' }).password).toBeTruthy();
  });

  it('확인란이 다르면 확인란에 오류를 붙인다', () => {
    // 비밀번호 자체는 규칙에 맞으므로 password 에는 오류가 없어야 한다.
    const e = withField({ passwordConfirm: 'goodpassword2' });
    expect(e.passwordConfirm).toBeTruthy();
    expect(e.password).toBeUndefined();
  });

  it('확인란이 비어 있어도 거부한다', () => {
    expect(withField({ passwordConfirm: '' }).passwordConfirm).toBeTruthy();
  });

  it('닉네임은 앞뒤 공백을 뺀 길이로 본다', () => {
    // 서버가 trim 후 저장하므로 화면도 같은 기준이어야 한다.
    expect(withField({ nickname: '  가나  ' }).nickname).toBeUndefined();
    expect(withField({ nickname: '  가  ' }).nickname).toBeTruthy();
  });

  it('이메일 형식을 본다', () => {
    expect(withField({ email: 'no-at-sign' }).email).toBeTruthy();
    expect(withField({ email: 'a@b' }).email).toBeTruthy();
    expect(withField({ email: 'a@b.co' }).email).toBeUndefined();
  });
});
