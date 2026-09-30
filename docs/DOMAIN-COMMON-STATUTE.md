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
* access 요청은 무상태(STATELESS) JWT 기반이며, 장기 로그인 상태는 Redis 로그인 세션으로 관리한다. `csrf`/`formLogin`/`httpBasic`은 비활성.
* 구성:
  * `JwtProvider` : access JWT·온보딩 티켓 발급·파싱·검증(HS256, self-issued).
  * `RefreshSessionStore` : opaque 로그인 세션을 Redis에 저장·조회·철회한다. 원문 세션 값은 저장하지 않는다.
  * `JwtProperties` : `jwt.secret`(env 주입), access 만료와 로그인 세션 TTL(ms).
  * `JwtAuthenticationFilter` : Bearer access 검증 → `SecurityContext` 세팅. 실패 시 사유 ErrorCode 를 request 속성에 저장.
  * `SecurityConfig` : `SecurityFilterChain`(인가 규칙 + 필터·핸들러 등록), `PasswordEncoder`(BCrypt) 빈.
  * `JwtAuthenticationEntryPoint`(401)/`JwtAccessDeniedHandler`(403) : 필터 체인 실패를 `ApiResponse` JSON 으로 직접 응답(전역 핸들러가 못 잡으므로).
  * `Role`(enum USER/ADMIN, `authority()`→`ROLE_x`). MEMBER 의 `Member.role` 이 재사용.
  * `AuthController` `POST /api/auth/reissue` : 로그인 세션을 Redis에서 확인하고 현재 회원 role을 다시 읽어 새 access만 발급한다.
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

* 소셜 로그인(OAuth2): provider 인증 성공 → 회원 조회/생성 → access JWT + 로그인 세션 발급 흐름으로 수렴 (MEMBER 도메인에서 구현).

### 4.1 Opaque 로그인 세션·철회 (2026-09-27)

access JWT는 30분짜리 Bearer 인증 수단이고, 장기 로그인은 14일 TTL의 무작위 opaque 세션 ID로 분리한다. 상세 선택 근거와 참고 자료는 [설계 문서](../superpowers/specs/2026-09-27-opaque-refresh-session-design.md)를 따른다.

**저장 구조**

```
브라우저 HttpOnly 쿠키: access_token, refresh_session
Redis: auth:refresh:{SHA-256(sessionId)} -> memberId
       auth:refresh:member:{memberId} -> session key Set
```

Redis에는 세션 원문이나 refresh JWT를 저장하지 않는다. raw 세션 ID를 아는 브라우저만 재발급할 수 있고, Redis의 키 삭제만으로 즉시 철회한다.

| 동작 | 처리 |
|---|---|
| 로그인·소셜 로그인·온보딩 완료·비밀번호 변경 | access JWT와 새 `refresh_session`을 발급하고 Redis에 해시 키를 TTL과 함께 저장 |
| `POST /api/auth/reissue` | `refreshSession` 해시 조회 후 현재 role을 다시 읽어 access JWT만 새로 발급 |
| `POST /api/auth/logout` | Redis의 해당 세션을 먼저 철회하고, 브라우저 쿠키 두 개를 삭제 |
| 비밀번호 변경·회원 탈퇴 | 회원의 Redis 세션을 모두 철회 |

**확정 규칙**

* **고정 TTL.** 재발급은 opaque 세션을 회전하지 않고 access만 갱신한다. 회전과 grace period는 다중 탭·다중 기기 수요가 확인된 뒤 별도 설계로 도입한다.
* **fail-closed.** Redis에 못 붙으면 로그인·소셜 로그인·재발급을 `TOKEN_STORE_UNAVAILABLE`(503-01)로 거부한다. 공개 요청과 이미 발급된 access JWT 요청은 계속 동작한다.
* **role 재조회.** 재발급 때 `MemberRoleProvider`로 현재 role을 읽어 권한 변경을 즉시 반영한다.
* **로그아웃 실패 표시.** BFF는 쿠키를 항상 삭제하지만, 서버 철회를 확인하지 못하면 503과 `서버 세션 철회를 확인하지 못했습니다.`를 반환하고 UI가 이를 표시한다.
* **배포 호환성.** 기존 `refresh_token` JWT 쿠키는 호환되지 않으므로 배포 후 한 번 재로그인이 필요하다.

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
* `com.back.global.storage.adapter.FileStorage`는 DB를 모른다. key 생성과 메타데이터 영속화는 `FileService`의 책임이다.
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
