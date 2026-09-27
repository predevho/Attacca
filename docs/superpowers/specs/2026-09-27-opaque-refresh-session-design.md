# Opaque Refresh Session + 공용 신원 상태 설계

## 1. 목적과 확정 범위

### 목적

브라우저에 refresh JWT 원문을 저장하지 않는다. refresh 권한은 Redis의 서버 세션으로 관리하고,
브라우저는 그 세션을 가리키는 무작위 식별자만 `HttpOnly` 쿠키로 보낸다.

동시에 화면마다 반복하는 `/api/bff/me/identity` 호출을 공용 신원 상태로 합쳐, 같은 시점의
중복 요청과 화면별 상태 불일치를 줄인다.

### 확정 범위

* access JWT는 `access_token` `HttpOnly` 쿠키에 유지한다. 만료 시간은 현행 30분이다.
* refresh JWT와 `refresh_token` 쿠키를 제거한다.
* 무작위 opaque session ID를 `refresh_session` `HttpOnly` 쿠키에 둔다.
* Redis가 session ID의 해시를 키로 하여 회원 ID와 만료를 보관한다. TTL은 현행 refresh 수명인 14일이다.
* 로그인, 카카오 로그인 완료, 비밀번호 변경, access 재발급, 로그아웃, 회원 탈퇴가 새 세션 계약을 사용한다.
* 공용 신원 상태는 중복 조회 제거만 담당한다. 이번 단계에서 로그인 필수 화면의 리다이렉트 정책은 통합하지 않는다.

### 범위 밖

* access JWT를 브라우저 메모리나 localStorage로 옮기지 않는다.
* Redis 기반 WebSocket broker, 다중 인스턴스, Blue/Green은 다루지 않는다.
* 기기 목록 조회, 원격 기기 로그아웃 UI, idle timeout은 후속 작업이다.

## 2. 현재와 목표

| 구분 | 현재 | 목표 |
|---|---|---|
| 브라우저 refresh 값 | `refresh_token` JWT 원문 | `refresh_session` 무작위 세션 ID |
| Redis | `rt:{memberId}` Set에 refresh JWT `jti` | `auth:refresh:{sha256(sessionId)}`에 서버 세션 |
| 재발급 입력 | refresh JWT 원문 | opaque session ID |
| 재발급 검증 | JWT 서명·만료 + Redis `jti` allowlist | cookie session ID 해시 조회 + Redis TTL + 회원 role 재조회 |
| 기존 세션 | 유지 | 배포 시 무효화, 다음 요청에 재로그인 |

`TOKEN_STORE`가 운영에서 비어 있으므로 애플리케이션 기본값 `redis`가 적용되고, 실제 Redis에
`rt:3` 키가 확인됐다. 현행 구조는 Redis allowlist를 사용하지만 raw refresh JWT도 쿠키에 남는다.

## 3. 목표 흐름

```text
로그인 또는 카카오 완료
  BE: access JWT + 256-bit 이상 난수 session ID 생성
  BE: Redis auth:refresh:{sha256(session ID)} = memberId, TTL 14일
  BFF: access_token / refresh_session HttpOnly 쿠키 설정

인증 BFF 요청에서 access 만료
  BFF: refresh_session을 BE reissue에 전달
  BE: session ID 해시로 Redis 조회 -> member role 재조회 -> 새 access JWT 발급
  BFF: access_token만 교체 -> 원 요청 1회 재시도

로그아웃·탈퇴·세션 철회
  BE: 해당 Redis 세션 키 또는 회원 세션 키 삭제
  BFF: access_token / refresh_session 쿠키 삭제
```

브라우저에는 재발급 권한을 가진 값이 여전히 존재한다. 이것은 브라우저가 서버 세션을 식별할
방법이 필요하기 때문이다. 단, 그 값은 JWT와 회원 정보가 없는 난수 식별자이며 서버 DB/Redis
없이는 의미가 없다.

## 4. 저장 모델과 보안 규칙

### Redis

* 키: `auth:refresh:{sha256(sessionId)}`
* 값: `memberId`와 필요 최소 메타데이터(발급 시각)만 JSON으로 저장한다.
* TTL: 14일. 재발급은 고정 만료를 기본으로 하며, 활동할 때마다 TTL을 연장하지 않는다.
* session ID는 `SecureRandom`으로 256-bit 이상 생성한다.
* Redis에는 session ID 원문이나 refresh JWT 원문을 저장하지 않는다.
* 조회·저장·삭제 중 Redis 오류는 fail-closed로 처리한다. 로그인과 재발급은 503으로 실패하고,
  이미 유효한 access JWT 요청과 공개 조회는 계속 처리한다.

### 쿠키

* `access_token`: `HttpOnly`, `Secure`(운영), `SameSite=Lax`, `Path=/`, Max-Age 30분.
* `refresh_session`: 같은 속성, Max-Age 14일.
* 쿠키 이름은 `__Host-` prefix를 이번 단계에 도입하지 않는다. 개발 환경 HTTP와 기존 이름 호환을
  한 번에 바꾸는 범위가 커서, HTTPS 전용 운영 검증을 별도 작업으로 남긴다.
* JavaScript는 두 쿠키 모두 읽거나 작성하지 않는다.

### 세션 사건

| 사건 | 처리 |
|---|---|
| 로그인·카카오 완료 | 새 session ID 생성, Redis 저장, 두 쿠키 설정 |
| access 재발급 | Redis session 검증 후 access만 교체 |
| 로그아웃 | 현재 session 삭제 후 두 쿠키 삭제 |
| 비밀번호 변경 | 기존 정책을 유지하되 새 session을 발급하고 기존 회원 session은 모두 삭제 |
| 회원 탈퇴 | 회원의 모든 session을 삭제하고 쿠키 삭제 |
| Redis 장애 | 로그인·재발급 fail-closed; access 인증 요청은 영향 없음 |
| 배포 직후 | 기존 `refresh_token`은 인식하지 않고 재로그인 유도 |

회원별 전체 세션 삭제를 위해 `auth:refresh:member:{memberId}` Set에 session key 해시를 별도로
보관한다. 개별 세션의 TTL 만료 뒤에는 다음 로그인·철회 과정에서 만료된 멤버를 정리한다. 개별
세션과 회원 인덱스의 다중 키 조작은 Redis Lua script로 원자화한다.

### 로그아웃의 쿠키 삭제와 Redis 장애

로그아웃을 누르면 BFF는 항상 `access_token`과 `refresh_session` 쿠키를 삭제한다. 따라서
현재 브라우저는 즉시 보호 화면에 접근할 수 없다.

정상 경로에서는 BE가 Redis session을 먼저 삭제한 뒤 BFF가 쿠키를 삭제한다. 이 순서가
서버 철회와 브라우저 철회를 함께 보장한다.

Redis 또는 BE 장애로 session 삭제를 확인하지 못한 경우에도 BFF는 쿠키를 삭제하되,
응답은 성공으로 위장하지 않고 `서버 세션 철회를 확인하지 못했습니다.`라는 오류를 UI에
표시한다. 이때 사라진 쿠키를 가진 현재 브라우저는 로그아웃되지만, 이미 탈취된 session ID는
Redis가 복구된 뒤 TTL이 끝날 때까지 철회됐다고 보장할 수 없다. 이 한계는 Redis가 복구된 뒤
서버가 임의의 사용자를 식별할 수 없기 때문에 로그아웃 요청을 재전송해서 해결할 수 없다.

이 선택은 사용자의 기기에서 로그아웃을 즉시 반영하는 것을 우선한다. 높은 보안 수준의
전역 철회 보장이 필요해지면 별도 내구 저장 outbox 또는 세션 폐기 큐를 도입해야 하며,
이번 단일 Redis 범위에는 포함하지 않는다.

### Grace period 결정

이번 단계에서는 refresh session을 재발급마다 회전하지 않는다. 하나의 opaque session은
14일 TTL 동안 유지하고 access JWT만 새로 발급한다. 따라서 기존 session과 새 session이
경합하는 문제가 없으므로 grace period를 두지 않는다.

선택 이유는 다음과 같다.

* session을 매 재발급마다 회전하면 동시에 들어온 요청·여러 탭에서 이전 session 재사용이
  자연스럽게 발생한다.
* 이를 완화하는 grace period는 짧은 시간이라도 이전 session으로 access 발급을 허용하므로,
  탈취 재사용 탐지의 강도를 낮춘다.
* 이번 구조의 우선 목표는 raw refresh JWT 제거·서버 철회·TTL 명확화다. 세션 회전은 기기
  단위 세션 관리와 재사용 탐지 정책을 별도 설계할 때 도입한다.

후속으로 session 회전을 도입한다면, BFF의 단일 재발급 제어와 Redis Lua 원자 회전,
이전 session의 5초 이하 grace 또는 재로그인 처리 중 하나를 보안 정책으로 명시해야 한다.

## 5. 공용 신원 상태

`IdentityProvider`와 `useIdentity()`를 FE 최상위 레이아웃에 둔다.

* 최초 렌더에서 `/api/bff/me/identity`를 한 번 요청한다.
* `pending | anonymous | authenticated`를 명시적으로 구분한다.
* 여러 컴포넌트가 동시에 읽어도 요청은 하나만 발생한다.
* 로그인 완료, 로그아웃, 닉네임 변경, 인증 연주자 상태 변경 뒤에는 `refreshIdentity()`로 명시적 갱신한다.
* 기존 각 페이지의 로그인 리다이렉트 조건과 화면 권한 판정은 그대로 둔다. 페이지는 직접 HTTP 호출
  대신 `useIdentity()`의 상태를 사용한다.

## 6. 이행 순서

1. 새 Redis session store와 단위·통합 테스트를 추가한다.
2. BE token 발급·재발급·로그아웃·탈퇴·비밀번호 변경을 새 계약으로 전환한다.
3. BFF cookie/session helper와 테스트를 `refresh_session`으로 전환한다.
4. 기존 refresh 쿠키를 삭제하고, 재로그인 안내를 BFF 401 흐름에 연결한다.
5. FE 공용 신원 상태를 도입하고 헤더·대표 보호 화면부터 이전한다.
6. 전체 테스트·운영 smoke(로그인, 새로고침, access 만료 재발급, 로그아웃, 탈퇴, Redis 장애)를 수행한다.

DB 마이그레이션은 필요 없다. 배포에는 BE와 FE 계약이 동시에 바뀌어야 하므로, 같은 릴리스에서
이미지 두 개의 SHA가 일치하는 기존 배포 게이트를 사용한다.

## 7. 테스트와 완료 기준

* raw refresh JWT가 로그인·카카오·비밀번호 변경·reissue 응답 또는 쿠키에 남지 않는다.
* Redis에는 raw session ID가 아니라 해시 키만 저장되고 TTL이 14일이다.
* 무효 session, 만료 session, 로그아웃 session은 재발급할 수 없다.
* 로그아웃·탈퇴·비밀번호 변경은 의도한 범위의 세션을 철회한다.
* 로그아웃 성공 시 BE Redis session과 두 브라우저 쿠키가 모두 삭제된다. Redis 장애 시에는
  쿠키 삭제와 철회 미확인 오류가 동시에 발생한다.
* 동일 session을 반복 재발급해도 grace period 없이 access만 교체된다.
* Redis 장애 시 로그인·reissue가 503이고 access JWT로의 보호 API 요청은 유지된다.
* 헤더와 동시에 마운트된 복수 화면이 identity 요청을 하나만 보낸다.
* BE 전체 테스트, FE 테스트·typecheck·lint·색 토큰 검사·build 및 운영 smoke를 통과한다.

## 8. 참고

* [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) — 난수 session ID, `HttpOnly`·`Secure`·`SameSite` 쿠키 지침.
* [OWASP JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html) — JWT 수명과 저장 매체의 보안 고려 사항.
* [NIST SP 800-63B Session Management](https://pages.nist.gov/800-63-4/sp800-63b/session/) — HTTPS·`HttpOnly`·`SameSite` 쿠키 권고.
* 현행 기준: `docs/DOMAIN-COMMON-STATUTE.md` §4.1, `docs/ARCHITECTURE-STATUTE.md` §1.
