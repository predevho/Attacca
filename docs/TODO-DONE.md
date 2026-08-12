# TODO-DONE

완료된 작업 기록.

---

* [x] (2026-08-12) FE 채팅(CHAT) 화면 **MVP** 구현 (TDD, 서브에이전트 주도 7태스크) — 브랜치 feature/chat-fe. 방 목록 + 대화창(실시간 송수신) + 1:1 시작 + 읽음.
  * 페이지 2: `/chat`(방 목록·안읽은 배지·회원 id로 새 대화)·`/chat/[id]`(대화창·이력+STOMP 실시간+읽음). 컴포넌트 4(RoomListItem/NewChatForm/MessageBubble/MessageComposer). BFF 5라우트(rooms/messages/read + 특수 ws-token).
  * 실시간: `@stomp/stompjs`(프로젝트 유일 라이브러리 예외)로 BE(`NEXT_PUBLIC_BE_WS_URL`)에 직접 STOMP 연결. CONNECT 토큰은 BFF `ws-token`이 httpOnly access 쿠키를 반환(WS 동안 토큰 JS 노출 — 승인된 트레이드오프). STOMP 로직은 `lib/chat/stompClient.ts`에 캡슐화. 자기 전송분 재수신은 `mergeMessages` id 중복 제거, typing 프레임 필터.
  * 태스크별 독립 검증. 전체 vitest 163/163·lint(chat 파일 0경고)·next build 통과. **WS 실왕복은 BE 기동 후 수동 검증 필요**(자동 테스트는 배선 목).
  * 범위 밖(후속): 그룹 생성·초대·퇴장, 타이핑, presence(online), 회원 검색, WS reissue 완전화, 알림.
* [x] (2026-08-02) FE 공연(PERFORMANCE) 화면 구현 (TDD, 서브에이전트 주도 8태스크) — 목록(scope 탭·무한스크롤)/등록(2단계 마법사·자격 게이팅)/상세/수정/포스터. useInfiniteList 오프셋 재사용(toCursorPage), proxyAuthed·AuthorBadge·canEdit/canDelete·신원 재사용. 브랜치 feature/performance-fe.
  * 범위 밖: 관심/북마크, 피드 카드 노출, 곡목 구조화, 좌석/예매, 공개 조회, 태그/장르 필터.
* [x] (2026-08-02) FE 피드(FEED) 화면 구현 (TDD, 서브에이전트 주도 13태스크) — 무한스크롤 타임라인/인라인 작성/상세·댓글/게시글·댓글 좋아요(낙관적+롤백)/수정·삭제. BE 선행: 신원 엔드포인트 GET /api/members/me. BFF 프록시 헬퍼(status||502) 신설. 브랜치 feature/feed-fe.
  * 범위 밖: 이미지 첨부/대댓글/댓글 수정/팔로우 타임라인/신고/PERFORMANCE 카드.
* [x] (2026-07-27) CHAT(채팅) BE 도메인 구현 (TDD, 서브에이전트 주도 14태스크) — main 병합 완료(커밋 `7b5cff4`)
  * 통합 방 모델: 1:1(DIRECT)+그룹(GROUP)을 "방+참여자" 한 모델로. 엔티티 3종 `ChatRoom`(type/title/createdBy/`directKey`(unique)/`lastMessageAt`(비정규화 정렬키)) + `ChatParticipant`(roomId/memberId 원시 Long, `leftAt` soft leave, `lastReadMessageId` 읽음커서, `(roomId,memberId)` unique) + `ChatMessage`(append-only, `(roomId,id)` 인덱스)
  * 1:1 유일성: 정렬 키 `directKey="min:max"` + DB unique + find-or-create. 동시 생성 경합은 insert를 `DirectRoomInitializer`(REQUIRES_NEW)로 격리해 바깥 트랜잭션 오염 없이 재조회(멱등)
  * 리포지토리 3종: `findByDirectKey`, 활성 참여 방 목록(오프셋 페이징, lastMessageAt desc), 메시지 커서 이력(id desc), 방별 마지막 메시지(`max(id) group by`)·안읽은 수(`countUnreadPerRoom` LEFT JOIN 배치, 호출측 참여검증 불변식) 집계 — 모두 IN 배치로 N+1 없음
  * 서비스 2종: `ChatRoomService`(생성 find-or-create/상세/초대(평평한 모델, 그룹만)/퇴장 soft leave/방 목록(안읽은수·마지막메시지·displayName 파생)/읽음), `ChatMessageService`(전송 영속화+lastMessageAt 갱신/커서 이력). 표시정보는 `MemberQueryService.findDisplaysByIds` 배치 재사용
  * REST `/api/chat/**` 7종 + WebSocket/STOMP: 엔드포인트 `/ws`, `enableSimpleBroker`(인메모리, Redis는 scale-out 시 교체), 인증은 CONNECT 프레임 JWT(`StompAuthChannelInterceptor` → Principal=memberId), SUBSCRIBE/SEND는 활성 참여자 인가(fail-closed). `ChatStompController`(send 브로드캐스트/typing 비영속), presence는 `PresenceRegistry`(연결수 카운팅, 인메모리·단일서버 한계) + 연결/해제 이벤트 브로드캐스트
  * 전역 `ErrorCode` 4종: `CHAT_ROOM_NOT_FOUND`(404-10)/`CHAT_MESSAGE_NOT_FOUND`(404-11)/`NOT_ROOM_PARTICIPANT`(403-03)/`CHAT_INVALID_PARTICIPANTS`(400-03, 400-02는 INVALID_FILE 점유)
  * WebSocket 통합 테스트: `@SpringBootTest(RANDOM_PORT)`+`WebSocketStompClient` 실연결 3종(유효토큰 송수신·무토큰 거절·비참여자 구독 ERROR 거절, 서버측 원예외 "참여자" 단언). 전 계층 TDD, 태스크마다 독립 리뷰(리뷰 지적 반영: DIRECT 경합 REQUIRES_NEW 격리·방목록 DIRECT 표시명 N+1 제거·테스트 단언 정밀화). 전체 `test` 307/307 통과
  * 범위 밖: FE 화면, 메시지 수정/삭제, 파일 첨부, 메시지 검색, 알림 푸시, 다중 서버 정확 presence·릴레이(Redis), 방장 권한/kick, 타 도메인 채팅 연계
* [x] (2026-07-23) RECRUITMENT(구인) BE 도메인 구현 (TDD, 서브에이전트 주도 8태스크)
  * 엔티티 2종: `RecruitmentPosting`(authorId=원시 Long, title/description/instruments(다중 악기 `@ElementCollection`, `@BatchSize`)/recruitCount/location/fee/deadline(nullable=상시)/status(OPEN/CLOSED), soft delete) + `RecruitmentApplication`(postingId/applicantId 원시 Long, message, 상태머신 PENDING→ACCEPTED/REJECTED/WITHDRAWN)
  * 리포지토리: 공고 scope별(open=OPEN·미마감 / closed=CLOSED·마감지남 / all) + `instrument` 필터(JPQL `member of`) + soft delete 필터; 지원 활성지원 존재판정(`existsBy...StatusIn` [PENDING,ACCEPTED]) + 공고별/지원자별 페이징. `deadline==now`는 CLOSED(경계 결정적 테스트)
  * 서비스 2종: `RecruitmentPostingService`(등록=인증 회원 누구나·게이팅 없음/조회/목록/수정=작성자/마감=작성자/삭제=작성자·ADMIN, `findActive` 재사용), `RecruitmentApplicationService`(지원=본인공고·마감·중복 게이팅/지원자목록=작성자/내지원목록/수락·거절=작성자/철회=지원자, guard 순서 확정)
  * 컨트롤러 2종(`/api/recruitments`): 공고 CRUD+마감, 지원 POST `{id}/applications`·GET `{id}/applications`(작성자)·GET `applications/me`·accept/reject/withdraw. 어드민 판정 principal 역할, 어드민 전용 경로 없음. size 기본 20/최대 50
  * MEMBER 협력: 작성자·지원자 표시(닉네임+인증뱃지)를 `MemberQueryService.findDisplaysByIds` 배치 재사용으로 파생(N+1 없음)
  * 전역 `ErrorCode` 6종: `RECRUITMENT_NOT_FOUND`(404-08)/`RECRUITMENT_APPLICATION_NOT_FOUND`(404-09)/`RECRUITMENT_CLOSED`(409-07)/`ALREADY_APPLIED`(409-08)/`CANNOT_APPLY_OWN_RECRUITMENT`(409-09)/`RECRUITMENT_INVALID_APPLICATION_STATE`(409-10)
  * 전 계층 TDD, 태스크마다 독립 리뷰(리뷰 지적 반영: 리포/서비스/컨트롤러 테스트 커버리지 보강 3회, deadline==now 경계 비결정성 수정). 최종 전체-브랜치 리뷰 Ready-with-fixes → instruments N+1을 `@BatchSize(100)`로 수정. 전체 `test` 266/266 통과
  * 범위 밖: 구직 공고, PERFORMANCE 연결, 지원 첨부파일, CHAT 연계, 키워드/태그 검색, 알림, 마감 자동화 배치, applicationCount 응답 필드, 공통 PageResponse DTO
* [x] (2026-07-22) PERFORMANCE(연주회) BE 도메인 구현 (TDD, 서브에이전트 주도 6태스크)
  * 엔티티 `Performance`(organizerId=원시 Long, title/description/performedAt(시작 일시)/venue/program(자유텍스트)/ticketInfo/ticketUrl/posterImageKey, soft delete)
  * 리포지토리: scope별 목록(upcoming=`performedAt>=now` asc / past=`<now` desc / all=desc, `deletedAt IS NULL` 필터) + 단건(active)
  * 서비스 `PerformanceService`: 등록(인증 연주자 또는 ADMIN — `isVerified` 협력, 아니면 403-02)/조회/목록/수정(주최자)/삭제(주최자·ADMIN)/포스터(주최자, image/*, 교체 시 옛파일 삭제 후행)
  * 컨트롤러(`/api/performances`): POST 등록·GET 목록(`?scope`+Pageable)·GET/{id}·PUT/{id}·DELETE/{id}·PUT/{id}/poster. 어드민 판정은 principal 역할, 어드민 전용 경로 없음. size 기본 20/최대 50
  * MEMBER 협력: 주최자 표시(닉네임+인증뱃지)를 `MemberQueryService.findDisplaysByIds` 배치 재사용으로 파생(N+1 없음). FileService(포스터)·VerifiedPerformerService(등록 자격) 재사용
  * 전역 `ErrorCode` 2종: `PERFORMANCE_NOT_FOUND`(404-07)/`NOT_VERIFIED_PERFORMER`(403-02)
  * 전 계층 TDD, 태스크마다 독립 리뷰, 최종 전체-브랜치 리뷰 MERGEABLE(Critical 0). 이연 Important: 목록 PageImpl 직렬화 경고 → 코드베이스 공통 PageResponse DTO는 BACKLOG. 전체 `test` 통과
* [x] (2026-07-17) FEED(피드) BE 도메인 구현 (TDD, 서브에이전트 주도 11태스크)
  * 엔티티 4종: `Post`/`Comment`(평면, soft delete) + `PostLike`/`CommentLike`(유니크, 멱등). 작성자는 원시 `authorId`(Long)
  * 리포지토리: id 기준 커서 keyset(타임라인 최신순 desc / 댓글 오래된순 asc), 배치 카운트(`GROUP BY ... IN :ids`)와 내 좋아요 집합 → 목록 N+1 방지(페이지당 고정 쿼리)
  * 서비스 3종: `FeedPostService`(작성/조회/타임라인/수정=작성자/삭제=작성자·ADMIN), `FeedCommentService`(작성/커서목록/삭제), `FeedLikeService`(게시글·댓글 좋아요·취소 멱등)
  * 좋아요 동시성: 유니크 제약 + `saveAndFlush`+`DataIntegrityViolationException` catch로 이중요청에도 멱등 200 보장(STATUTE §4)
  * 컨트롤러 3종(`/api/feed/**`): 어드민 판정은 principal 역할(`ROLE_ADMIN`)로, 어드민 전용 경로 없음. 커서 size 기본 20/최대 50
  * MEMBER 협력: `MemberQueryService.findDisplaysByIds`(닉네임+인증뱃지 배치 파생) 신설 + `VerifiedPerformerService.findVerifiedMemberIds`(승인 회원 배치) 추가 — fetch join 불가(도메인 경계상 연관 없음)라 서비스 협력+IN 배치로 처리
  * 전역 `ErrorCode` 2종: `POST_NOT_FOUND`(404-05)/`COMMENT_NOT_FOUND`(404-06)
  * 전 계층 TDD, 태스크마다 독립 리뷰(리뷰가 잡은 실버그: 좋아요 유니크 제약 컬럼명 camelCase→snake_case 정정), 최종 전체-브랜치 리뷰 MERGEABLE. 전체 `test` 통과
* [x] (2026-07-16) VERIFIED-PERFORMER(인증 연주자) BE 도메인 구현 (TDD)
  * 상태 머신 엔티티 `VerificationApplication`(PENDING/APPROVED/REJECTED/REVOKED) — `apply`/`grantByAdmin` 팩토리 + `approve`/`reject`/`revoke` 전이(종결 상태 재처리 시 `INVALID_APPLICATION_STATE`). `memberId`는 원시 Long(느슨한 결합), 재신청=새 레코드로 이력 보존
  * 리포지토리: `existsByMemberIdAndStatus`(활성 유일성·뱃지 판정), `findTop...OrderByCreatedAtDescIdDesc`(최신 신청 — createdAt 동률을 id로 타이브레이크해 결정적 정렬), `findByStatus...`(어드민 페이징)
  * 서비스 `VerifiedPerformerService`: 신청(활성 PENDING→409-04/APPROVED→409-05 거절), 승인/거절/철회, 어드민 직접지정, `isVerified`(APPROVED만 true)
  * 회원 API 2종: `POST /api/verified-performers/applications`, `GET /api/verified-performers/applications/me`(이력 없으면 200+data:null)
  * 어드민 API 5종(`/api/admin/**`, ROLE_ADMIN): 상태별 목록(`?status`+Pageable), `{id}/approve`(사유 선택)·`{id}/reject`·`{id}/revoke`(사유 필수), `grant`(직접지정)
  * 전역 `ErrorCode` 4종 추가: `VERIFICATION_ALREADY_PENDING`(409-04)/`VERIFICATION_ALREADY_APPROVED`(409-05)/`INVALID_APPLICATION_STATE`(409-06)/`APPLICATION_NOT_FOUND`(404-04)
  * MEMBER 통합: `ProfileResponse.verified` 추가, `MemberProfileService`가 `VerifiedPerformerService.isVerified`로 뱃지 파생(프로필 미생성 회원도 파생). 도메인 경계는 서비스 계층 협력만(엔티티 직접 참조 없음)
  * 엔티티/리포지토리/서비스/컨트롤러(회원·어드민) 전 계층 테스트, 전체 `test` 통과
* [x] (2026-07-15) FE Next.js 초기화 + 인증 플로우(BFF) (TDD, subagent-driven)
  * Next 16(App Router)/React 19/TS/Tailwind/Vitest 스캐폴딩, 위치 `FE/`
  * BFF 3계층: `lib/server/*`(beClient·cookies·session) / `app/api/bff/**`(signup·login·logout·me) / UI. 토큰은 httpOnly 쿠키, UI 미접근
  * 화면: 회원가입/로그인/대시보드(+루트 리다이렉트), `/dashboard`는 미들웨어 보호
  * reissue 1회 재시도(`session.ts`), 대시보드가 `/api/bff/me`(인증 프로브)로 전체 경로 검증
  * 통신은 네이티브 fetch(라이브러리 미도입). CORS는 BFF라 미추가
  * Vitest 단위 테스트(unwrap·cookies·beClient·session·bff·api·폼 스모크). 실BE 연동은 수동 검증
* [x] (2026-07-15) BE 런타임 DB(MySQL) + MEMBER 프로필/이미지 (TDD, subagent-driven)
  * 런타임 DB: 레포 루트 docker-compose(MySQL 8.4) + datasource env 기본값 + `ddl-auto: update`. 테스트는 `application-test.yaml`(H2) 프로파일 분리(`@SpringBootTest`에 `@ActiveProfiles("test")`)
  * `MemberProfile`(1:1 단방향, lazy upsert) + `Instrument` enum 21종(장르는 리뷰에서 제외, VOICE/VOCAL 분리)
  * API 4종: `GET/PUT /api/members/me/profile`, `PUT /api/members/me/profile/image`(image/* 검증, 교체 시 옛 파일 삭제), `GET /api/members/profile-options`
  * Bean Validation 도입 + 전역 예외 400 매핑 3건(@Valid 실패/본문 파싱 실패/파트 누락 — 기존 500 결함 수정), `MEMBER_NOT_FOUND`(404-03)
  * 파일 저장 계층(FileService)의 첫 실사용처
* [x] (2026-07-14) 파일 저장 기반(FileStorage) 구성 (TDD)
  * `global.storage`: `FileStorage`(인터페이스) / `LocalFileStorage`(기본) / `S3FileStorage`(AWS SDK v2) / `StorageProperties`
  * `FileService.upload(MultipartFile, String directory, Long uploaderId)` — key 생성(`{디렉터리}/{yyyy}/{MM}/{dd}/{UUID}.{확장자}`) + 저장 + `FileMetadata` 영속화를 한 트랜잭션으로 조합
  * `FileStorage`는 DB를 모른다(책임 분리). 도메인은 `FileService`만 사용
  * 접근 URL = `base-url + key` → CloudFront/R2 전환 시 설정 한 줄만 교체
  * 에러코드 4종 추가: `INVALID_FILE`(400-02), `FILE_NOT_FOUND`(404-01), `FILE_UPLOAD_FAILED`(500-02), `RESOURCE_NOT_FOUND`(404-02, 파일 전용 아닌 일반 코드). `BusinessException`에 cause 보존 생성자 추가
  * `SecurityConfig`에 `/files/**` permit 추가(로컬 파일 서빙)
  * 문서 충돌 해소: 메타데이터는 공용 `FileMetadata` 테이블로 결정 → `DOMAIN-COMMON-STATUTE §7` 개정
  * 리뷰 중 발견·수정한 버그 2건:
    1. 앱 전역 500→404 라우팅 버그 — 매칭되는 핸들러가 없는 모든 URL에서 Spring이 던지는 `NoResourceFoundException`이 `GlobalExceptionHandler`의 catch-all(`Exception.class`)에 걸려 500으로 응답되고 있었음. `RESOURCE_NOT_FOUND`(404-02) 전용 핸들러를 추가해 404로 정정(파일 저장 기능과 무관한 앱 전역 수정).
    2. key 생성의 확장자 파서가 dotfile(예: `.내파일`, 점이 index 0)에서 원본 파일명 전체를 key로 흘려보내던 버그 — "원본 파일명은 key에 넣지 않는다" 규칙을 깨고 한글이 공개 URL에 노출될 수 있었음. 점이 index 0이면 확장자 없음으로 처리하도록 수정.
  * 범위 밖: HTTP 업로드 엔드포인트(사용처인 MEMBER 프로필 이미지에서 구현), 실제 S3 연동 검증(자격증명 미발급), Presigned URL
* [x] (2026-07-13) MEMBER: 카카오 소셜 로그인 + 자체 로그인 loginId 전환 (TDD, subagent-driven)
  * 식별자 역할 분리: `loginId`(자체 로그인, unique·nullable) / `email`(인증·소셜연결 키, 전원 필수) / `nickname`(활동명) / 내부 신원 `id`
  * 자체 auth를 email→loginId 기반으로 개정(`SignupRequest{loginId,password,email,nickname}`, `login{loginId,password}`)
  * 카카오 소셜: `POST /api/auth/oauth/kakao{code,redirectUri}` — 프론트 인가코드→백엔드 교환(`OAuthClient`/`KakaoOAuthClient`), `SocialAccount`(provider+providerUserId 유니크)
  * 자동가입/자동연결: 검증된 이메일(is_email_verified)만 기존 회원 연결, 미검증 거절(계정 탈취 방지). nickname 충돌 시 유니크 생성
  * 에러코드 추가: `LOGIN_ID_ALREADY_EXISTS`(409-03), `OAUTH_EMAIL_UNVERIFIED`(401-08), `OAUTH_PROVIDER_ERROR`(502-01). `LOGIN_FAILED` 문구를 아이디 기준으로 정정
  * 카카오 키는 env 주입(`KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`), 커밋 금지. 실제 카카오 HTTP는 운영 키로 수동 검증(자동 테스트는 매핑·로직만 Fake)
  * 브랜치 `feature/member-oauth2-social-login`, 태스크 6개 TDD + 태스크별 리뷰, 전체 `clean build` 통과
  * 범위 밖(BACKLOG): 구글 등 타 provider, 프로필/이미지, 실제 인증메일 발송
* [x] (2026-07-12) MEMBER 도메인: 자체 회원가입/로그인 (TDD)
  * `domain.member`: `Member`(엔티티, email/password/nickname/role), `MemberRepository`(existsByEmail·existsByNickname·findByEmail), `MemberService`(signup·login), `MemberAuthController`
  * 엔드포인트: `POST /api/auth/signup`, `POST /api/auth/login`(access+refresh 발급) — 기존 `/api/auth/**` permit 재사용(SecurityConfig 미변경)
  * 에러코드 전역 `ErrorCode`에 추가: `LOGIN_FAILED`(401-07), `EMAIL_ALREADY_EXISTS`(409-01), `NICKNAME_ALREADY_EXISTS`(409-02)
  * 비밀번호 BCrypt 해시 저장, 로그인 실패는 이메일/비번 구분 없이 401-07(정보 노출 방지)
  * 테스트: Member/Repository/Service(6)/Controller(4)/ErrorCode + 회귀 수정(SecurityConfigTest `@WebMvcTest` 범위 한정) → 전체 `clean build` 통과(43개)
  * 범위 밖(BACKLOG): 소셜 로그인(OAuth2), 프로필/이미지(FileStorage 의존)
* [x] (2026-07-11) BE 보안 기반(Security+JWT) 골격 구성 (TDD, 접근안 A)
  * `global.security`: `Role`(enum), `JwtProvider`/`JwtProperties`, `JwtAuthenticationFilter`, `SecurityConfig`(STATELESS), 핸들러 2종, `AuthController(/api/auth/reissue)`
  * access+refresh 무상태(refresh에도 role), 인증 ErrorCode 7종(401-01~06/403-01), jjwt 0.12.6
  * 테스트 5종(Role/ErrorCode/JwtProvider/Filter/SecurityConfig/AuthController) + 전체 `clean build` 통과
  * 커밋 `5a76833`·`184e19a`·`90b4427`·`287379d`·`6da73cf`
* [x] (2026-07-05) 전역 코드 리뷰 반영: `ErrorCode.resultCode`(int, HTTP 기반) 추가 + `ErrorBody(resultCode, code, message)` 응답 노출, Lombok `@Getter` 전환 (TDD, `clean build` 통과)
* [x] (2026-07-05) BE 전역(global) 기반 구성 (TDD)
  * `global.common.ApiResponse<T>` (성공/실패 공통 래퍼, nested `ErrorBody` record)
  * `global.common.BaseEntity` (`createdAt`/`updatedAt`, `@MappedSuperclass` + JPA Auditing)
  * `global.exception.ErrorCode`(enum, code=상수명), `BusinessException`, `GlobalExceptionHandler`(`@RestControllerAdvice`)
  * `global.config.JpaAuditingConfig` (`@EnableJpaAuditing`)
  * 테스트 4종(ApiResponse/BusinessException/GlobalExceptionHandler/BaseEntity) 및 전체 `clean build` 통과
* [x] (2026-07-05) `BE/build.gradle.kts` Spring Boot 4.1.0 → 3.4.5 재조정, 빌드 통과 확인
  * 4.x 전용 스타터 이름 수정: `-webmvc`→`-web`, 테스트 스타터 3종→`-test`+`spring-security-test`
  * Gradle 래퍼 9.5.1 → 8.11.1 (Boot 3.4 플러그인은 Gradle 9 미지원)
  * 테스트 컨텍스트 로딩용 H2(`testRuntimeOnly`) 추가 → `./gradlew clean build` BUILD SUCCESSFUL
* [x] (2026-07-05) 프로젝트 초기 설계 브레인스토밍 및 문서 체계 작성
  * ARCHITECTURE-CONSTITUTION / STATUTE
  * DOMAIN-COMMON-CONSTITUTION / STATUTE
  * DOMAIN-MEMBER-CONSTITUTION / STATUTE
  * TODO-*, CONTEXT, AI 기록 문서 초기화
