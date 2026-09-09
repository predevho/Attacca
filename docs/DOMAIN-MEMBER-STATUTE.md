# DOMAIN-MEMBER-STATUTE

회원 도메인 구현 규칙.

> 세부 필드는 구현 착수 시 확정하며, 변경 시 이 문서를 갱신한다. 아래는 설계 기준 초안이다.

---

## 1. 패키지

```
com.back.domain.member
├── controller
├── service
├── repository
├── entity
└── dto
```

---

## 2. 엔티티 (구현 반영)

### Member (구현 완료, 2026-07-13)
* id (내부 신원 식별자, 모든 API가 사용 = JWT subject)
* loginId (자체 로그인 아이디, 유니크. **nullable** — 소셜 전용 회원은 없음)
* password (해시 저장. **nullable** — 소셜 전용 회원은 없음)
* email (인증메일 발송·연락용 + 소셜 자동연결 매칭 키. 유니크, **전원 필수**)
* nickname (활동 표시명, 유니크, 필수)
* role (USER / ADMIN. `global.security.Role` 재사용)
* (BaseEntity 상속: createdAt, updatedAt)
* 팩토리: `createLocal(loginId, encodedPassword, email, nickname)` / `createSocial(email, nickname)`

> 자체 로그인 열쇠는 `loginId`, 이메일은 인증·연락 및 소셜 자동연결 매칭 키다. 내부 신원은 `id`.

### MemberProfile (구현 완료, 2026-07-15)
* id
* member (Member 1:1 단방향, `member_id` unique — Member 쪽엔 참조 없음)
* instruments (`Instrument` enum 21종, `@ElementCollection` `member_profile_instrument`. 장르 필드는 2026-07-15 리뷰에서 제외 — 클래식 중심)
* bio (자기소개, 최대 500자)
* profileImageKey (`FileService` 경유 업로드. URL은 저장하지 않고 `FileService.getUrl`로 생성)
* 생성 시점: 가입 시 만들지 않고 첫 수정/이미지 업로드 때 생성(lazy upsert)

### SocialAccount (구현 완료, 2026-07-13)
* id
* member (Member 연관, ManyToOne, non-null)
* provider (`OAuthProvider` enum. 현재 KAKAO. 이후 GOOGLE 등 확장)
* providerUserId (소셜 측 고유 식별자)
* (provider + providerUserId 조합 유니크)

### MemberConsent (2026-09-09 도입)

* id
* memberId (`Long` 원시값. 회원이 탈퇴해도 동의 사실은 남아야 하므로 연관을 걸지 않는다)
* type (`ConsentType` — TERMS / PRIVACY)
* version (동의한 문서의 버전 문자열. 예: `2026-09-09`)
* agreedAt

**최신 1건이 아니라 이력 전부를 남긴다.** 약관이 바뀌어 다시 동의를 받으면 행이 하나 더 쌓인다.
"언제 무엇에 동의했는가"를 뒤에서 되짚을 수 있어야 하므로 덮어쓰지 않는다.

**탈퇴해도 지우지 않는다.** 이 표에는 개인 식별 정보가 없고(회원 id와 동의 사실뿐),
"동의를 받았는가"에 답하려면 사람이 사라진 뒤에도 남아 있어야 한다.

---

## 3. 인증 규칙

* 자체 가입: `loginId + password + email + nickname`. 비밀번호는 BCrypt 해시로 저장한다. (2026-07-13, 로그인 열쇠를 email→loginId로 전환)
* 로그인 성공 시 JWT access+refresh 쌍을 발급한다. (자체/소셜 동일)

### 3.1 확정된 API (구현 완료: 자체 가입/로그인 + 카카오 소셜, 2026-07-13)

* `POST /api/auth/signup` : 자체 회원가입. body `{loginId, password, email, nickname}` → `SignupResponse{id, loginId, email, nickname, role}`. 인증 없이 접근 가능해야 하므로 `/api/auth/**`(permit) 아래 둔다.
* `POST /api/auth/login` : 자체 로그인. body `{loginId, password}` → `TokenPairResponse{accessToken, refreshToken}`.
* `POST /api/auth/oauth/kakao` : 카카오 소셜 로그인. body `{code, redirectUri}` → `TokenPairResponse`. 프론트가 카카오에서 받은 1회용 인가코드를 전달하면 백엔드가 교환한다.
* 위치: `com.back.domain.member`(controller/service/repository/entity/dto/oauth). `Member.role`은 `global.security.Role` 재사용.
* 에러코드는 전역 `ErrorCode`에 추가한다(도메인 전용 enum 분리는 보류): `EMAIL_ALREADY_EXISTS`(409-01), `NICKNAME_ALREADY_EXISTS`(409-02), `LOGIN_ID_ALREADY_EXISTS`(409-03), `LOGIN_FAILED`(401-07), `OAUTH_EMAIL_UNVERIFIED`(401-08), `OAUTH_PROVIDER_ERROR`(502-01).
* 자체 로그인 실패는 아이디 부재/비밀번호 없음(소셜 전용)/불일치를 구분하지 않고 `LOGIN_FAILED`(401-07)로 응답한다(계정 존재 여부 노출 방지).

#### 소셜 로그인 흐름 (프론트 주도 + 백엔드 코드교환)
* provider 호출은 `OAuthClient` 인터페이스로 추상화(`KakaoOAuthClient`가 RestClient로 code→token→userinfo). 실패는 `OAUTH_PROVIDER_ERROR`.
* 유저정보 확보 후:
  1. `SocialAccount(provider, providerUserId)` 존재 → 그 회원 로그인
  2. 없음 + **이메일 검증됨(is_email_verified)** + 같은 email 회원 존재 → `SocialAccount` 붙여 자동연결 후 로그인
  3. 없음 + 신규 → `Member.createSocial(email, nickname)` 생성(nickname 충돌 시 유니크 생성) + `SocialAccount` 연결
  * **이메일 미검증/미제공 → `OAUTH_EMAIL_UNVERIFIED` 거절** (미검증 이메일 자동연결은 계정 탈취 벡터이므로 금지)
* 카카오 `client-id`/`client-secret`은 env(`KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`) 주입, 커밋 금지.
* 두 방식(자체/소셜) 모두 동일한 `JwtProvider` access+refresh 발급으로 수렴한다.

### 3.2 프로필 API (구현 완료, 2026-07-15 — 모두 인증 필요, principal = JWT 회원 id)

* `GET /api/members/me` (인증) → `{id, nickname, role, verified}`. 프로필과 분리된 공용 신원 소스(작성자/어드민 판정용). verified는 VERIFIED-PERFORMER 파생.
* `GET /api/members/me/profile` : 내 프로필. 미생성 시 빈 기본값(404 아님) → `ProfileResponse{instruments[], bio, profileImageUrl}`
* `PUT /api/members/me/profile` : 전체 교체 upsert. body `{instruments: [코드], bio}` (악기 최대 10개, bio 최대 500자)
* `PUT /api/members/me/profile/image` : multipart(`file`) 이미지 교체. `image/*`만 허용(위반 시 400-02), 새 파일 저장 확정 후 옛 파일 삭제
* `GET /api/members/profile-options` : 악기 선택지 `{code, label}` 목록
* 에러코드 추가: `MEMBER_NOT_FOUND`(404-03)

### 3.3 입력 검증 (2026-09-09 도입)

**2026-09-09 이전에는 검증이 하나도 없었다.** `SignupRequest`에 제약 애노테이션이 없었고
컨트롤러에 `@Valid`도 없어서, 운영에서 비밀번호 `1` / 이메일 `not-an-email` / 닉네임 공백 한 칸으로
가입과 로그인이 됐다. 다른 도메인 DTO에는 검증이 있었는데 **가장 바깥 입구인 MEMBER만** 빠져 있었다.

| 항목 | 규칙 | 왜 |
|---|---|---|
| `loginId` | 4~20자, `^[a-z0-9_]+$` | 대소문자 혼용은 "같은 아이디"로 착각하게 만든다. 로그인 열쇠라 모양을 좁힌다 |
| `password` | 8~64자, 공백 불가 | 길이를 기준으로 삼는다. 특수문자 강제는 오히려 예측 가능한 변형(`Password1!`)을 부른다는 게 NIST 권고다. 상한은 BCrypt 72바이트 한계보다 낮게 |
| `email` | 형식 검증, 최대 254자 | 연락과 소셜 자동연결 매칭 키다. 형식이 깨지면 둘 다 못 한다 |
| `nickname` | 2~20자, **앞뒤 공백 금지** | 표시명이다. 공백만으로 된 닉네임을 막는다 |

* **서버가 `@Valid`로 강제한다.** 화면 검증은 편의일 뿐이다.
* **닉네임은 저장 전에 trim 한다.** MySQL의 기본 collation은 **후행 공백을 무시**해서
  `"홍길동"`과 `"홍길동 "`이 같은 값으로 비교된다. 서버가 다듬지 않으면 유니크 제약이
  의도와 다르게 걸린다(2026-09-09에 빈 닉네임이 `NICKNAME_ALREADY_EXISTS`로 막히는 것으로 드러났다).
* 비밀번호 확인(재입력)은 **화면에서만** 다룬다. 서버로 보내지 않는다 — 서버가 확인할 것이 없고,
  같은 비밀번호를 한 번 더 실어 보낼 이유도 없다.
* `LoginRequest` / `OAuthLoginRequest`도 `@NotBlank`를 붙인다. 빈 요청은 서비스까지 가지 않는다.

### 3.4 동의 (2026-09-09 도입)

* 종류는 둘이며 **둘 다 필수**다: `TERMS`(이용약관), `PRIVACY`(개인정보 수집·이용).
  선택 동의(마케팅 등)는 두지 않는다 — 보내는 것이 없으므로 받을 이유가 없다.
* 버전은 문서 상단의 날짜 문자열(`2026-09-09`)이고 상수로 관리한다. 문서를 고치면 버전을 올린다.
* **가입 시 동의가 없으면 거절한다.** 자체 가입과 소셜 최초 가입 모두 해당한다. `CONSENT_REQUIRED`(400-04).
* 소셜 경로: 최초 가입인지 여부는 코드를 교환해 봐야 알 수 있다. 그래서
  **FE가 카카오로 보내기 전에 동의를 받고**, 그 사실을 콜백까지 실어 보낸다.
  BE는 **신규 생성 경로에서만** 동의를 요구한다(이미 있는 회원의 로그인은 막지 않는다).
* 기존 회원(이 규칙 도입 전 가입자)은 동의 이력이 없다. 소급해 만들지 않는다 —
  받지 않은 동의를 있었던 것처럼 기록하는 것이 더 나쁘다.

### 3.5 회원 탈퇴 (2026-09-09 도입)

* `DELETE /api/members/me` (인증). **되돌릴 수 없다.**
* **사람은 지우고 글은 남긴다.** 작성물까지 지우면 남의 글타래가 무너진다.
  작성자 표시는 `탈퇴한 회원`으로 바뀐다.
* 처리 내용:
  * `loginId` → `null`, `password` → `null` (자체 로그인 차단)
  * `email` → `deleted-{id}@attacca.invalid` (유니크 제약 때문에 비울 수 없다. `.invalid`는 RFC 2606이 이 용도로 예약한 TLD라 실수로도 발송되지 않는다)
  * `nickname` → `탈퇴한회원{id}`
  * `MemberProfile` — bio 비우고 프로필 이미지 파일 삭제
  * `SocialAccount` 삭제 (카카오 재로그인으로 되살아나지 않게)
  * `deletedAt` 기록 → 로그인·재발급 차단
  * **refresh 토큰 전부 철회**(`RefreshTokenStore.removeAll`). 안 하면 이미 발급된 토큰으로 최대 14일 계속 접근된다
* 동의 이력(`MemberConsent`)은 남긴다. 위 §2 참고.
* 에러코드: `CONSENT_REQUIRED`(400-04), `MEMBER_ALREADY_WITHDRAWN`(409-07)

---

## 4. 권한 규칙

* 신규 회원 기본 권한은 `ROLE_USER`.
* `ROLE_ADMIN` 부여/회수는 관리 기능으로만 수행한다. (일반 API로 노출하지 않음)

### 4.1 어드민 부트스트랩 (2026-09-09 도입)

**첫 어드민을 만들 방법이 없었다.** 코드에 ADMIN을 부여하는 경로가 전혀 없어 DB를
직접 고쳐야 했고, 그러지 않으면 배포된 서비스는 **영영 공지를 못 올리고 인증 연주자를
승인할 수 없었다.** 운영 구멍이었다.

* 환경변수 `ADMIN_LOGIN_IDS`(쉼표 구분)에 적힌 loginId를 **기동 시 ADMIN으로 올린다.**
* **올리기만 한다. 내리지 않는다.** 목록에서 이름을 빼도 강등되지 않는다 —
  설정 파일 한 줄로 운영자가 조용히 사라지면 그게 더 위험하다. 회수는 사람이 판단해서 한다.
* **계정을 만들지 않는다.** 없는 loginId는 경고만 남기고 넘어간다. 기동을 막지 않는다 —
  어드민 하나 때문에 서비스 전체가 안 뜨는 것이 더 나쁘다. 가입한 뒤 다시 띄우면 올라간다.
* **이미 ADMIN이면 아무것도 하지 않는다.** 여러 번 떠도 로그가 늘지 않는다.
* **모든 승격을 로그로 남긴다.** 권한이 조용히 올라가는 일이 없어야 한다.
* 값이 비어 있으면(기본) 아무 일도 하지 않는다.

**승격 후에는 다시 로그인해야 한다.** access 토큰(30분)에 role이 박혀 있어 기존 토큰은
계속 USER로 취급된다. 재발급은 role을 DB에서 다시 읽으므로 그쪽이 더 빠르다
(`DOMAIN-COMMON-STATUTE.md` §4.1).

**신뢰 경계**: 이 환경변수를 쥔 사람이 어드민을 만들 수 있다. DB 접근 권한과 같은
수준이며, DB 자격증명을 나눠 주는 것보다 낫다. 값은 커밋하지 않는다.

> 어드민이 다른 회원을 승격시키는 API는 아직 없다. 두 번째 어드민도 이 환경변수로 만든다.

---

## 5. 주요 기능(초안)

* 회원가입 (자체)
* 로그인 (자체 / 소셜)
* 내 프로필 조회/수정 (BE 2026-07-15, FE 화면 2026-07-16 완료)
* 프로필 이미지 업로드 (FileStorage 경유; FE 즉시 업로드 2026-07-16 완료)
* 다른 회원 프로필 조회 (공개 범위 내)

---

## 6. 테스트

* 회원가입/로그인 성공·실패 케이스
* 중복 loginId/email/nickname 검증
* 소셜 로그인 신규/기존 분기
* 권한별 접근 제어
