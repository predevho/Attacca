# 카카오 OAuth 신규 회원 로그인 실패

## 증상

`https://staging.attacca.site/login?error=oauth`로 반복 이동한다. 초기에는 OAuth 시작 URL의 `client_id`에 Redirect URI가 들어가는 환경 변수 오류도 확인됐다.

## 확인한 사실

- Vercel FE 배포와 `staging.attacca.site` DNS는 정상이다.
- EC2 백엔드 컨테이너는 `healthy` 상태다.
- `.env.prod`의 카카오 값이 비어 있던 문제는 값을 입력하고 컨테이너를 재생성해 해결했다.
- 이후 Nginx 접근 로그에 다음 요청이 확인됐다.

```text
POST /api/auth/oauth/kakao HTTP/1.1 400
```

- 같은 시각 BE 로그에는 다음 오류가 남았다.

```text
BusinessException: code=CONSENT_REQUIRED
이용약관과 개인정보 수집·이용에 동의해야 가입할 수 있습니다.
```

## 비즈니스 로직 원인

문제의 핵심은 인프라가 아니라 **카카오 인증 성공 후 신규 소셜 회원을 가입 진행 상태로 전환하는 경계가 불명확했던 것**이다.

- 카카오 인증은 외부 계정의 본인 확인 단계다.
- Attacca 회원가입은 닉네임과 필수 약관 동의를 기록해야 완료된다.
- 현재 FE 콜백은 BE 응답이 400이면 원인을 모두 `error=oauth`로 변환한다.
- 따라서 신규 회원의 필수 동의 요구가 OAuth 제공자 연동 실패처럼 보인다.

## 대응 방향

신규 회원에게 정식 access/refresh 토큰을 바로 주거나 동의가 없다는 400으로 종료하지 않는다. 대신 짧은 수명의 `SOCIAL_ONBOARDING` 티켓을 발급하고 닉네임·약관 동의 화면으로 유도한다. 완료 성공 시에만 정식 토큰을 발급한다.

## 재현 및 검증 기준

1. 신규 카카오 계정으로 staging 로그인
2. `/signup/nickname`으로 이동하는지 확인
3. 약관 누락 시 `CONSENT_REQUIRED`가 화면에 표시되는지 확인
4. 닉네임과 필수 약관 제출 후 정식 쿠키가 발급되는지 확인
5. 만료된 티켓으로 재요청하면 로그인 시작 화면으로 돌아가는지 확인
6. 온보딩 티켓으로 피드·채팅 API를 호출하면 거절되는지 확인

## 재발 방지

- OAuth 제공자 오류와 온보딩 상태 오류를 FE에서 분리한다.
- `KAKAO_CLIENT_ID`에는 REST API 키, `KAKAO_REDIRECT_URI`에는 callback URL만 넣는다.
- Vercel Production 환경 변수 변경 뒤 Production 재배포를 수행한다.
- 배포 후 OAuth authorize URL의 `client_id`와 `redirect_uri`를 실제 주소에서 확인한다.

## 구현 결과

- `MemberOAuthService`는 미완료 소셜 회원에게 정식 access/refresh 대신 10분 만료 `type=onboarding` JWT를 발급한다.
- `OnboardingCompletionFilter`는 미완료 회원뿐 아니라 `type=onboarding` 티켓 자체를 일반 API에서 차단한다. 따라서 온보딩 완료 뒤에도 기존 티켓을 일반 인증 토큰처럼 재사용할 수 없다.
- `POST /api/members/me/onboarding`이 닉네임과 필수 동의를 한 트랜잭션으로 저장하고 정식 토큰 쌍을 발급한다. 이미 완료된 회원의 재호출은 `INVALID_TOKEN_TYPE`으로 거절한다.
- FE 콜백은 티켓을 access 쿠키에 임시 저장하고 `/signup/nickname`으로 이동한다. 온보딩 BFF는 완료 응답의 정식 토큰을 httpOnly access/refresh 쿠키로 교체한다.
- 기존 `PATCH /api/members/me`는 기존 신원 응답 계약을 유지해 일반 프로필 수정 흐름의 호환성을 보존한다.
