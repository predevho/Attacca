# DOMAIN-COMMON-STATUTE

공통 도메인 규칙. 모든 도메인이 따르는 구체적 구현 규칙을 정의한다.

---

## 1. API 응답 포맷

* 일관된 응답 래퍼를 사용한다.

```
{
  "success": true | false,
  "data": { ... } | null,
  "error": { "resultCode": "400-01", "code": "INVALID_INPUT_VALUE", "message": "..." } | null
}
```

* 성공 시 `success = true`, `data`에 결과, `error = null`.
* 실패 시 `success = false`, `data = null`, `error`에 `resultCode`/`code`/`message`.
* 구현: `com.back.global.common.ApiResponse<T>` (정적 팩토리 `success`/`success(data)`/`error`). `error`는 nested record `ErrorBody(resultCode, code, message)`.
* `error.code` 문자열은 `ErrorCode` enum 상수 이름을 그대로 사용한다 (예: `INVALID_INPUT_VALUE`).
* `error.resultCode`(String)는 `HTTP상태-일련번호` 형식의 문자열 코드다. `ErrorCode`에 정의하며 Swagger/Postman 문서화·클라이언트 식별에 사용한다.
  * 규칙: `HTTP 상태(3자리)-일련번호(2자리)`. 예) 400 계열 `400-01`, 405 계열 `405-01`, 500 계열 `500-01`.

---

## 2. 예외 처리

* 위치: `com.back.global.exception`
* 구성:
  * `BusinessException` : 비즈니스 예외의 공통 상위 타입. 에러 코드를 갖는다.
  * `ErrorCode` (enum) : 에러 코드와 기본 메시지, HTTP 상태를 정의한다.
  * `GlobalExceptionHandler` (`@RestControllerAdvice`) : 예외를 응답 래퍼로 일괄 변환한다.
* 도메인은 자기 예외를 `BusinessException`을 상속하거나 `ErrorCode`를 사용해 던진다.
* `ErrorCode`는 `(resultCode:String, status:HttpStatus, message:String)`를 갖는다. `getCode()`는 enum 상수명을 반환한다.

---

## 3. 공통 엔티티

* 위치: `com.back.global.common`
* `BaseEntity` : `createdAt`, `updatedAt` 을 갖는 추상 클래스. `@MappedSuperclass` + JPA Auditing 사용.
* 모든 엔티티는 특별한 이유가 없으면 `BaseEntity`를 상속한다.

---

## 4. 인증/인가

* 위치: `com.back.global.security`
* 무상태(STATELESS) JWT 기반. 세션 미사용, `csrf`/`formLogin`/`httpBasic` 비활성.
* 구성:
  * `JwtProvider` : access/refresh 발급·파싱·검증(HS256, self-issued). 무상태 재발급을 위해 refresh 에도 role claim 포함.
  * `JwtProperties` : `jwt.secret`(env 주입), access/refresh 만료(ms).
  * `JwtAuthenticationFilter` : Bearer access 검증 → `SecurityContext` 세팅. 실패 시 사유 ErrorCode 를 request 속성에 저장.
  * `SecurityConfig` : `SecurityFilterChain`(인가 규칙 + 필터·핸들러 등록), `PasswordEncoder`(BCrypt) 빈.
  * `JwtAuthenticationEntryPoint`(401)/`JwtAccessDeniedHandler`(403) : 필터 체인 실패를 `ApiResponse` JSON 으로 직접 응답(전역 핸들러가 못 잡으므로).
  * `Role`(enum USER/ADMIN, `authority()`→`ROLE_x`). MEMBER 의 `Member.role` 이 재사용.
  * `AuthController` `POST /api/auth/reissue` : refresh 검증 후 새 access 재발급(무상태, DB 조회 없음).
* 인가 규칙: `/api/auth/**` permit, `/api/admin/**` `hasRole("ADMIN")`, 그 외 `authenticated()`.
* 인증 계열 ErrorCode:

| 코드 | resultCode | 사유 |
|---|---|---|
| UNAUTHORIZED | 401-01 | 토큰 없음/미인증 |
| MALFORMED_TOKEN | 401-02 | 형식 오류 |
| INVALID_SIGNATURE | 401-03 | 서명 변조 |
| EXPIRED_TOKEN | 401-04 | 만료 |
| UNSUPPORTED_TOKEN | 401-05 | 미지원 |
| INVALID_TOKEN_TYPE | 401-06 | reissue에 access 전달 등 |
| FORBIDDEN | 403-01 | 권한 부족 |

* 소셜 로그인(OAuth2): provider 인증 성공 → 회원 조회/생성 → 동일 `JwtProvider` 발급 흐름으로 수렴 (MEMBER 도메인에서 구현).

### 4.1 refresh 로테이션·철회 (2026-09-08 도입, Redis)

무상태를 포기하고 refresh만 서버가 기억한다. access는 여전히 무상태다(30분이라 블랙리스트를 두지 않는다).

**왜 바꾸는가** — 무상태 상태에서 다음 세 가지가 불가능했다.

* **로그아웃이 서버에 없다.** FE가 쿠키만 지웠으므로 탈취된 refresh는 14일간 그대로 유효했다.
* **로테이션이 없다.** `reissue`가 access만 새로 주고 같은 refresh를 14일 내내 재사용했다.
* **철회 수단이 없다.** 토큰마다 식별자(`jti`)가 없어 개별 무효화가 불가능했다.

**저장 구조** — 화이트리스트(유효한 것만 저장, 없으면 거부)

```
rt:{memberId}  →  Redis Set { jti, ... }   TTL = refresh 만료
```

Set 하나로 다중 기기가 자연히 지원되고, 전 기기 무효화가 `DEL` 한 번이다.

| 동작 | 처리 |
|---|---|
| 로그인·소셜로그인 | 새 `jti` 발급 → `SADD` |
| `POST /api/auth/reissue` | `SISMEMBER` 확인 → **access·refresh 모두 새로 발급** → 옛 `jti` `SREM`, 새 `jti` `SADD` |
| `POST /api/auth/logout` | 해당 `jti` `SREM` (신설) |
| **재사용 감지** | 이미 없는 `jti`가 오면 탈취로 보고 `DEL rt:{memberId}` — 그 회원의 **전 기기 로그아웃** |

**확정 규칙**

* **fail-closed.** Redis에 못 붙으면 `TOKEN_STORE_UNAVAILABLE`(503-01)로 거부한다. 철회를 도입하는 목적이 "무효화가 실제로 먹히게" 하는 것인데, fail-open이면 Redis를 죽이는 것만으로 철회를 무력화할 수 있다. Redis는 BE와 같은 compose 안에 있어 사실상 별도 장애점이 아니다.
  * **막히는 범위는 `reissue`만이 아니라 토큰 발급 전체다** — 로그인·소셜 로그인도 503이 된다. 발급은 됐는데 화이트리스트 등록에 실패하면 그 refresh는 태어나자마자 무효라, 사용자가 로그인 직후 튕기는 것보다 503이 정직하다.
  * **인증과 무관한 경로는 계속 산다.** 공개 조회(`/api/public/**`)와 이미 발급된 access로 하는 요청은 Redis를 보지 않으므로 그대로 동작한다. 즉 Redis 장애 = "로그인/갱신만 중단", 서비스 전면 중단이 아니다. (2026-09-08 로컬에서 Redis를 실제로 내려 확인)
* **`reissue`는 role을 DB에서 다시 읽는다.** 이전에는 refresh claim의 role을 그대로 새 access에 옮겨 담았고, 그래서 **ADMIN에서 강등해도 최대 14일간 ADMIN access가 계속 발급**됐다. 무상태를 유지하려고 DB 조회를 뺀 설계였으나, 상태를 갖기로 한 이상 함께 고친다.
* 의존 방향을 지키기 위해 role 조회는 `global.security`에 둔 포트 인터페이스(`MemberRoleProvider`)로 하고 구현을 MEMBER 도메인에 둔다. `global`이 `domain`을 직접 참조하지 않는다.
* 저장소도 인터페이스(`RefreshTokenStore`)로 두어 테스트가 Redis 없이 인메모리 구현으로 돈다.

**에러 코드 추가**

| 코드 | resultCode | 사유 |
|---|---|---|
| `REVOKED_TOKEN` | 401-09 | 철회·회수되었거나 재사용이 감지된 refresh |
| `TOKEN_STORE_UNAVAILABLE` | 503-01 | Redis 장애(fail-closed) |

**FE 영향**

* `lib/server/session.ts` — `reissue` 응답에 refresh가 함께 오므로 쿠키 **두 개**를 갱신한다(`setAuthCookies`).
* `app/api/bff/logout` — 쿠키만 지우지 않고 BE `POST /api/auth/logout`을 먼저 호출한다.

---

## 5. 페이징

* 목록 조회는 Spring `Pageable`을 사용한다.
* 응답은 페이지 정보(전체 개수, 페이지 번호, 크기)를 포함한다.

---

## 6. DTO 규칙

* 요청 DTO와 응답 DTO를 분리한다.
* Entity ↔ DTO 변환은 도메인 내부(서비스 또는 DTO 정적 팩토리)에서 처리한다.
* Entity를 그대로 반환하지 않는다.

---

## 7. 파일 업로드

* 파일 업로드가 필요한 도메인은 `com.back.global.storage.FileService`를 통해 저장한다.
  `FileStorage`(바이트 저장소)를 직접 호출하지 않는다.
* `FileStorage`는 DB를 모른다. key 생성과 메타데이터 영속화는 `FileService`의 책임이다.
* 모든 업로드는 공용 `FileMetadata` 엔티티(`storageKey`/`originalName`/`contentType`/`size`/`uploaderId`)에 기록한다.
* 도메인 엔티티는 `storageKey`를 보관한다. 접근 URL은 `FileService.getUrl(key)`로 만든다(저장하지 않는다).
* key 형식: `{디렉터리}/{yyyy}/{MM}/{dd}/{UUID}.{확장자}`. 원본 파일명은 key에 넣지 않는다.
  * 확장자 판별 시 점(`.`)이 파일명 맨 앞(index 0)에 오면 확장자 없음으로 취급한다(예: `.내파일`). 그렇지 않으면 `.내파일` 같은 dotfile의 원본 파일명 전체가 key로 새어나가 "원본 파일명은 key에 넣지 않는다" 규칙이 깨지고 한글이 공개 URL에 노출된다.
* `FileService.upload(MultipartFile file, String directory, Long uploaderId)`는 빈 파일뿐 아니라 파일명이 없거나 공백인 경우도 `INVALID_FILE`로 거절한다. `uploaderId`는 nullable.
* 허용 contentType·크기 제한 같은 정책은 각 도메인이 정한다. `FileService`는 빈 파일/파일명 없음만 거절한다.

---

## 8. Lombok / 코드 스타일

* 단순 필드 접근자는 손으로 작성하지 않고 Lombok `@Getter`로 생성한다. (클래스/enum 단위 부착, 필드만 유지)
* 파생 값(예: `ErrorCode.getCode()` = `name()`)처럼 필드 접근이 아닌 메서드는 명시적으로 작성한다.
