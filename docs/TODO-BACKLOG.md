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
  * Redis 이연: 다중 서버 확장 시 `enableStompBrokerRelay`로 브로커 교체 + Redis 기반 `PresenceRegistry`(현재 인메모리·단일서버만 정확). refresh 로테이션은 2026-09-08에 먼저 들어갔고 **Redis 인스턴스가 이미 떠 있으므로**, 남은 것은 브로커·presence 교체뿐이다.
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

* [x] ~~FE(전역): 신원 조회에 네트워크 레벨 fetch reject용 `.catch` 없음~~ — 2026-09-08 해소. 개별 호출부가 아니라 **`lib/api.ts`의 공용 `request()`에서 한 번에** 흡수한다(fetch reject → `{ok:false, message:'서버에 연결할 수 없습니다.'}`). 모든 호출부가 이미 `ok===false`를 다루고 있어 반환 모양은 그대로다. 원문: `getBff('/api/bff/me/identity')` 등 신원 조회에 네트워크 레벨 fetch reject용 `.catch` 없음 — 정상 경로는 middleware 쿠키 보장으로 동작하나, fetch 자체가 reject하면 unhandled rejection + 페이지가 "불러오는 중…"에 영구 정지. 피드+공연 8+개 호출부 공통 → `getBff`/`beClient` 레벨 또는 공용 훅으로 **한 번에** 처리(개별 페이지 말고). (opus 최종 리뷰 Important, 비블로커)
* [ ] FE 공연 a11y: `/performances/new`의 포스터 `<input type=file>`에 접근명 없음(다른 폼 필드는 aria-label 있음). edit 페이지는 `<label>` 래핑으로 회피 — new도 동일 처리.
* [ ] FE 목록 empty-state 1프레임 flash: `/performances`(및 피드)에서 첫 렌더 시 `isLoading` 세팅 전 "등록된 공연이 없습니다"가 한 프레임 노출 → 훅의 `loaded` 플래그로 게이팅하면 해소.
* [ ] FE 공연: 삭제 확인(confirm) 없음 — 상세에서 삭제 1클릭 즉시 실행(BE soft delete라 서버측 복구 가능). 피드와 동일 정책이나 확인 다이얼로그 검토 여지.
* [ ] FE 공연 테스트 갭: ADMIN 비주최자 삭제버튼 페이지레벨 미테스트(canDelete 단위테스트는 있음), 포스터 즉시업로드 성공 후 `<img>` 재렌더 미단언.

## BE 공통 정리 (도메인 리뷰에서 이연된 Minor)

* [ ] BE: 오프셋 페이징 응답을 안정적 `PageResponse<T>` DTO로 공통화 — 현재 VERIFIED-PERFORMER 어드민 목록·PERFORMANCE 목록이 `Page<T>`(PageImpl)를 그대로 직렬화해 Spring Boot 3.4의 "PageImpl 직렬화 비권장" 경고가 뜬다(동작·테스트는 정상). JSON 계약 안정화를 위해 공통 DTO로 감싸는 것을 검토. (2026-07-22 PERFORMANCE 최종 리뷰 식별)
* [ ] FEED/PERFORMANCE: `clamp(size)`·`isAdmin(Authentication)`가 여러 컨트롤러에 중복 — 공용 헬퍼로 추출. (2026-07-17/07-22 리뷰 식별)
* [ ] FEED: `VerificationApplicationRepository.findApprovedMemberIds`의 JPQL이 enum을 FQN 리터럴로 사용 → `@Param`으로 파라미터 바인딩 정리(리네임 취약). 해당 테스트의 인라인 `java.util.Set`도 import로. (2026-07-17)

* [ ] HSTS 적용 검토 — 지금은 헤더가 없다. 넣으면 브라우저가 이후 https만 쓰지만, HTTPS가 깨졌을 때 되돌리기 어려워진다(max-age 동안 http 접속 불가). 짧은 max-age로 시작해 늘리는 방식 검토. `includeSubDomains`/`preload`는 신중히.
* [ ] 접속 로그·모니터링 — 지금은 컨테이너 로그가 전부. 배포 자동화까지 됐으니 실패를 알아챌 수단이 필요하다.

* [ ] 업로드 파일 정리 정책 — `be-uploads` 볼륨은 29GB 디스크에 무한히 쌓인다. 삭제 기능도 용량 제한도 없다(2026-09-08 확인: 0건이라 지금은 무해). 게시글·프로필을 지울 때 파일도 지우는지 확인하고, S3 전환(현재 기동 불가)과 함께 정한다.

* [ ] **AI: 공연 홍보물 OCR → 등록 폼 자동 작성** (2026-09-08 구상, 착수 미정)
  * 인증 연주자가 공연 홍보물(PDF 또는 이미지)을 올리면 읽어서 **일시 / 장소 / 프로그램 / 소개**를 자동으로 채운다. 지금은 이 네 가지를 전부 손으로 입력해야 한다.
  * **왜 이 프로젝트에 맞나**: "LLM 에이전트로 만든 프로젝트"라는 포폴 주제와 기능 자체가 맞아떨어지고, 인증 연주자 도메인의 실제 마찰을 없앤다.
  * **착수 전에 정할 것**
    * 도메인 귀속 — PERFORMANCE 안의 기능인가, 별도 도메인인가. 별도라면 CONSTITUTION/STATUTE를 먼저 쓴다(프로젝트 규칙).
    * OCR·추출 방식 — 범용 OCR 후 LLM 파싱인지, 멀티모달 모델에 이미지를 그대로 넘기는지. 후자가 포스터 레이아웃(표·2단 구성)에 강할 가능성이 높다.
    * 비용·지연 — 업로드마다 외부 API를 부른다. 동기 처리는 등록 화면을 붙잡으므로 비동기(작업 큐)와 실패 시 수동 입력 폴백이 필요하다.
    * 키 보관 — BE 환경변수. FE에 노출하지 않는다(BFF 원칙과 동일).
    * **결과는 초안이지 확정이 아니다.** 반드시 사용자가 검토·수정하는 단계를 거친다. 잘못 읽은 일시로 공연이 잘못 공지되면 서비스 신뢰가 깨진다.
  * 파일 저장이 선행 조건이다 — 현재 `STORAGE_TYPE=s3`는 기동 불가이고, 로컬 볼륨은 정리 정책이 없다(위 항목).

* [ ] **어드민 부트스트랩** — 코드에 `Role.ADMIN`을 부여하는 경로가 **아예 없다**(2026-09-08 확인). 회원가입은 전부 USER이고 승격 API도 없다. 공지 등록과 인증 연주자 승인이 모두 어드민 전용이라, **배포된 서비스는 DB를 직접 건드리지 않으면 영원히 공지를 못 올리고 인증 연주자를 승인할 수 없다.** 시드만의 문제가 아니라 운영 구멍이다.
  * 후보: 환경변수(`ADMIN_LOGIN_IDS`)로 기동 시 승격 / 어드민이 다른 회원을 승격시키는 API(첫 어드민은 여전히 필요) / Flyway 시드.
  * 지금은 `scripts/seed/README.md`의 SQL 절차로 우회한다. 승격 후 **재로그인이 필요**하다 — access 토큰(30분)에 role이 박혀 있다.

* [ ] 약관·개인정보처리방침 문안 검토 — `FE/lib/legal/policy.ts`의 문안은 실제 수집 항목에 맞춰 썼지만 **법적 검토를 받지 않은 초안**이다. 실사용자를 받기 전에 운영자 표시, 보유 기간, 수탁자 목록을 실제와 맞추고 검토받을 것. 문서를 고치면 `POLICY_VERSION`과 BE `ConsentPolicy.CURRENT_VERSION`을 함께 올린다.
* [ ] 기존 회원 재동의 — 규칙 도입(2026-09-09) 전 가입자(`admin`)는 동의 이력이 없다. 소급 생성하지 않기로 했으므로, 다음 로그인 때 동의를 받는 화면이 필요하다.

## BE 공통 (도메인 확장 전후로 필요)

* [x] ~~CORS 설정~~ — BFF 채택으로 브라우저 경로는 same-origin이라 불필요. 모바일 앱 등 BE 직접 호출 소비처가 생기면 재도입 검토. (2026-07-15 결정)
* [ ] Swagger/OpenAPI 문서화 — `resultCode`의 문서화 용도가 COMMON-STATUTE §1에 명시돼 있으나 도입은 미착수
* [x] ~~refresh 토큰 로테이션·철회~~ — 2026-09-08 완료. Redis 화이트리스트(`rt:{memberId}` Set) + 로테이션 + 재사용 감지(전 기기 무효화) + `POST /api/auth/logout` 신설. fail-closed(503-01). 겸사겸사 **`reissue`의 role을 DB에서 다시 읽도록 고쳤다** — 이전에는 refresh claim의 role을 옮겨 담아 강등이 최대 14일간 안 먹혔다. 규칙은 COMMON-STATUTE §4.1.

## 배포 (AWS 전환) — 2026-08-18 정리

* [ ] **FE를 Vercel로 분리 검토 — 2단계(도메인+HTTPS) 이후로 미룸** (2026-09-08 결정)
  * 동기는 "AWS 관리 부담 줄이기"였는데, **수치가 그걸 지지하지 않았다.** FE 컨테이너는 메모리 28MB(전체 911MB의 3%)다. 빼도 서버가 가벼워지지 않는다. 실제 병목은 t3.micro에서 굽는 빌드였고(캐시 5GB), 그건 GHCR 도입으로 이미 해결됐다.
  * 지금 옮기면 선행 조건이 줄줄이 생긴다: BFF가 Vercel→EC2를 공개 인터넷으로 호출하므로 **HTTPS 필수**(HTTP면 토큰 평문), 브라우저가 https 페이지에서 `ws://`를 못 여니 **wss 필수**(안 하면 채팅이 죽는다), `WS_ALLOWED_ORIGINS`에 Vercel 오리진 추가, BFF 합성(달력은 BE 2회 호출)이 도커 브리지 대신 인터넷 왕복이라 지연 증가.
  * **순서가 반대다.** 2단계를 먼저 하면 이 선행 조건이 저절로 충족되고, 그때는 CDN·프리뷰 배포라는 진짜 이득만 남는다. 그 시점에 다시 판단한다.



배포 목표: BE(EC2/ECS) + FE(EC2 또는 Vercel) + DB(RDS)를 각각 분리 운영. **레포는 단일 유지**(빌드 산출물이 `BE/build/libs/*.jar` / `FE/.next`로 이미 독립, 연결점은 런타임 env 주소뿐).

### A. 배포 전 반드시 결정해야 하는 것 (블로커) — 2026-09-08 전부 해소

* [x] ~~**`ddl-auto` 정책 확정**~~ — 2026-09-08 완료. `validate`로 내리고 **Flyway 도입**(`V1__baseline_schema.sql`, 기존 `update` 스키마 19테이블 추출). 기존 DB는 `baseline-on-migrate`로 흡수, 빈 DB에서는 실제로 마이그레이션이 돌아 앱이 뜨는 것까지 확인(컨테이너 포함). 테스트는 `src/test/resources/application.properties`에서 Flyway를 끄고 `create-drop`을 쓴다. 원문: — 현재 `${DDL_AUTO:update}`. 운영 DB에서 Hibernate가 스키마를 자기 판단으로 바꾸고, 컬럼 삭제·타입 변경은 반영조차 안 해 코드/스키마가 조용히 어긋난다. RDS 전환 시 `validate`로 내리고 **Flyway 도입**(현재 마이그레이션 도구 없음 — 2026-08-18 확인). 초기 스키마는 현재 `update`로 생성된 DDL을 베이스라인으로 추출.
* [x] ~~**단일 인스턴스 운영 여부 확정**~~ — **1대로 확정(2026-09-08)**. 채팅이 그대로 동작하는 것이 결정적이었다. 스케일아웃·블루그린은 의도적으로 포기하고, 필요해지면 Redis를 먼저 넣는다. `docker-compose.prod.yml`과 `docs/DEPLOY.md` 첫머리에 이 전제를 못박아 뒀다. 원문: — 지금 채팅은 **다중 서버에서 동작하지 않는다**. STOMP가 인메모리 Simple Broker라 A서버 사용자와 B서버 사용자 간 메시지가 오가지 않고, `PresenceRegistry`도 인메모리라 단일 서버에서만 정확. 스케일아웃이나 무중단(블루-그린) 배포를 할 거면 **그 전에 Redis 선행**(`enableStompBrokerRelay` 교체 + Redis 기반 `PresenceRegistry`, 도메인 코드는 불변). 1대 운영이면 현행 유지 가능.
* [x] ~~**WS origin 좁히기**~~ — 2026-09-08 완료. `app.ws.allowed-origins`(`WS_ALLOWED_ORIGINS`)로 환경변수화. 기본값은 로컬 주소뿐이고 운영에서는 FE origin으로 좁힌다. 원문: — `WebSocketConfig.setAllowedOriginPatterns("*")`(BE/src/main/java/com/back/global/websocket/WebSocketConfig.java:24)를 실제 FE origin으로 제한. 프로덕션 노출 전 필수.

### B. 인프라 구성

* [ ] **RDS 전환** — 데이터소스가 이미 env(`DB_URL`/`DB_USERNAME`/`DB_PASSWORD`)라 값 교체만으로 전환 가능. 함께 처리: RDS 퍼블릭 접근 차단(보안그룹으로 앱 서버만 허용), 파라미터 그룹 `utf8mb4`/타임존, HikariCP 풀 크기 vs 인스턴스 `max_connections`, 자격증명은 Secrets Manager 또는 env(커밋 금지 규칙 기존대로).
* [x] ~~**Nginx 리버스 프록시 + WebSocket 프록시**~~ — 2026-09-08 완료. 도메인이 없어 **2단계로 나눴다**: `deploy/nginx.conf`(1단계, IP+HTTP)와 `deploy/nginx.https.conf`(2단계, 도메인+TLS). 둘 다 문법 검증 통과(2단계는 인증서 파일만 없음). WS Upgrade 헤더·1시간 타임아웃, 업로드 상한을 BE multipart 10MB와 일치, actuator는 외부 차단. 원문: — `/ws` 업그레이드 헤더 통과 설정 포함. (기존 항목)
* [x] ~~**CI/CD 구성**~~ — 2026-09-08 `.github/workflows/ci.yml` 작성. 한 워크플로 안에서 `dorny/paths-filter` + `needs`로 BE→FE 순서 강제. **배포 job은 아직 없다**(EC2 접속 방식 미정). 원문: — 모노레포 경로 필터로 BE/FE 파이프라인 분리. ⚠️ 워크플로 **파일**을 나누면 두 쪽이 같이 바뀐 커밋에서 배포 순서가 보장되지 않아 계약 변경 배포 때 깨진 창이 생긴다. 한 워크플로 안에서 job 레벨 변경 감지(`dorny/paths-filter`) + `needs`로 **BE → FE 순서 강제**.
* [x] ~~**헬스체크 엔드포인트**~~ — 2026-09-08 완료. Actuator 추가, `health`만 노출하고 SecurityConfig에서 `/actuator/health`만 permitAll. `/actuator/env`·`/beans`가 401인 것까지 확인. 원문: — 현재 Spring Actuator 미도입(2026-08-18 확인). ALB/ECS 헬스체크·무중단 배포에 필요하므로 `actuator` 추가 후 `/actuator/health`만 노출(나머지 엔드포인트는 차단).
* [x] ~~**프로덕션 환경변수 목록 정리**~~ — 2026-09-08 완료. `docs/DEPLOY.md`에 주입 시점까지 포함한 표, `.env.prod.example` 추가. `NEXT_PUBLIC_BE_WS_URL`이 **빌드 시점**에 박힌다는 점을 명시. 원문: — `DB_*`, `JWT_SECRET`, `KAKAO_CLIENT_ID`/`SECRET`, `STORAGE_TYPE`/`S3_*`, `DDL_AUTO`, FE의 `BE_BASE_URL`/`NEXT_PUBLIC_BE_WS_URL`(wss)/`KAKAO_REDIRECT_URI`. 한 곳에 표로 정리(어디에 주입하는지 포함). 카카오 `redirect_uri`는 개발자 콘솔에도 운영 주소 등록 필요.
* [ ] **도메인 확보 후 HTTPS 전환(2단계)** — A 레코드 → 443 개방 → compose의 nginx 블록을 `nginx.https.conf`로 교체 → certbot 발급 → `PUBLIC_ORIGIN`/`NEXT_PUBLIC_BE_WS_URL`을 https·wss로 → **FE 이미지 재빌드**(NEXT_PUBLIC_*은 빌드에 박힌다) → 카카오 Redirect URI 갱신. 절차는 `docs/DEPLOY.md` 2단계.
* [ ] CI 배포 job — EC2 접속 방식(SSH 키/SSM/ECR)이 정해지면 `.github/workflows/ci.yml`에 붙인다. 지금은 서버에서 `git pull` + `up -d --build`가 배포다.

### C. 배포 후 / 최적화

* [ ] Flyway 버전 올리기 — 현재 Spring Boot가 번들하는 **10.20.1**이라 MySQL 8.4에서
  "지원 테스트 안 됨" 경고가 매 기동 시 뜬다(동작은 정상, 2026-09-08 로컬·컨테이너에서 확인).
  최신은 13.5.0. 메이저 3단계 점프라 배포와 분리해서, 빈 DB 기동·기존 DB baseline·`validate`를
  모두 다시 확인하며 올린다. 에디션/라이선스 변경 여부도 함께 확인할 것.


* [ ] **[결함] `STORAGE_TYPE=s3`는 지금 기동조차 안 된다** — `S3FileStorage`가 생성자로 `S3Client`를 받는데 **코드베이스에 `S3Client` 빈을 만드는 곳이 없다**(2026-09-08 확인. `S3Client.builder` grep 결과 0건). 켜면 `No qualifying bean of type S3Client`로 컨텍스트 로딩이 실패한다. 테스트가 `S3Client`를 목으로 주입해 와서 여태 드러나지 않았다 — "미검증"이 아니라 "동작 불가"다.
  * 고칠 때 함께 정할 것: 자격증명을 **액세스 키가 아니라 EC2 인스턴스 역할(IAM Role)**로 받는다. `S3Client.builder().region(...).build()`가 기본으로 쓰는 `DefaultCredentialsProvider`가 인스턴스 메타데이터를 읽으므로, 서버에 키 파일을 두지 않아도 된다(유출·로테이션 부담 없음). `storage.s3.access-key`/`secret-key` 설정은 로컬 테스트용으로만 남기거나 제거.
  * 그 뒤에야 실연동 검증(업로드/삭제/조회)이 의미가 있다. 1단계 배포는 `STORAGE_TYPE=local`이라 영향 없음.
* [ ] 고아 파일 정리(GC) — 메타데이터 없는 물리 파일, 업로드 실패로 남은 파일 정리 배치
* [ ] CloudFront/R2 등 CDN 전환으로 파일 접근 요금 최적화 (`base-url` 교체만으로 가능하도록 설계됨)
* [ ] 로그/모니터링 방침 — 현재 예외는 `GlobalExceptionHandler`가 `log.warn`/`log.error`로 남긴다. 운영에서 어디로 모을지(CloudWatch 등) 결정.

## 기타 (추후)

* [ ] FE: middleware → proxy 마이그레이션 검토 — Next 16.2에서 'middleware' 파일 규약이 deprecated(경고만, 현재 정상 동작). proxy는 edge가 아닌 nodejs 런타임이라 'server-only' import 제약이 사라질 수 있어 쿠키 이름 하드코딩 재검토 대상. (2026-07-15 발견)

## 실환경 스모크 검증에서 새로 확인한 항목 (2026-08-18)

* [x] ~~FE 전역 내비게이션 부재~~ — 2026-08-18 해소. 공용 헤더 도입, 홈을 /feed로 전환, /dashboard 제거.
* [x] ~~FE 프로필 화면에 닉네임·인증뱃지 미표시~~ — 2026-08-18 해소. 신원 조회 추가 + AuthorBadge 재사용. "내 지원 현황" 링크도 함께 추가.
* [ ] 문서 계약 표기 정정 확산 확인 — `scope` 쿼리 파라미터를 소문자(`open|closed|all`, `upcoming|past|all`)로 적어둔 곳이 남아있는지 도메인 STATUTE까지 점검. 실제 계약은 enum 상수 그대로 대문자(`OPEN`/`UPCOMING`). (CONTEXT.md는 정정 완료)
* [ ] 채팅 대화창 스크롤 — 메시지가 쌓여도 하단 고정이 없어 새 메시지가 화면 밖으로 밀린다. 기존 "이전 메시지 더 보기" 항목과 함께 처리.
* [ ] 채팅 1:1 시작이 회원 id 입력이라 실사용 불가 수준 — 기존 항목(회원 검색 API)의 우선순위를 올릴지 검토. 스모크에서도 상대 id를 DB로 확인해야 했다.

## 악보지 테마 후속 (2026-08-18 범위 밖)

* [ ] 사용자 테마 토글(종이/밤 직접 선택) — 현재는 OS 설정(`prefers-color-scheme`)만 따른다. 두 팔레트가 이미 정의돼 있어 토글·저장(쿠키/localStorage)·SSR 깜박임 처리만 남는다.
* [ ] 폼/패널 컨테이너의 `bg-surface` 여부 일관성 재검토 — 치환 작업에서 목록 항목·상세 패널에는 `bg-surface`를 넣고, 입력 폼을 감싼 래퍼(`ComposeForm`·`NewChatForm`·`ApplyPanel`의 폼 패널, `ApplicationReviewItem`의 사유 입력 패널)에는 넣지 않는 판단을 했다. 여러 담당이 독립적으로 같은 결론을 냈고 실화면상 문제는 없으나, 디자인 의도상 폼도 카드로 보여야 한다면 한 번에 정리할 것.
* [ ] `body`의 `font-family: Arial, Helvetica, sans-serif`가 Geist 변수 폰트를 덮어쓰고 있다 — 프로젝트 초기부터 있던 것으로 이번 범위 밖이었으나, 폰트를 의도대로 쓰려면 정리 필요.
* [ ] 테스트 플레이크: `__tests__/chat-room-page.test.tsx`의 "DIRECT 헤더는 본인을 제외한 참여자만 표시"가 전체 병렬 실행에서 드물게 실패하고 단독·재실행에서는 통과한다(2026-08-18 관측 1회). 원인 규명 필요 — 목 `useRouter` 참조 변화로 인한 기존 flakiness와 같은 계열일 가능성.

## 포트폴리오 정비 (2026-08-18 식별)

* [x] ~~**README 부재**~~ — 2026-09-08 작성. 루트(서비스 소개·LLM 에이전트 개발 방식·아키텍처·실행·현재 상태와 한계) + `BE/README.md`(경로 규약·응답 형식·JDK 21 함정) + `FE/README.md`(BFF 3계층·색 토큰·레이아웃 주의). FE의 create-next-app 기본 README를 교체했다. **스크린샷만 아직 비어 있다**(아래 항목). 원문: 루트·FE·BE 어디에도 README가 없다. 포트폴리오에서는 사실상 첫인상이므로 우선순위가 높다. 담을 것: 서비스 소개, 스택, 아키텍처(BFF·도메인 6개·JWT/OAuth·STOMP), 실행법(docker compose + bootRun + npm run dev, JDK 21 주의), 화면 스크린샷(라이트/다크), 그리고 LLM 에이전트 기반 개발 방식과 `docs/` 문서 체계 소개.
* [ ] 화면 스크린샷 확보 — 새 홈·피드·공연·구인·채팅을 라이트/다크 각각. `docs/images/`에 넣고 루트 README "화면" 절의 주석 자리를 채운다. 홈이 생겼으니 이제 찍어도 다시 찍을 일이 없다.

## 홈 화면 신설 (2026-09-08 목업 → BE → FE 완료)

목업: Claude Design 캔버스 "Attacca 화면 목업"(아트보드 11장 — 홈 라이트/다크/모바일 375 + 기존 8화면). 색·간격·컴포넌트 값은 실제 코드에서 그대로 가져왔다. 작업 `.dc.html` 파일은 세션 스크래치패드에 있어 휘발성이므로, 재작업 시 캔버스에서 `seed-canvas.mjs --extract`로 복원할 것.

구성: 상단 자동 전환 캐러셀(공연·공지·뉴스) / 하단 2단 — 왼쪽 게시글 위젯(최신글·인기글 탭), 오른쪽 월간 달력 + 이번 달 일정.

**확정된 결정 — 달력에 올라오는 것은 두 가지뿐이다 (2026-09-08).**

* 공연 — 인증 연주자가 등록한 것. PERFORMANCE 등록 자격이 이미 `인증 연주자 | ROLE_ADMIN`으로 게이팅돼 있어 달력에서 별도 필터가 필요 없다.
* 공지 일정 — ROLE_ADMIN이 직접 등록한 것.
* 구인 마감은 달력에서 **제외**한다.

선행 작업:

* [x] ~~BE FEED: 인기글 정렬 옵션~~ — 2026-09-08 완료. `GET /api/public/feed/posts?sort=LATEST|POPULAR`. 인기순은 **최근 30일 창** 안에서 (좋아요+댓글) 내림차순(창이 없으면 옛 글이 영구 고정). 정렬 키가 id가 아니라 집계값이라 커서가 아닌 오프셋 페이징이며, 인증 경로의 커서 타임라인은 최신순 그대로 두었다. FEED-STATUTE §12.
* [x] ~~BE PERFORMANCE: 월 범위 조회~~ — 2026-09-08 완료. `GET /api/public/performances?scope=SCHEDULED&from=&to=`. NOTICE와 같은 이름·같은 `[from, to)` 규약이라 BFF가 두 번 같은 모양으로 호출해 합치면 된다. PERFORMANCE-STATUTE §12.
* [x] ~~NOTICE 도메인 문서 작성~~ — 2026-09-08 완료. `DOMAIN-NOTICE-CONSTITUTION.md` / `DOMAIN-NOTICE-STATUTE.md`. ARCHITECTURE-CONSTITUTION §3 도메인 표와 ARCHITECTURE-STATUTE §2 패키지 트리에도 반영.
* [x] ~~NOTICE 도메인 BE 구현~~ — 2026-09-08 완료(TDD, 테스트 46개, 전체 358/358). STATUTE §11 미결정 4건도 함께 확정: `pinned`는 등록 제한 없이 **조회에서 상위 5건만**, 목록 size 기본 20/최대 50(PINNED만 5), 공개·어드민 모두 **`PageResponse<T>`**, `content`는 **순수 텍스트**(마크다운 미허용).
* [ ] 기존 도메인 목록 응답을 `PageResponse<T>`로 전환 — NOTICE에서 도입했다. VERIFIED-PERFORMER 어드민 목록·PERFORMANCE 목록이 아직 `Page<T>`(PageImpl) 직렬화라 Boot 3.4 경고가 남아 있다. (기존 "BE 공통 정리" 항목과 같은 건 — 여기서 통합)
* [ ] NOTICE 본문 마크다운 지원 — 지금은 순수 텍스트로 확정. 서식이 필요해지면 FE 렌더러와 XSS 처리(허용 태그 화이트리스트)를 함께 도입할 것.
* [x] ~~**PERFORMANCE: 공개 조회 추가**~~ — 2026-09-08 완료(위 항목과 함께).
* [x] ~~BFF `/api/bff/public/calendar`~~ — 2026-09-08 완료. 공연·공지 두 공개 조회를 호출해 시각순 한 벌로 합친다. 한쪽이라도 실패하면 반쪽 달력을 그리지 않고 실패로 내린다(빠진 일정이 "없는 일정"으로 보이면 안 되므로).
* [x] ~~FE 홈 화면~~ — 2026-09-08 완료. `/`(공개), 캐러셀·게시글 위젯(최신/인기)·월간 달력. 비로그인 헤더(로그인·회원가입)와 로그인 후 원래 경로 복귀(`next`)도 함께.
* [x] ~~홈의 비로그인 노출 여부 결정~~ — **공개 랜딩으로 확정·구현 완료(2026-09-08)**. 비로그인도 홈을 볼 수 있고, 상세로 들어가면 로그인으로 유도한다. 포트폴리오에서 링크만 열어도 서비스가 보이는 것이 목적.
* [x] ~~**BE: 공개 조회 경로 신설**~~ — 2026-09-08 완료. `/api/public/**` permitAll + 도메인별 공개 컨트롤러·DTO 분리(NOTICE·PERFORMANCE·FEED 3종). 회원 id 미노출은 `PublicMemberDisplay`가 구조적으로 강제한다. 규칙은 NOTICE-STATUTE §6.
* [x] ~~홈 도입 시 헤더 변경~~ — 2026-09-08 완료. `NAV_ITEMS`에 홈 추가, 로고·홈 경로를 `/`로, 컨테이너 `max-w-4xl`→`max-w-5xl`. 비로그인이면 로그인·회원가입을 보여준다(예전에는 신원을 못 얻으면 헤더 자체를 렌더하지 않아 공개 홈에서 로그인할 방법이 없었다).
* [ ] (목업 제안, 선택) 채팅을 방 목록+대화창 한 화면 2단으로 / 공연 상세 포스터를 왼쪽 열로.
* [ ] 홈 후속: 캐러셀 자동 전환을 hover·포커스 시 일시정지(현재는 계속 넘어간다), `prefers-reduced-motion` 존중.
* [ ] 홈 후속: 공지 상세 화면(`/notices/[id]`)이 없어 달력의 공지 항목은 클릭할 수 없다. 캐러셀의 공지 슬라이드도 CTA가 없다.
* [ ] 홈 후속: 히어로 이미지가 없을 때 "이미지 없음" 회색 박스가 그대로 보인다 — 포스터 없는 공연이 많으면 밋밋하다. 타이포 기반 대체 디자인 검토.

## 접근성 — 색 대비·글자 크기 (2026-09-08 목업 검토에서 식별)

WCAG AA 본문 기준(4.5:1) 미달. 특정 화면이 아니라 **토큰 값 자체**의 문제라 사용처를 하나씩 고치는 대신 한 번에 정리해야 한다.

* [ ] `--ink-faint` 대비 미달 — 라이트 `#8a8378`가 `--surface`(#faf7f0)에서 **3.5:1**, `--paper`(#f5f0e6)에서 **3.3:1**. 다크 `#75706a`도 `--surface`(#232120)에서 **3.3:1**. 타임스탬프·입력 플레이스홀더·"불러오는 중..." 등 전 화면에 쓰여 영향 범위가 넓다.
* [ ] 헤더 비활성 내비의 `opacity-75` — `--on-header`가 `--header` 위에서 **4.3:1**로 기준을 아슬하게 못 넘긴다(`components/layout/Header.tsx`). 불투명도를 올리거나 별도 토큰으로 분리.
* [ ] 인증 뱃지 `text-[10px]` — 12px 미만(`components/feed/AuthorBadge.tsx`, `components/layout/Header.tsx`의 헤더 뱃지도 동일). 12px 이상으로 올리거나 아이콘+접근명으로 대체 검토.
