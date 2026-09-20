# Staging 도메인 폐기 설계

**상태:** 사용자 설계 승인 완료, 실행 계획 작성 전
**작성일:** 2026-09-20

## 1. 목적

`staging.attacca.site`는 독립된 개발 또는 검증 환경이 아니다. 현재 Vercel Production 배포,
EC2 API/WS, RDS, Redis를 운영 도메인과 공유하는 추가 호스트이므로, 별도 환경처럼 보이게
유지하지 않는다. 이 설계의 목표는 운영 경로를 변경하지 않고 staging 도메인과 그 전용 참조만
제거하는 것이다.

## 2. 목표 운영 형태

| 역할 | 유지 주소 | 대상 |
| --- | --- | --- |
| 운영 프론트 | `https://attacca.site` | Vercel Production |
| 운영 프론트 별칭 | `https://www.attacca.site` | Vercel Production |
| 운영 API, WebSocket, 파일 | `https://api.attacca.site` | EC2 Nginx, Spring BE, Redis, uploads |

제거 후 `staging.attacca.site`는 DNS, Vercel Domains, 카카오 콜백 URI, BE WebSocket Origin
allowlist에 존재하지 않아야 한다.

## 3. 범위와 비범위

### 범위

1. Vercel에서 `staging.attacca.site` 도메인을 제거한다.
2. 가비아 DNS의 `staging` CNAME을 제거한다.
3. 카카오 개발자 콘솔에서 staging 콜백 URI만 제거한다.
4. Vercel 환경변수에서 staging 전용 값 또는 Preview 한정 값을 제거하되, Production 값은
   변경하지 않는다.
5. EC2 `.env.prod`의 `WS_ALLOWED_ORIGINS`에서 staging origin만 제거하고 BE를 재기동한다.
6. 현행과 결정 사항을 운영 문서에 반영한다.

### 비범위

1. `attacca.site`, `www.attacca.site`, `api.attacca.site`의 제거 또는 DNS 변경.
2. Vercel Production 프로젝트, EC2 BE, RDS, Redis, EC2 rollback FE의 제거.
3. 별도 `develop`/`staging` 브랜치, 별도 DB, 별도 개발 인프라의 생성.
4. EC2/RDS 중지 스케줄러 도입. 이는 운영 가용 시간 합의 후 별도 설계와 실행 계획으로
   다룬다.

## 4. 변경 전 기준선

실행 직전에 아래 항목을 다시 확인하고 결과만 기록한다. 비밀값, 쿠키, OAuth 토큰은 기록하지
않는다.

1. Vercel Domains에서 `attacca.site`, `www.attacca.site`, `api`와 무관한 `staging.attacca.site`
   연결 상태를 확인한다.
2. 가비아 DNS에서 `staging` CNAME 값과 TTL을 확인한다.
3. 카카오 Redirect URI 목록에 다음 두 주소가 남는지 확인한다.
   - `http://localhost:3000/api/bff/oauth/kakao/callback`
   - `https://attacca.site/api/bff/oauth/kakao/callback`
4. Vercel 환경변수의 Production 값이 아래 운영 대상인지 확인한다.
   - `BE_BASE_URL=https://api.attacca.site`
   - `NEXT_PUBLIC_BE_WS_URL=wss://api.attacca.site/ws`
   - `KAKAO_REDIRECT_URI=https://attacca.site/api/bff/oauth/kakao/callback`
5. 운영 도메인에서 홈, 기존 카카오 로그인, 강제 새로고침 세션, 보호 화면, 채팅 WebSocket
   연결을 확인한다.

## 5. 실행 순서

### 5.1 카카오 staging 콜백 제거

카카오 개발자 콘솔에서 다음 URI만 제거한다.

`https://staging.attacca.site/api/bff/oauth/kakao/callback`

운영과 로컬 콜백은 유지한다. 이 단계의 실패는 운영 로그인에 영향을 주지 않으므로, 제거 후
운영 `attacca.site`에서 로그인 시작과 콜백을 먼저 확인한다.

### 5.2 Vercel 도메인 및 환경변수 정리

Vercel Domains에서 `staging.attacca.site`만 제거한다. `attacca.site`, `www.attacca.site`,
기본 Vercel 도메인은 유지한다.

환경변수는 이름이나 범위만 보고 삭제하지 않는다. Production과 Preview에 같은 이름의 항목이
있더라도 Production 값이 운영 URL을 계속 가리키는지 먼저 확인한다. staging 전용 redirect
URI 또는 Preview 전용 staging 값만 제거하며, 운영에 사용 중인 `BE_BASE_URL`,
`NEXT_PUBLIC_BE_WS_URL`, `KAKAO_CLIENT_ID`는 삭제하지 않는다.

### 5.3 DNS 제거

가비아에서 `staging` CNAME 레코드만 삭제한다. apex A, `www` CNAME, `api` A 레코드는
변경하지 않는다. DNS TTL이 지난 뒤 `staging.attacca.site`가 더 이상 해석되지 않는지 확인한다.

### 5.4 BE WebSocket Origin allowlist 축소

EC2 `/home/ubuntu/attacca/.env.prod`에서 `WS_ALLOWED_ORIGINS`를 아래 두 운영 origin만
포함하도록 수정한다.

```text
https://attacca.site,https://www.attacca.site
```

`.env.prod`에는 비밀값이 있으므로 파일 전체를 출력하거나 Git에 추가하지 않는다. Compose
해석이 정상인지 확인한 뒤 `be` 서비스만 강제 재생성한다. 현재 BE는 단일 컨테이너이므로 이
단계에서는 짧은 HTTP/WebSocket 연결 단절이 발생할 수 있으며, 무중단 배포로 주장하지 않는다.

### 5.5 문서 정리

`staging`을 고정 검증 환경으로 서술한 과거 문서는 역사적 사실을 지우지 않는다. 현재 상태가
변경되었음을 추가하고, 현재 운영 구조는 세 주소만 사용한다고 명확히 한다. 현재 작업 로그,
TODO, 배포 문서 및 최소 작업 캐시를 함께 갱신한다.

## 6. 검증 기준

모든 단계 이후 아래 조건을 만족해야 한다.

1. Vercel Domains에 `staging.attacca.site`가 없다.
2. 가비아에 `staging` CNAME이 없고 공개 DNS도 더 이상 staging을 해석하지 않는다.
3. 카카오 Redirect URI 목록에 staging URI가 없고, 운영 URI와 로컬 URI는 남아 있다.
4. Vercel Production 환경변수가 운영 API/WS/OAuth 콜백을 유지한다.
5. `https://attacca.site`와 `https://www.attacca.site`가 정상으로 열린다.
6. 운영 카카오 로그인, 세션 새로고침, 보호 BFF 요청이 정상이다.
7. `wss://api.attacca.site/ws`가 `https://attacca.site`와 `https://www.attacca.site` origin에서
   연결되고, 채팅 송수신과 재연결이 정상이다.
8. BE health가 정상이며 컨테이너가 healthy 상태다.

## 7. 롤백 원칙

staging 도메인 폐기는 운영 롤백 수단이 아니다. 운영 장애 시에는 Vercel의 이전 Ready
deployment Promote 또는 보존 중인 EC2 FE DNS rollback 절차를 사용한다.

staging을 되살려야 하는 특별한 사유가 생기면, 다음 네 설정을 같은 값으로 다시 만들고
운영 검증을 처음부터 수행한다.

1. 가비아 `staging` CNAME.
2. Vercel `staging.attacca.site` 도메인 연결.
3. 카카오 staging Redirect URI.
4. BE `WS_ALLOWED_ORIGINS`의 staging origin.

## 8. 보안 및 기록 규칙

Vercel 값, EC2 `.env.prod`, 카카오 앱 키, 쿠키와 토큰은 화면 공유·문서·Git·CI 로그에
기록하지 않는다. 외부 콘솔 변경은 한 단계씩 수행하고, 각 단계의 성공 여부와 검증 결과만
`docs/` 정본에 기록한다.
