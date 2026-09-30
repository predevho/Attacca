# ARCHITECTURE-STATUTE

아키텍처 구현 규칙. 구조가 바뀌면 이 문서를 갱신한다.

---

## 1. 기술 스택

### Backend

* 언어/런타임: Java 21
* 프레임워크: Spring Boot 3.4.x (안정 버전 사용, 4.x는 사용하지 않는다)
* 빌드: Gradle (Kotlin DSL, `build.gradle.kts`)
* 데이터: Spring Data JPA + MySQL (로컬 개발은 레포 루트 `docker-compose.yml`의 MySQL 8.4, `docker compose up -d`. 테스트는 H2 `test` 프로파일)
* 보안: Spring Security
  * 자체 회원가입: JWT 기반 인증
  * 소셜 로그인: OAuth2 (카카오/구글 등)
* 실시간 채팅: WebSocket(STOMP) + 단일 인스턴스 Simple Broker. Redis는 refresh 토큰 allowlist에 사용하며 STOMP broker가 아니다.
* 파일 저장: `FileStorage` 인터페이스로 추상화 — 현재 EC2 로컬 Docker volume / AWS S3 서울 리전(opt-in, `storage.type=s3`) 두 구현체. S3는 운영 기동 검증 전이다.
* 임시 첨부 정리: Spring Scheduling으로 만료된 `TEMPORARY` 첨부를 정리한다.

### Frontend

* Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS v4 / Vitest. 패키지 매니저 npm.
* 위치: `FE/`. BE와 독립 실행(`cd FE && npm run dev`, 기본 :3000).
* **BFF 패턴**: 브라우저는 Next(same-origin)하고만 통신하고, Next 서버가 Spring을 서버 간 호출한다.
  토큰은 httpOnly 쿠키(`access_token`/`refresh_token`)로 다루며 UI JavaScript는 토큰을 만지지 않는다.
  * 계층: `lib/server/*`(순수 로직·쿠키·reissue) → `app/api/bff/**`(라우트 핸들러 글루) → `app/**`(UI).
  * BE 호출 주소는 서버 env `BE_BASE_URL`(클라이언트 노출 금지). 통신은 네이티브 fetch(라이브러리 미도입).
  * 소셜 로그인: 카카오는 서버 라우트 `/api/bff/oauth/kakao/start`(state 발급→카카오 302)와 `/api/bff/oauth/kakao/callback`(state 대조→BE 코드교환→쿠키)로 처리. CSRF `state`는 서버 생성·httpOnly 쿠키(`oauth_state`)·단일사용. 신규 회원은 정식 access/refresh가 아닌 짧은 수명의 온보딩 티켓으로 닉네임 설정·필수 동의 화면에 진입하고, 완료 시 정식 토큰을 발급한다. BE `OnboardingCompletionFilter`가 완료 전 일반 API를 막는다. `KAKAO_CLIENT_ID`/`KAKAO_REDIRECT_URI`는 서버 env.
  * 프로필: `/profile`(조회/수정 모드) + BFF `PUT /api/bff/me/profile`(악기·자기소개), `PUT /api/bff/me/profile/image`(멀티파트 즉시 업로드), `GET /api/bff/profile-options`. 멀티파트 위해 `beFetch`는 body가 FormData면 content-type을 붙이지 않는다.
  * 화면 라우트는 데이터 요청·상태·lifecycle을 조합하고, 재사용 가능한 화면 조각은 `components/<domain>/`에 둔다. 통신·스크롤처럼 ref와 cleanup을 공유하는 orchestration은 근거 없이 UI 컴포넌트나 범용 hook으로 옮기지 않는다.
  * 복잡한 화면을 기능 단위로 분리할 때는 `features/<domain>/` 아래에 화면 조각(`components`), 상태 조정(`hooks`), 화면 전용 모델(`model`), 기존 HTTP primitive를 호출하는 어댑터(`api`)를 둔다. 경로 진입점인 `app/**/page.tsx`는 조립만 담당하며, BFF 라우트는 파일 시스템 경로 유지를 위해 이동하지 않는다. 현재 `/profile`에 적용했다.
* 동일 BE API를 모바일 앱이 재사용할 수 있도록 API 소비 방식을 플랫폼 독립적으로 유지한다.

---

## 2. BE 패키지 구조

도메인별 패키지 + 계층형 구조를 사용한다.

```
com.back
├── domain
│   ├── member
│   │   ├── controller
│   │   ├── service
│   │   ├── repository
│   │   ├── entity
│   │   └── dto
│   ├── verifiedperformer
│   ├── feed
│   ├── performance
│   ├── recruitment
│   ├── chat
│   ├── notice
└── global
    ├── config          // 설정 (Security, WebSocket, JPA, S3 등)
    ├── security        // 인증/인가, JWT, OAuth2
    ├── exception       // 전역 예외 처리, 공통 예외, 에러 코드
    ├── common          // BaseEntity, 공통 응답 래퍼 등
    └── storage         // FileStorage 인터페이스 및 구현
```

* 각 도메인은 위 계층(controller/service/repository/entity/dto)을 자체적으로 갖는다.
* 도메인 간 협력은 서비스 계층을 통해서만 한다.

---

## 3. 파일 저장 규칙

* 파일 저장 접근은 반드시 `FileStorage` 인터페이스를 통해서만 한다. 도메인 서비스가 S3 SDK나 물리 경로를 직접 다루지 않는다.
* 저장 결과는 물리 경로가 아니라 **논리 key + 접근 URL**로 다룬다.
* 구현체는 둘이다. `storage.type` 설정으로 하나만 활성화된다.
  * `local` (기본값) : `LocalFileStorage` — 로컬 디스크에 저장하고 `/files/**`로 서빙한다.
  * `s3` : `S3FileStorage` — AWS SDK v2 사용.
* 접근 URL은 `base-url + key`로 만든다. 이 `base-url`이 CloudFront/R2 등으로 갈아타는 **단일 교체 지점**이다.
* 업로드는 서버 경유 방식으로 시작한다. (추후 필요 시 Presigned URL 직접 업로드로 확장 가능)
* 업로드 파일 메타데이터는 공용 `FileMetadata` 엔티티에 저장한다. (`DOMAIN-COMMON-STATUTE §7`)
* S3 자격증명·버킷명은 환경변수로 분리하며 저장소에 커밋하지 않는다.

---

## 4. 실시간 채팅 규칙

* 클라이언트-서버 실시간 통신은 WebSocket(STOMP)으로 한다.
* **현재 구현은 단일 BE 인스턴스의 Simple Broker와 인메모리 `PresenceRegistry`다.** Redis는 refresh 토큰 화이트리스트에만 쓴다.
* 블루/그린처럼 BE 인스턴스가 겹치는 배포를 시작하기 전, RabbitMQ 또는 ActiveMQ 같은 외부 STOMP broker relay와 공유 `PresenceRegistry`를 설계·구현해 메시지·접속 상태를 공유한다. Redis는 presence 보조 저장소 후보일 뿐 `enableStompBrokerRelay`의 직접 대상이 아니다. 전환 전에는 BE 두 벌을 동시에 운영하지 않는다.
* 채팅 메시지는 DB에 영속화한다. (히스토리 조회 지원)

---

## 5. 배포

* 목표 운영 구조는 Vercel FE와 EC2 BE를 분리한다. `https://attacca.site`는 Vercel(Next.js+BFF), `https://api.attacca.site`는 EC2(Nginx+BE+Redis+로컬 파일)다.
* 브라우저 REST 요청은 `attacca.site/api/bff/**`로 Vercel BFF에 보내고, BFF가 서버 간 통신으로 `api.attacca.site`의 BE를 호출한다. WebSocket과 파일 URL만 브라우저가 `api.attacca.site`에 직접 연결한다.
* 현재 EC2 BE는 단일 Compose 서비스로 배포한다. Blue/Green은 외부 STOMP broker relay, 공유 presence, EC2 메모리 측정, Nginx upstream 전환 절차를 설계·검증한 뒤에만 도입한다. 전환 때 WebSocket은 재연결될 수 있으며, 배포 전후의 DB 마이그레이션은 구·신 버전 호환이 가능한 expand/contract 방식만 허용한다.
* AWS 기존 자원은 Terraform으로 새로 만들지 않고 import해 관리한다. 상태는 버전 관리된 S3 원격 backend와 S3 lockfile로 보관하며, 런타임 비밀값은 Terraform 상태나 저장소에 넣지 않는다.
* 상세 전환 설계와 순서는 `docs/superpowers/specs/2026-09-17-vercel-api-blue-green-terraform-design.md`를 정본으로 한다. 구현 전까지 현재 단일 Compose 배포가 운영 정본이다.

---

## 6. 테스트 규칙

* 도메인별 단위 테스트와 통합 테스트를 작성한다.
* 가능하면 TDD로 진행한다.
* 모든 테스트/린트 통과를 작업 완료의 기준으로 한다.

---

## 7. 조회·변경 서비스 경계

* 읽기와 변경이 서로 다른 의존성과 규칙을 가질 때, 조회 서비스와 변경 서비스를 분리한다.
* 공지 도메인은 `NoticeQueryService`가 공개·관리자 조회와 읽기 DTO 변환을, `NoticeCommandService`가 등록·수정·삭제·파일 변경을 맡는다.
* 공유 응답 변환은 별도 assembler에 두되, HTTP 경로·DTO 계약을 바꾸는 이유로 사용하지 않는다.
