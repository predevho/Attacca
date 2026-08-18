# TODO-BACKLOG

아직 시작하지 않은 예정 작업.

---

## 도메인 문서화 (구현 전 필수)

* [x] ~~DOMAIN-VERIFIED-PERFORMER-CONSTITUTION.md / STATUTE.md~~ (2026-07-15 작성 완료)
* [x] ~~DOMAIN-FEED-CONSTITUTION.md / STATUTE.md~~ (2026-07-17 작성 완료)
* [x] ~~DOMAIN-PERFORMANCE-CONSTITUTION.md / STATUTE.md~~ (2026-07-22 작성 완료)
* [x] ~~DOMAIN-RECRUITMENT-CONSTITUTION.md / STATUTE.md~~ (작성 완료 — 2026-08-18 문서 상태 점검에서 체크 누락 정정)
* [x] ~~DOMAIN-CHAT-CONSTITUTION.md / STATUTE.md~~ (작성 완료 — 2026-08-18 문서 상태 점검에서 체크 누락 정정)

## FE 화면 (도메인별 완료)

* [x] ~~FE: 구인(RECRUITMENT) 화면~~ — 2026-08-12 완료(TDD 15태스크). 공고 CRUD/목록/마감 + 지원 플로우. main 병합 완료. 설계·계획 `docs/superpowers/{specs,plans}/2026-08-12-recruitment-fe*`.
* [x] ~~FE: 인증 연주자(VERIFIED-PERFORMER) 화면~~ — 2026-08-12 완료(TDD 11태스크). 회원 신청/상태 + 어드민 심사/직접지정. main 병합 완료. 설계·계획 `docs/superpowers/{specs,plans}/2026-08-12-verified-performer-fe*`.
* [x] ~~FE: 채팅(CHAT) 화면 MVP~~ — 2026-08-12 완료(TDD 7태스크). 방 목록/대화창 실시간 송수신/1:1 시작/읽음. main 병합 완료. 설계·계획 `docs/superpowers/{specs,plans}/2026-08-12-chat-fe*`.

## 구인 FE 후속 (2026-08-12 범위 밖으로 남긴 Minor)

* [ ] FE 구인: 상세 페이지 지원자 목록이 첫 페이지(최대 20명)만 로드 — 20명 초과 시 페이지네이션/더보기 필요. 현재는 명시적으로 첫 페이지만.
* [ ] FE 구인: PostingCard/상세의 악기 표시가 enum명(PIANO 등) 그대로 — profile-options의 label 맵을 넘겨 한글 라벨로 변환. 목록 성능 위해 이번엔 단순화.
* [ ] FE 구인: 상세 지원 여부 사전판정이 없어 이미 지원한 공고도 "지원하기"가 보임(제출 시 409로 안내). 필요하면 /applications/me 교차조회로 선제 비활성화 검토.
* [ ] FE 구인 a11y: 목록 PostingCard의 `<article onClick>` 키보드 도달 불가(피드/공연 카드와 동일 갭) — role/tabIndex/onKeyDown. 모바일 이식과 연계.
* [ ] FE 구인: 상세 지원 실패(409) 에러가 페이지 상단(`<dl>` 위)에 뜨는데 `ApplyPanel`은 하단이라 스크롤해야 보임 — 에러를 액션 지점(패널) 근처에 렌더하거나 토스트로. (최종 리뷰 Minor)
* [ ] FE 구인: 마감/수락/거절 버튼에 진행 중 비활성화·중복클릭 가드 없음(지원 제출만 submitting으로 막힘) — 연타 시 중복 요청 가능. (최종 리뷰 Minor)

## 인증 연주자 FE 후속 (2026-08-12 범위 밖으로 남긴 Minor)

* [ ] BE+FE: 어드민 신청 목록에 회원 표시정보(닉네임) 노출 — 현재 응답은 `memberId`만 → FE가 "회원 #{id}"로만 표시. BE에 표시정보 확장(예: `MemberQueryService.findDisplaysByIds` 협력) 후 FE 반영.
* [ ] FE 인증연주자: 증빙 링크 URL 형식 검증(현재는 개수/공백만 검증, 형식 미검증).
* [ ] FE 인증연주자: 어드민 목록·회원 상태의 "회원측 PENDING 신청 취소"는 BE 엔드포인트 없어 미구현 — 필요 시 BE 추가 후 FE 반영.
## 채팅 FE 후속 (2026-08-12 MVP 범위 밖)

* [ ] FE 채팅: 그룹 방 생성/초대/퇴장 UI(BE는 `POST /rooms`(GROUP)·`POST /rooms/{id}/participants`·`DELETE /participants/me` 제공).
* [ ] FE 채팅: 타이핑 표시(STOMP `/typing` 프레임 수신·표시), presence(`ParticipantView.online`) 표시.
* [ ] FE 채팅: 회원 검색/디렉터리 — 현재 1:1 시작이 회원 id 입력. 닉네임 검색 API(BE 신규) 후 개선.
* [ ] FE 채팅: WS 토큰 만료 완전 처리 — 현재는 대화창 진입 시 REST 선행 reissue에 의존. access 만료 중 재연결 시 ws-token이 stale일 수 있음(전용 단수명 WS 티켓 BE 도입 검토).
* [ ] FE 채팅: 대화창 `markRead`를 `setMessages` 업데이터 내부에서 호출 — StrictMode 이중호출 시 중복 read POST(BE 멱등이라 무해). 별도 effect로 분리 검토.
* [ ] FE 채팅: 이력 "이전 메시지 더 보기"(현재 첫 페이지만 로드, `nextCursor` 미사용) + 새 메시지 도착 시 스크롤 하단 고정.
* [ ] 배포 시 `NEXT_PUBLIC_BE_WS_URL`을 실제 BE WS 주소(wss)로 설정 + Nginx WebSocket 프록시.

## 기능

* [ ] MEMBER: 소셜 로그인 provider 확장(구글 등 — `OAuthClient` 어댑터 추가) *(카카오는 2026-07-13 완료)*
* [ ] MEMBER: 실제 인증메일 발송(가입 이메일 검증) — 메일 인프라 도입 시
* [x] ~~VERIFIED-PERFORMER: 인증 연주자 신청 → 어드민 승인/거절/철회, 뱃지~~ — 2026-07-16 BE 구현 완료(TDD). 엔티티/상태머신 + 회원 API 2종 + 어드민 API 5종 + `isVerified` 협력 + MEMBER `ProfileResponse.verified` 통합. 에러코드 409-04~06/404-04 추가.
  * 확정한 결정: `memberId`=원시 Long, `GET .../applications/me` 이력없음=200+data:null, 어드민 목록=`?status`+Pageable(createdAt desc, id 타이브레이크), 뱃지는 프로필 미생성 회원도 파생.
  * 남은 범위 밖: 공개 인증자 목록/신청 첨부파일/이력 테이블, 어드민 grant 시 회원 존재 검증(느슨한 결합 유지로 미도입), 실FE 화면.
* [x] ~~FEED: 게시글/댓글/좋아요, 피드 타임라인~~ — 2026-07-17 BE 구현 완료(TDD, 서브에이전트 주도). 엔티티 4종 + 리포지토리(커서/배치) + 서비스 3종 + 컨트롤러 3종 + MEMBER 배치 협력(MemberQueryService). 에러코드 404-05/06. 전 계층 테스트 + 전체 회귀 통과, 최종 전체-브랜치 리뷰 MERGEABLE.
  * 남은 범위 밖: 이미지첨부·대댓글·댓글수정·팔로우타임라인·신고·PERFORMANCE 카드.
* [x] ~~PERFORMANCE: 연주회 등록·홍보~~ — 2026-07-22 BE 구현 완료(TDD, 서브에이전트 주도 6태스크). 엔티티 `Performance`(soft delete) + 리포지토리(scope별) + 서비스(등록 게이팅/CRUD/포스터) + 컨트롤러 + MEMBER 배치 협력 재사용. 에러코드 404-07/403-02. 전 계층 테스트 + 전체 회귀 통과, 최종 전체-브랜치 리뷰 MERGEABLE.
  * 남은 범위 밖: 관심/북마크, 피드 카드 노출, 곡목 구조화, 좌석/예매, 공개 조회, 태그/장르 필터.
* [x] ~~RECRUITMENT: 구인 공고 + 지원~~ — 2026-07-23 BE 구현 완료(TDD, 서브에이전트 주도 8태스크). 구인만(구직은 범위 밖). 엔티티 2종(공고 soft delete + 지원 상태머신) + 리포지토리(scope/instrument `member of` 필터) + 서비스 2종(등록=인증 회원 누구나, 지원 게이팅/상태전이) + 컨트롤러 2종 + MEMBER 배치 협력. 에러코드 404-08/09·409-07~10. instruments N+1은 `@BatchSize`로 해결. 전체 266/266 통과, 최종 리뷰 통과.
  * 남은 범위 밖: 구직 공고, PERFORMANCE 연결(`performanceId`), 지원 첨부파일, 지원자↔작성자 메시징(CHAT), 키워드/태그 검색, 알림, 마감 자동화 배치, `applicationCount` 응답, 공통 `PageResponse<T>` DTO(코드베이스 공통 BACKLOG).
* [x] ~~CHAT: WebSocket(STOMP)+Redis 기반 1:1 / 1:N 채팅~~ — 2026-07-27 BE 구현 완료(TDD, 서브에이전트 주도 14태스크), **main 병합 완료(커밋 `7b5cff4`)**. 통합 방 모델(1:1 directKey 유일성+find-or-create, 그룹 평평한 모델), 인메모리 Simple Broker, CONNECT 프레임 JWT 인증, 읽음/안읽은수·presence·typing. 에러코드 404-10/404-11/403-03/400-03. 전체 307/307 통과.
  * 남은 범위 밖: FE 화면(채팅 UI), 메시지 수정/삭제, 파일 첨부, 메시지 검색, 알림 푸시, RECRUITMENT/PERFORMANCE 채팅 연계.
  * Redis 이연: 다중 서버 확장 시 `enableStompBrokerRelay`로 브로커 교체 + Redis 기반 `PresenceRegistry`(현재 인메모리·단일서버만 정확) + refresh 토큰 로테이션(COMMON-STATUTE §4)을 함께 도입.
  * 리뷰 이연(Minor): (1)DIRECT 방 2스레드 실경합 통합테스트(REQUIRES_NEW 구조는 correct-by-construction, 테스트만 이연), (2)`WebSocketConfig.setAllowedOriginPatterns("*")`를 프로덕션 시 FE origin으로 좁히기, (3)WS 통합테스트 `@AfterEach` 세션 disconnect/`stompClient.stop()` 정리(누수·공유 채널 인터셉터 변경창 하드닝), (4)`StompAuthChannelInterceptor` 미사용 import·`ChatPresenceEventListener` Principal FQN→import 정리.
* [x] ~~FE: MEMBER 프로필 화면(조회/수정/이미지)~~ — 2026-07-16 완료(조회/수정 모드, 이미지 즉시 업로드, beFetch 멀티파트 지원). 라이브 수동 검증까지 성공(멀티파트 실체인: 브라우저→BFF→Spring @RequestPart→디스크→/files/** 서빙→DB key 저장·새로고침 유지). 실이미지 S3 검증만 별개 BACKLOG.
* [x] ~~FE: 카카오 실제 로그인 왕복 수동 검증~~ — 2026-07-15 완료. 실제 카카오 앱 키/Client Secret/Redirect URI/이메일 동의로 브라우저 왕복 성공(로그인→/dashboard). 개인 개발자 비즈 앱 전환, redirect_uri는 `/config/callback`에 등록.

## FE 공통 (정리)

* [ ] FE: BFF 라우트 status 폴백 일괄 수정 — 모든 BFF 라우트가 `{ status: res.status || 200 }`을 써서 BE 연결 실패(`beFetch` status 0)를 HTTP 200으로 응답한다. 현재 클라이언트는 바디의 `ok`로 판단해 무해하나, status 기준 소비처가 생기면 오작동. `res.status || 502`(또는 `=== 0 ? 502`)로 login/signup/logout/me/oauth·프로필 등 전체를 한 번에 정리. (2026-07-16 프로필 리뷰에서 식별) *(신규 피드 라우트는 `proxyAuthed` 헬퍼로 이미 502 처리 — 기존 인증/프로필 라우트만 남음)*

## 피드 FE 후속 (2026-08-02 최종 리뷰 이연 Minor)

* [ ] FE 접근성(a11y) — 모바일 이식 목표와 연계: `LikeButton`(하트+숫자만, 접근명 없음)·`ComposeForm` textarea(placeholder만, label 없음)에 접근명 부여, `PostCard`의 `<article onClick>`을 키보드 도달 가능하게(role/tabIndex/onKeyDown). 스펙 참조 코드에서 그대로 내려온 갭.
* [ ] FE 피드: `commentCount` 낙관적 증감 — 상세에서 댓글 작성/삭제 시 게시글 카드의 댓글 수가 새로고침 전까지 드리프트(현재 미갱신). 목록/상세 상태에 반영.
* [ ] FE: BFF 동적 라우트의 `type Ctx = { params: Promise<{ id: string }> }` 중복(피드 라우트 5+개) → `lib/server` 공용 타입으로 추출.
* [ ] BE: `MemberProfileService.getMyIdentity`/`getMyProfile`가 `isVerified`+member 조회를 각각 중복 — 3번째 신원 인접 엔드포인트가 생기면 공용 헬퍼로 추출 검토.

## 공연 FE 후속 (2026-08-02 최종 리뷰 이연)

* [ ] FE(전역): `getBff('/api/bff/me/identity')` 등 신원 조회에 네트워크 레벨 fetch reject용 `.catch` 없음 — 정상 경로는 middleware 쿠키 보장으로 동작하나, fetch 자체가 reject하면 unhandled rejection + 페이지가 "불러오는 중…"에 영구 정지. 피드+공연 8+개 호출부 공통 → `getBff`/`beClient` 레벨 또는 공용 훅으로 **한 번에** 처리(개별 페이지 말고). (opus 최종 리뷰 Important, 비블로커)
* [ ] FE 공연 a11y: `/performances/new`의 포스터 `<input type=file>`에 접근명 없음(다른 폼 필드는 aria-label 있음). edit 페이지는 `<label>` 래핑으로 회피 — new도 동일 처리.
* [ ] FE 목록 empty-state 1프레임 flash: `/performances`(및 피드)에서 첫 렌더 시 `isLoading` 세팅 전 "등록된 공연이 없습니다"가 한 프레임 노출 → 훅의 `loaded` 플래그로 게이팅하면 해소.
* [ ] FE 공연: 삭제 확인(confirm) 없음 — 상세에서 삭제 1클릭 즉시 실행(BE soft delete라 서버측 복구 가능). 피드와 동일 정책이나 확인 다이얼로그 검토 여지.
* [ ] FE 공연 테스트 갭: ADMIN 비주최자 삭제버튼 페이지레벨 미테스트(canDelete 단위테스트는 있음), 포스터 즉시업로드 성공 후 `<img>` 재렌더 미단언.

## BE 공통 정리 (도메인 리뷰에서 이연된 Minor)

* [ ] BE: 오프셋 페이징 응답을 안정적 `PageResponse<T>` DTO로 공통화 — 현재 VERIFIED-PERFORMER 어드민 목록·PERFORMANCE 목록이 `Page<T>`(PageImpl)를 그대로 직렬화해 Spring Boot 3.4의 "PageImpl 직렬화 비권장" 경고가 뜬다(동작·테스트는 정상). JSON 계약 안정화를 위해 공통 DTO로 감싸는 것을 검토. (2026-07-22 PERFORMANCE 최종 리뷰 식별)
* [ ] FEED/PERFORMANCE: `clamp(size)`·`isAdmin(Authentication)`가 여러 컨트롤러에 중복 — 공용 헬퍼로 추출. (2026-07-17/07-22 리뷰 식별)
* [ ] FEED: `VerificationApplicationRepository.findApprovedMemberIds`의 JPQL이 enum을 FQN 리터럴로 사용 → `@Param`으로 파라미터 바인딩 정리(리네임 취약). 해당 테스트의 인라인 `java.util.Set`도 import로. (2026-07-17)

## BE 공통 (도메인 확장 전후로 필요)

* [x] ~~CORS 설정~~ — BFF 채택으로 브라우저 경로는 same-origin이라 불필요. 모바일 앱 등 BE 직접 호출 소비처가 생기면 재도입 검토. (2026-07-15 결정)
* [ ] Swagger/OpenAPI 문서화 — `resultCode`의 문서화 용도가 COMMON-STATUTE §1에 명시돼 있으나 도입은 미착수
* [ ] refresh 토큰 로테이션·철회 — Redis 도입 시(COMMON-STATUTE §4에 예정 명시). CHAT의 Redis 도입과 시기 조율 가능

## 배포 (AWS 전환) — 2026-08-18 정리

배포 목표: BE(EC2/ECS) + FE(EC2 또는 Vercel) + DB(RDS)를 각각 분리 운영. **레포는 단일 유지**(빌드 산출물이 `BE/build/libs/*.jar` / `FE/.next`로 이미 독립, 연결점은 런타임 env 주소뿐).

### A. 배포 전 반드시 결정해야 하는 것 (블로커)

* [ ] **`ddl-auto` 정책 확정** — 현재 `${DDL_AUTO:update}`. 운영 DB에서 Hibernate가 스키마를 자기 판단으로 바꾸고, 컬럼 삭제·타입 변경은 반영조차 안 해 코드/스키마가 조용히 어긋난다. RDS 전환 시 `validate`로 내리고 **Flyway 도입**(현재 마이그레이션 도구 없음 — 2026-08-18 확인). 초기 스키마는 현재 `update`로 생성된 DDL을 베이스라인으로 추출.
* [ ] **단일 인스턴스 운영 여부 확정** — 지금 채팅은 **다중 서버에서 동작하지 않는다**. STOMP가 인메모리 Simple Broker라 A서버 사용자와 B서버 사용자 간 메시지가 오가지 않고, `PresenceRegistry`도 인메모리라 단일 서버에서만 정확. 스케일아웃이나 무중단(블루-그린) 배포를 할 거면 **그 전에 Redis 선행**(`enableStompBrokerRelay` 교체 + Redis 기반 `PresenceRegistry`, 도메인 코드는 불변). 1대 운영이면 현행 유지 가능.
* [ ] **WS origin 좁히기** — `WebSocketConfig.setAllowedOriginPatterns("*")`(BE/src/main/java/com/back/global/websocket/WebSocketConfig.java:24)를 실제 FE origin으로 제한. 프로덕션 노출 전 필수.

### B. 인프라 구성

* [ ] **RDS 전환** — 데이터소스가 이미 env(`DB_URL`/`DB_USERNAME`/`DB_PASSWORD`)라 값 교체만으로 전환 가능. 함께 처리: RDS 퍼블릭 접근 차단(보안그룹으로 앱 서버만 허용), 파라미터 그룹 `utf8mb4`/타임존, HikariCP 풀 크기 vs 인스턴스 `max_connections`, 자격증명은 Secrets Manager 또는 env(커밋 금지 규칙 기존대로).
* [ ] **Nginx 리버스 프록시 + HTTPS + WebSocket 프록시** — `/ws` 업그레이드 헤더 통과 설정 포함. (기존 항목)
* [ ] **CI/CD 구성** — 모노레포 경로 필터로 BE/FE 파이프라인 분리. ⚠️ 워크플로 **파일**을 나누면 두 쪽이 같이 바뀐 커밋에서 배포 순서가 보장되지 않아 계약 변경 배포 때 깨진 창이 생긴다. 한 워크플로 안에서 job 레벨 변경 감지(`dorny/paths-filter`) + `needs`로 **BE → FE 순서 강제**.
* [ ] **헬스체크 엔드포인트** — 현재 Spring Actuator 미도입(2026-08-18 확인). ALB/ECS 헬스체크·무중단 배포에 필요하므로 `actuator` 추가 후 `/actuator/health`만 노출(나머지 엔드포인트는 차단).
* [ ] **프로덕션 환경변수 목록 정리** — `DB_*`, `JWT_SECRET`, `KAKAO_CLIENT_ID`/`SECRET`, `STORAGE_TYPE`/`S3_*`, `DDL_AUTO`, FE의 `BE_BASE_URL`/`NEXT_PUBLIC_BE_WS_URL`(wss)/`KAKAO_REDIRECT_URI`. 한 곳에 표로 정리(어디에 주입하는지 포함). 카카오 `redirect_uri`는 개발자 콘솔에도 운영 주소 등록 필요.
* [ ] **`NEXT_PUBLIC_BE_WS_URL`을 wss로** — (기존 채팅 후속 항목과 동일 건)

### C. 배포 후 / 최적화

* [ ] 실제 S3 연동 검증 — AWS 자격증명 발급 후 `STORAGE_TYPE=s3`로 업로드/삭제/조회 수동 확인 (자동 테스트 범위 밖)
* [ ] 고아 파일 정리(GC) — 메타데이터 없는 물리 파일, 업로드 실패로 남은 파일 정리 배치
* [ ] CloudFront/R2 등 CDN 전환으로 파일 접근 요금 최적화 (`base-url` 교체만으로 가능하도록 설계됨)
* [ ] 로그/모니터링 방침 — 현재 예외는 `GlobalExceptionHandler`가 `log.warn`/`log.error`로 남긴다. 운영에서 어디로 모을지(CloudWatch 등) 결정.

## 기타 (추후)

* [ ] FE: middleware → proxy 마이그레이션 검토 — Next 16.2에서 'middleware' 파일 규약이 deprecated(경고만, 현재 정상 동작). proxy는 edge가 아닌 nodejs 런타임이라 'server-only' import 제약이 사라질 수 있어 쿠키 이름 하드코딩 재검토 대상. (2026-07-15 발견)

## 실환경 스모크 검증에서 새로 확인한 항목 (2026-08-18)

* [ ] FE 전역 내비게이션 부재 — `/dashboard`에 "내 프로필/로그아웃"만 있고 피드·공연·구인·채팅·인증연주자로 가는 링크가 없다. 실제로는 URL을 직접 입력해야 각 화면에 도달한다. 도메인 화면이 다 생긴 지금은 공용 헤더/내비가 필요.
* [ ] FE 프로필 화면에 닉네임·인증뱃지 미표시 — BE `ProfileResponse`가 `nickname`/`verified`를 주는데 `/profile`은 사진·악기·자기소개만 보여준다. 내 인증 상태를 프로필에서 확인할 수 없음.
* [ ] 문서 계약 표기 정정 확산 확인 — `scope` 쿼리 파라미터를 소문자(`open|closed|all`, `upcoming|past|all`)로 적어둔 곳이 남아있는지 도메인 STATUTE까지 점검. 실제 계약은 enum 상수 그대로 대문자(`OPEN`/`UPCOMING`). (CONTEXT.md는 정정 완료)
* [ ] 채팅 대화창 스크롤 — 메시지가 쌓여도 하단 고정이 없어 새 메시지가 화면 밖으로 밀린다. 기존 "이전 메시지 더 보기" 항목과 함께 처리.
* [ ] 채팅 1:1 시작이 회원 id 입력이라 실사용 불가 수준 — 기존 항목(회원 검색 API)의 우선순위를 올릴지 검토. 스모크에서도 상대 id를 DB로 확인해야 했다.
