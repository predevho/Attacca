# Attacca

**음악인 커뮤니티** — 연주회를 알리고, 함께 연주할 사람을 찾고, 서로 이야기하는 공간.

서로 모르는 연주자들이 자신의 연주회를 소개하고(PERFORMANCE), 구인 공고로 함께할 사람을 찾고(RECRUITMENT),
자유롭게 소통하며(FEED), 1:1로 이야기한다(CHAT). 인증 연주자 심사를 거친 사람만 공연을 올릴 수 있다(VERIFIED-PERFORMER).

> **Attacca** — 악장 사이를 쉬지 않고 바로 이어 연주하라는 악상 기호.

---

## 이 프로젝트의 성격

**LLM 에이전트로 개발한 프로젝트입니다.** 코드보다 먼저 **문서**가 있고, 에이전트는 그 문서를 근거로만 작업합니다.

`docs/`에는 문서 26개와 학습 기록(TIL) 13개가 있고, 다음 두 층으로 나뉩니다.

| 층 | 파일 | 역할 |
|---|---|---|
| 원칙 | `*-CONSTITUTION.md` | 왜 그렇게 하는가. 임의로 바꾸지 않고, 바꿔야 하면 보고한다 |
| 규칙 | `*-STATUTE.md` | 어떻게 구현하는가. 필드·엔드포인트·에러코드까지 |

이 구조가 실제로 설계를 막아선 적이 있습니다. 홈 달력이 **공연 + 공지**를 함께 보여줘야 해서
"BE가 둘을 합쳐 한 응답으로 내려주자"고 정했는데, `ARCHITECTURE-CONSTITUTION §2`의
**"BE는 화면(뷰) 로직을 갖지 않는다"**와 정면으로 부딪혔습니다. 원칙을 고치는 대신 합성을 BFF로 옮겼고,
BE는 도메인별 범위 조회만 제공합니다. 이런 판단과 근거는 전부 `docs/AI-ACTION-LOGS.md`에 남아 있습니다.

규칙을 문서에만 두지 않고 **타입으로 강제**하기도 합니다. 공개 API는 회원 id를 노출하면 안 되는데,
기존 `MemberDisplay`는 `@JsonProperty("id")`로 회원 id를 직렬화합니다. 그래서 공개 응답 전용으로
회원 id가 **아예 없는** `PublicMemberDisplay`를 따로 두었습니다 — 실수로 새는 일이 구조적으로 불가능해집니다.

---

## 화면

| 화면 | 경로 | 설명 |
|---|---|---|
| 홈 | `/` | **비로그인 공개.** 자동 전환 캐러셀(공연·공지) + 게시글 위젯(최신/인기) + 월간 달력 |
| 피드 | `/feed` | 무한 스크롤 타임라인, 인라인 작성, 게시글·댓글 좋아요 |
| 공연 | `/performances` | 다가오는/지난 탭, 2단계 등록 마법사, 포스터 업로드 |
| 구인 | `/recruitments` | 모집중/마감 탭, 악기 필터, 지원·수락·거절 플로우 |
| 채팅 | `/chat` | 1:1 실시간 송수신(STOMP), 안읽은 수, 읽음 커서 |
| 프로필 | `/profile` | 악기·자기소개 수정, 프로필 이미지 즉시 업로드 |
| 인증 연주자 | `/verified-performer` | 신청·상태 확인 / 어드민 심사 화면 별도 |

디자인은 **헨레(G. Henle) 악보**에서 가져왔습니다 — 크림색 종이, 잉크 검정, 표지의 dove-blue.
시맨틱 색 토큰 15종으로 라이트/다크 두 팔레트를 운영하며, **컴포넌트는 다크를 알지 못합니다**(값만 교체).
헤더만 명암이 반전됩니다 — 라이트에서는 짙은 표지, 다크에서는 밝은 표지가 어둠 위로 떠오릅니다.

<!-- 스크린샷(라이트/다크)은 별도 캡처 후 docs/images/ 에 추가 예정 — TODO-BACKLOG "화면 스크린샷 확보" -->

---

## 기술 스택

**백엔드** — Spring Boot 3.4.5 / Java 21 / MySQL 8.4 / Gradle 8.11.1

- Spring Security + JWT(access·refresh 무상태) + OAuth2(카카오)
- WebSocket(STOMP) — 인메모리 Simple Broker
- Spring Data JPA, Bean Validation
- 파일 저장 추상화(`FileStorage`): 로컬 기본, S3 opt-in

**프론트엔드** — Next.js 16(App Router) / React 19 / TypeScript / Tailwind CSS v4 / Vitest

- **BFF 3계층**으로 토큰을 UI에서 격리 (`lib/server/*` → `app/api/bff/**` → UI)
- 통신은 네이티브 `fetch`. HTTP 라이브러리를 두지 않았습니다
- 실시간 채팅만 예외적으로 `@stomp/stompjs` 사용

---

## 아키텍처

### 도메인 7개

| 도메인 | 책임 |
|---|---|
| MEMBER | 회원가입/로그인(JWT + 카카오), 프로필, 권한(USER/ADMIN) |
| VERIFIED-PERFORMER | 인증 연주자 신청 → 어드민 승인·거절·철회, 뱃지 |
| FEED | 게시글·댓글·좋아요, 타임라인 |
| PERFORMANCE | 연주회 등록·홍보(일시·장소·프로그램·포스터) |
| RECRUITMENT | 구인 공고 + 지원 상태머신 |
| CHAT | 1:1 / 그룹 실시간 채팅 |
| NOTICE | 운영자 공지·소식·일정 (홈 캐러셀·달력의 원천) |

도메인끼리는 **엔티티를 직접 참조하지 않고 서비스 계층으로만 협력**합니다.
예를 들어 게시글은 작성자를 원시 `authorId`(Long)로만 들고 있고, 닉네임·인증뱃지는 읽는 시점에
`MemberQueryService.findDisplaysByIds`로 **배치 조회**해 붙입니다(연관이 없으니 fetch join이 불가능하고,
그래서 N+1을 IN 배치로 막습니다).

### 토큰이 브라우저 JS에 닿지 않는 구조

```
브라우저 ──(httpOnly 쿠키)──> Next.js BFF ──(Bearer)──> Spring BE
```

UI 코드는 토큰을 다루지 않습니다. 쿠키는 httpOnly라 `document.cookie`로 읽히지 않고,
BFF가 서버에서 꺼내 `Authorization` 헤더로 바꿔 답니다. 브라우저가 BE를 직접 호출하지 않으므로
웹 경로에는 **CORS가 필요 없습니다**.

### 공개 경로와 인증 경로의 분리

홈이 공개 랜딩이라 비인증 읽기가 필요합니다. 인증 경로를 열어주는 대신 **별도 컨트롤러·별도 DTO**를 둡니다.

| | 인증 | 공개 |
|---|---|---|
| 경로 | `/api/**` | `/api/public/**` (permitAll) |
| 쓰기 | 있음 | **없음** |
| 회원 식별자 | 노출 | **비노출** |
| 보는 사람 종속 값(`likedByMe`) | 있음 | **없음** (계산 자체가 불가) |

DTO를 공유하지 않는 이유는 단순합니다. 하나를 공유하면 나중에 추가된 필드가 공개로 새는지
**아무도 알아채지 못합니다.** 분리해 두면 공개 노출이 항상 명시적 선택이 됩니다.

---

## 실행

### 사전 준비

- JDK 21 (⚠️ Gradle 8.11.1은 JDK 25에서 Kotlin DSL 컴파일에 실패합니다. `JAVA_HOME`을 21로 맞추세요)
- Node.js 20+
- Docker (MySQL 용)

### 1. 데이터베이스

```bash
docker compose up -d
```

MySQL 8.4가 `3306`에 뜹니다(DB `attacca`).

### 2. 백엔드

```bash
cd BE && ./gradlew bootRun
```

`http://localhost:8080`. 데이터소스는 환경변수(`DB_URL`/`DB_USERNAME`/`DB_PASSWORD`)로 주입되며
기본값은 compose와 맞춰져 있습니다. 시스템에 `DB_PASSWORD`가 이미 있으면 그 값이 이기므로,
접속이 거부되면 명령행으로 덮어쓰세요.

```bash
./gradlew bootRun "--args=--spring.datasource.password=attacca-local"
```

### 3. 프론트엔드

```bash
cd FE && npm install && npm run dev
```

`http://localhost:3000`. BE 주소는 `FE/.env.local`의 `BE_BASE_URL`로 바꿀 수 있습니다.

> 카카오 로그인을 쓰려면 `KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`(BE)와
> `KAKAO_CLIENT_ID`/`KAKAO_REDIRECT_URI`(FE)가 필요합니다. 키는 커밋하지 않습니다.

---

## 테스트

```bash
cd BE && ./gradlew test     # 373개
cd FE && npm test           # 353개
```

백엔드 테스트는 H2 `test` 프로파일에서 돕니다(`@SpringBootTest`에는 `@ActiveProfiles("test")` 필수).
프론트엔드는 Vitest + Testing Library.

테스트는 "동작한다"보다 **"이 규칙이 지켜지는가"**를 겨냥합니다. 예를 들어 공개 조회 테스트는
응답 본문에 회원 id가 **값으로도** 들어 있지 않은지 확인합니다 — 필드명을 바꿔도 잡히도록.

---

## 현재 상태

BE 7개 도메인과 FE 전 화면이 동작하고, 실환경(MySQL + BE + FE 동시 기동) 브라우저 검증을 마쳤습니다.
**아직 배포 전**이며, 배포 전에 결정해야 할 것들은 `docs/TODO-BACKLOG.md`의 "배포" 절에 정리돼 있습니다.

알려진 제약:

- **채팅은 단일 서버에서만 정확합니다.** STOMP가 인메모리 Simple Broker이고 presence도 인메모리라,
  스케일아웃하려면 Redis(`enableStompBrokerRelay`) 도입이 선행돼야 합니다. 도메인 코드는 그대로 둡니다.
- 스키마는 `ddl-auto: update`입니다. 운영 전환 시 `validate` + Flyway로 내려야 합니다.
- S3 연동은 코드만 있고 실자격증명 검증 전입니다.

---

## 문서

| 문서 | 내용 |
|---|---|
| `docs/CONTEXT.md` | 지금 작업에 필요한 최소 정보(캐시). 로그 저장소가 아님 |
| `docs/ARCHITECTURE-*.md` | 아키텍처 원칙과 구현 규칙 |
| `docs/DOMAIN-*.md` | 도메인별 원칙·규칙 (도메인 문서 없이 구현하지 않음) |
| `docs/TODO-*.md` | READY / DOING / BACKLOG / DONE |
| `docs/AI-ACTION-LOGS.md` | 작업 로그 — 무엇을 왜 그렇게 했는지 |
| `docs/AI-MAJOR-EVENT*.md` | 주요 결정과 사건 |
| `docs/TIL/` | 학습 기록 |
