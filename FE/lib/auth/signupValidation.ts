/**
 * 회원가입 입력 검증 — 화면에서 즉시 알려 주기 위한 것.
 *
 * ⚠️ **이건 방어가 아니다.** 실제 방어는 서버가 한다(`@Valid`, DOMAIN-MEMBER-STATUTE §3.3).
 * 화면을 거치지 않는 요청은 언제나 가능하므로, 여기 규칙을 느슨하게 두더라도
 * 서버가 막는다. 반대로 여기가 서버보다 엄격하면 **서버가 받아 주는 값을 화면이
 * 거부**하게 되므로, 규칙은 서버와 같게 유지한다.
 *
 * 서버 쪽 규칙: `BE/.../dto/SignupRequest.java`
 */

export type SignupForm = {
  loginId: string;
  password: string;
  passwordConfirm: string;
  email: string;
  nickname: string;
};

export type SignupErrors = Partial<Record<keyof SignupForm, string>>;

const LOGIN_ID = /^[a-z0-9_]{4,20}$/;
// 서버는 @Email 을 쓴다. 여기서는 흔한 실수(@ 없음, 도메인 없음)만 잡는다 —
// 이메일 형식을 정규식으로 완벽히 맞추려는 시도는 늘 실패한다.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(form: SignupForm): SignupErrors {
  const e: SignupErrors = {};

  if (!form.loginId) e.loginId = '아이디를 입력해 주세요.';
  else if (!LOGIN_ID.test(form.loginId)) e.loginId = '영문 소문자·숫자·밑줄 4~20자로 입력해 주세요.';

  if (!form.password) e.password = '비밀번호를 입력해 주세요.';
  else if (form.password.length < 8 || form.password.length > 64) {
    e.password = '8자 이상 64자 이하로 입력해 주세요.';
  } else if (/\s/.test(form.password)) e.password = '공백은 쓸 수 없습니다.';

  // 확인란은 서버로 보내지 않는다. 오타로 잘못된 비밀번호가 저장되는 것만 막는다.
  if (!form.passwordConfirm) e.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요.';
  else if (form.password !== form.passwordConfirm) e.passwordConfirm = '비밀번호가 일치하지 않습니다.';

  if (!form.email) e.email = '이메일을 입력해 주세요.';
  else if (!EMAIL.test(form.email)) e.email = '이메일 형식이 올바르지 않습니다.';
  else if (form.email.length > 254) e.email = '이메일이 너무 깁니다.';

  const nickname = form.nickname.trim();
  if (!nickname) e.nickname = '닉네임을 입력해 주세요.';
  else if (nickname.length < 2 || nickname.length > 20) e.nickname = '2자 이상 20자 이하로 입력해 주세요.';

  return e;
}

export function hasError(errors: SignupErrors): boolean {
  return Object.keys(errors).length > 0;
}
