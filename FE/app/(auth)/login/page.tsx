import { LoginForm } from './LoginForm';

/** OAuth/로그인 실패 코드 → 사용자 안내 문구. */
export const ERROR_MESSAGES: Record<string, string> = {
  state: '보안 검증에 실패했습니다. 다시 시도해 주세요.',
  kakao_cancelled: '카카오 로그인이 취소되었습니다.',
  oauth: '카카오 로그인에 실패했습니다.',
  oauth_config: '카카오 로그인이 현재 설정되지 않았습니다.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const initialError = error ? (ERROR_MESSAGES[error] ?? '로그인에 실패했습니다.') : null;
  // next는 미들웨어가 붙인 원래 목적지다. 안전성 검사는 LoginForm이 safeNext로 한다.
  return <LoginForm initialError={initialError} next={next ?? null} />;
}
