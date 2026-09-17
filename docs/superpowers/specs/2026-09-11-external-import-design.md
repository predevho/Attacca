# 외부 공연·입시 공지 반입(IMPORT) 설계

- 작성일: 2026-09-11
- 상태: **사용자 승인** (2026-09-13, 대학 17곳 조사 반영 후 구현 준비)
- 범위: KOPIS 클래식 공연과 대학 입학처·음대 공지를 자동으로 모아 두고, 어드민이 골라 공지(NOTICE)로 올린다.
- 관련 도메인: NOTICE(변경), 신설 IMPORT. MEMBER·PERFORMANCE와는 무관하다.

---

## 0. 결정 요약

1. **자동 수집 → 어드민 승인 → 공지로 승격.** 수집한 것은 회원에게 직접 보이지 않는다. 공개되는 순간 그것은 NOTICE의 글이다.
2. **별도 도메인 IMPORT를 신설한다.** 심사 전 후보를 NOTICE에 섞지 않는다. NOTICE는 출처·원문 링크 필드 두 개만 늘어난다.
3. **공연은 KOPIS Open API, 입시는 대학 게시판 목록의 제목·링크·게시일만.** 본문·첨부 PDF는 저장하지 않는다.
4. **승인하면 기존 공지 폼이 채워진 채 열린다.** 어드민이 고친 뒤 등록한다.
5. **포스터는 승인할 때만 내려받아 우리 저장소에 둔다.** 공개 화면은 외부 이미지를 직접 걸지 않는다.
6. **수집 시점:** KOPIS 주 1회, 입시는 집중 기간에만 매일 7~23시 매시. 둘 다 어드민 수동 실행 가능.

---

## 1. 법적 전제 (2026-09-11 검토)

변호사 검토가 아니라 설계 판단용이다. 서비스를 상업화하기 전에는 변호사 확인을 권한다.

| 원천 | 판단 | 근거 |
|---|---|---|
| 티켓 판매처(인터파크·예스24·멜론티켓) | **수집하지 않는다** | 약관에서 자동수집 금지 |
| KOPIS Open API | 사용한다 | 상업적 이용 가능, **출처 표기 의무**("출처: (재)예술경영지원센터 공연예술통합전산망(www.kopis.or.kr)"), 미표기 시 서비스 중단 가능 |
| 대학어디가(adiga.kr) | 사용하지 않는다 | Open API 없음, 저작권정책상 DB 정보 무단 복제·수익 목적 이용 금지 |
| 공공데이터포털 입시 API | 해당 없음 | 대교협·교육부 명의의 전형 일정 API가 없다 |
| 대학 입학처·음대 게시판 | 목록의 제목·링크·게시일만 | 사실 정보와 링크는 저작물 복제가 아니다. 본문·PDF는 저장하지 않는다 |

**운영 규칙** (IMPORT STATUTE로 승격한다)

* robots.txt를 매 실행마다 확인하고 막힌 경로는 읽지 않는다.
* 식별 가능한 User-Agent와 연락처를 보낸다.
* 로그인이 필요한 페이지, 비공개 API, 차단 우회는 하지 않는다.
* 목록 첫 페이지만 읽는다. 사이트 전체를 미러링하지 않는다.
* 모든 공지에 출처와 원문 링크를 표시한다.

---

## 2. 도메인 IMPORT

패키지: `com.back.domain.imports` (`import`는 Java 예약어라 복수형을 쓴다).

**책임:** 외부 원천에서 후보를 모으고, 어드민이 심사할 때까지 보관한다. 승인 시 NOTICE 서비스에 공지 생성을 요청한다.

**의존 방향:** IMPORT → NOTICE(서비스 계층) 한 방향. NOTICE는 IMPORT를 모른다.

### 2.1 ImportedItem

`BaseEntity` 상속. soft delete를 두지 않는다. 거절은 상태로 남긴다.

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | Long | PK |
| `source` | ImportSource | `KOPIS` / `UNIV_NOTICE`. STRING |
| `sourceKey` | String | 원천 안의 고유 식별자. KOPIS는 `mt20id`, 대학은 `{게시판코드}:{글번호}`. ≤200 |
| `sourceName` | String | 출처 표기. KOPIS 표기 문구 또는 "서울대학교 입학본부" 같은 게시판 이름. ≤200 |
| `sourceUrl` | String | 원문 링크. ≤500, nullable |
| `title` | String | ≤200 |
| `startsAt` | LocalDate | 공연 시작일. 대학 공지는 null |
| `endsAt` | LocalDate | 공연 종료일. nullable |
| `postedAt` | LocalDate | 대학 게시글 작성일. KOPIS는 null |
| `place` | String | 공연장명. ≤200, nullable |
| `summary` | String | 출연·관람료·공연 시간·런타임 텍스트. ≤2000, nullable |
| `posterUrl` | String | KOPIS 포스터 원본 URL. ≤500, nullable |
| `status` | ImportStatus | `NEW` / `APPROVED` / `REJECTED` |
| `noticeId` | Long | 승인으로 생긴 공지 id. `APPROVED`일 때만 non-null |
| `lastSeenAt` | LocalDateTime | 원천에서 마지막으로 확인된 시각 |

* 유니크: `(source, sourceKey)`. 같은 항목은 한 번만 쌓인다.
* 전이: `NEW → APPROVED(noticeId)`, `NEW → REJECTED`. 종결 상태에서 전이하면 `IMPORT_ITEM_ALREADY_HANDLED`(409-11).
* 재수집 시 같은 키가 있으면 상태와 무관하게 새로 만들지 않고 `lastSeenAt`만 갱신한다. 거절한 항목이 되살아나지 않는다.
* 목록 정렬은 처음 수집된 시각(`createdAt`) 내림차순, id 타이브레이크.

### 2.2 ImportRun (실행 기록)

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | Long | PK |
| `source` | ImportSource | |
| `trigger` | ImportTrigger | `SCHEDULED` / `MANUAL` |
| `startedAt` / `finishedAt` | LocalDateTime | |
| `result` | ImportRunResult | `SUCCESS` / `PARTIAL` / `FAILED` / `SKIPPED` |
| `newCount` | int | 새로 쌓인 항목 수 |
| `message` | String | 실패한 게시판과 사유 요약. ≤1000, nullable |

* **실행이 끝날 때 한 번 기록한다.** "실행 중" 표시는 메모리 플래그로 한다(§5.3). 시작 시 기록하면 서버가 도중에 죽었을 때 영원히 "실행 중"인 행이 남는다.
* `SKIPPED`: KOPIS 키가 없거나, 모든 게시판이 robots로 막힌 경우.
* 90일이 지난 기록은 삭제한다(KOPIS 주간 스케줄 실행 때 함께 처리한다).

---

## 3. NOTICE 변경

### 3.1 필드 추가

| 필드 | 타입 | 제약 |
|---|---|---|
| `sourceName` | String | ≤200, nullable |
| `sourceUrl` | String | ≤500, nullable. http·https만 허용 |

* `sourceUrl` 검증은 `PerformanceRequest.ticketUrl`과 같은 정규식(`^\s*(https?://\S+)?\s*$`)을 쓴다.
* `sourceUrl`이 있으면 `sourceName`도 있어야 한다. 위반 시 `INVALID_INPUT_VALUE`(400-01). 출처 표기가 KOPIS·한예종의 이용 조건이기 때문이다.
* 어드민이 직접 쓰는 공지에서도 두 칸을 쓸 수 있다. 입시 공지를 손으로 올릴 때도 원문으로 연결한다.

### 3.2 공개 노출 (명시적 결정)

* `PublicNoticeResponse`에 `sourceName`, `sourceUrl`을 추가한다. NOTICE 원칙은 공개 필드 추가를 명시적 선택으로 요구하므로 이 문서에서 결정한다.
* 공지 본문을 보여 주는 공개 화면에 "출처: {sourceName}"과 "원문 보기" 링크를 표시한다. 링크는 FE `isHttpUrl` 가드를 통과할 때만 그린다. 공개 화면의 정확한 위치는 구현 착수 시 확인한다.

### 3.3 스키마

새 Flyway 마이그레이션 하나(`V4__…`)로 공지 컬럼 두 개, `imported_item`, `import_run` 테이블을 추가한다.

---

## 4. 수집기

원천마다 수집기 하나가 같은 인터페이스(`ImportCollector`: 원천 이름, 수집 결과 목록 반환)를 구현한다. 네트워크 호출은 트랜잭션 밖에서 하고 저장만 트랜잭션 안에서 한다.

### 4.1 KOPIS 수집기

* HTTP: `RestClient`(카카오 OAuth 클라이언트와 같은 방식). 연결 5초, 읽기 10초 타임아웃.
* 응답은 XML뿐이다. `jackson-dataformat-xml` 의존성을 추가한다.
* 목록 `GET /openApi/restful/pblprfr`
  * `shcate=CCCA`(서양음악·클래식), 지역 제한 없음.
  * 조회 구간 상한이 31일이라 8주를 28일씩 두 번 부른다(오늘~+27일, +28일~+55일).
  * `rows=100`, 한 페이지가 100건 미만일 때까지 `cpage`를 넘긴다.
* 상세 `GET /openApi/restful/pblprfr/{mt20id}`는 **처음 보는 공연만** 부른다.
* 요청 간격 200ms 이상(초당 5회 이하). KOPIS 제한은 IP당 초당 10회다. 대기는 주입 가능한 함수로 두어 테스트에서 실제로 기다리지 않는다.
* 매핑

| ImportedItem | KOPIS |
|---|---|
| `sourceKey` | `mt20id` |
| `title` | `prfnm` |
| `startsAt` / `endsAt` | `prfpdfrom` / `prfpdto` |
| `place` | `fcltynm` |
| `summary` | `prfcast`, `pcseguidance`, `dtguidance`, `prfruntime`를 줄 단위로 |
| `posterUrl` | `poster` |
| `sourceUrl` | `relates` 중 첫 번째 http(s) `relateurl`. 없으면 `https://www.kopis.or.kr` |
| `sourceName` | "(재)예술경영지원센터 공연예술통합전산망(www.kopis.or.kr)" |

* 인증키는 환경변수 `KOPIS_SERVICE_KEY`. 비어 있으면 로그만 남기고 `SKIPPED`로 기록한다.
* 기본 URL은 설정값으로 둔다. 개발가이드 표기는 http이며 https 동작 여부는 구현 초기에 확인한다.

### 4.2 대학 게시판 수집기

* 대학마다 Java 클래스를 만들지 않는다. **게시판 설정 한 줄 + 공통 수집기 하나.** 대학 추가는 설정 추가다.
* HTML 파싱: `jsoup` 의존성을 추가한다.
* 게시판 설정 항목

| 항목 | 뜻 |
|---|---|
| `code` | 게시판 코드. `sourceKey` 접두사 (예: `snu-admission`) |
| `name` | 출처 표기 (예: "서울대학교 입학본부") |
| `listUrl` | 목록 첫 페이지 주소 |
| `charset` | 문자 인코딩. 연세대 입학처는 `EUC-KR` |
| `rowSelector` / `titleSelector` / `linkSelector` / `dateSelector` | CSS 선택자. 표(`tr`)와 목록(`li`) 모두 대응 |
| `dateFormat` | 게시일 형식 (예: `yyyy. M. d.`, `yyyy/MM/dd`, `yyyy.MM.dd`) |
| `postIdPattern` | 상세 링크에서 글 번호를 뽑는 정규식 (예: `BBS_NO=(\d+)`, `/notice/(\d+)`) |
| `keywords` | 제목 필터. 비우면 모든 행 (이미 입학 분류로 걸러진 게시판) |

* **글 번호를 링크에서 뽑는 이유:** 연세대 상세 링크에는 목록 페이지 번호(`s_page`)가 들어 있다. 링크 전체를 키로 쓰면 같은 글이 페이지마다 다른 키가 되어 중복으로 쌓인다.
* 목록 첫 페이지만 읽는다. 상단 고정글은 매번 보이지만 유니크 키로 한 번만 저장된다.
* 상대 링크는 `listUrl` 기준 절대 주소로 바꾼다. 게시일을 읽지 못한 행은 건너뛴다.
* 기본 키워드: 음악, 실기, 곡목, 악보, 예능, 예체능, 모집요강, 수시, 정시.
* User-Agent: `AttaccaBot/1.0 (+{IMPORT_CONTACT})`. 연락처는 환경변수로 받는다.
* 연결 5초, 읽기 10초 타임아웃. 같은 호스트의 게시판 사이에 1초 간격을 둔다.

### 4.3 robots.txt 판정

* 실행마다 호스트별로 한 번 받는다.
* `AttaccaBot` 그룹이 있으면 그 규칙을, 없으면 `*` 그룹을 적용한다. 연세대 음대처럼 특정 봇 이름을 막는 사이트가 있어 `*`만 보면 안 된다.
* 같은 경로에 Allow와 Disallow가 겹치면 더 긴 규칙이 이긴다.
* 응답이 4xx면 전부 허용, 5xx·시간 초과면 그 호스트를 건너뛴다(RFC 9309).
* 막힌 게시판은 읽지 않고 실행 기록 `message`에 남긴다.

### 4.4 장애 격리

* 게시판 하나가 실패해도 다른 게시판은 계속 수집한다. 일부 실패는 `PARTIAL`이다.
* KOPIS 실패는 KOPIS 실행 기록에만 남는다.

---

## 5. 스케줄

스케줄링은 이 프로젝트에 처음 들어간다(`@EnableScheduling`). 서버가 한 대라 분산 잠금은 두지 않는다.

### 5.1 KOPIS

* 매주 월요일 05:00(Asia/Seoul).

### 5.2 입시

* 매일 07:00~23:00 매시 정각(Asia/Seoul)에 깨어나, **집중 기간 안일 때만** 수집한다.
* 집중 기간(설정값, 매년 같은 월·일로 반복, 연말을 넘는 구간 허용)

| 구간 | 주로 올라오는 공지 |
|---|---|
| 03-25 ~ 04-10 | 입학전형 안내, 작곡과 곡목, 한예종 요강, 대학원 후기 곡목 |
| 05-25 ~ 06-05 | 수시 모집요강 (대교협 시한 5월 31일) |
| 07-01 ~ 09-20 | 수시 실기곡목, 정시 요강 (시한 9월 1일), 수시 1단계 시간표·악보컷, 한예종 8·10월 입시 |
| 11-01 ~ 11-30 | 정시 실기곡목, 수시 2단계 시간표·악보컷 |
| 12-26 ~ 01-31 | 정시 가·나·다군 실기 시간표·악보컷·본심 대상자 |

* 근거: 대교협 「대학입학전형기본사항」, 서울대 음대·입학본부, 연세대 입학처, 한예종, 한양대 게시판의 2026·2027학년도 실제 게시일(2026-09-11 조사).
* 주말을 포함하는 이유: 악보컷·시험 시간표는 시험 직전에 올라오고 정시 실기는 주말에도 치른다.
* 기간 밖에는 자동 수집하지 않는다. 수동 실행은 언제든 된다.

### 5.3 수동 실행과 중복 방지

* `POST /api/admin/imports/runs?source=`는 요청을 접수하면 즉시 202를 반환하고 백그라운드에서 수집한다. 운영 Nginx가 `/api/` 응답을 기본 60초까지만 기다리기 때문이다.
* 원천별 메모리 플래그로 잠근다. 같은 원천이 돌고 있으면 `IMPORT_ALREADY_RUNNING`(409-12). 스케줄 실행과 수동 실행이 같은 플래그를 쓴다.

### 5.4 비용 (추정)

| 항목 | 입시 1회 | 입시 하루 17회 |
|---|---|---|
| 요청 | 게시판 약 30 + robots 약 25 | 약 950 |
| 데이터 | 약 2~3MB | 약 50MB |

EC2로 들어오는 트래픽은 무료이고 계산량은 미미하다. 상대 서버 기준으로도 게시판당 시간당 1회다.

---

## 6. 승인 흐름

1. 어드민이 수집 항목 화면에서 "승인"을 누른다.
2. 공지 폼(`NoticeForm`)이 아래 초기값으로 열린다.
3. 등록하면 `POST /api/admin/imports/{id}/approve`로 공지 요청 본문을 보낸다.
4. IMPORT 서비스가 처리한다.
   1. (트랜잭션 밖) KOPIS 항목이고 `posterUrl`이 있으면 포스터를 내려받는다.
   2. (트랜잭션 안) 항목을 쓰기 잠금으로 조회하고 `NEW`인지 확인한다. 아니면 409-11.
   3. `NoticeService`로 공지를 만들고, 포스터가 있으면 커버로 저장한다.
   4. 항목을 `APPROVED(noticeId)`로 바꾼다.
5. 응답 `201 { noticeId, posterSaved }`. 포스터를 받지 못했으면 화면이 그 사실을 알린다.

* 승인 요청의 `sourceName`이 비어 있으면 400-01. 어드민이 출처 칸을 지워 출처 표기 없이 공개되는 것을 막는다.
* 거절: `POST /api/admin/imports/{id}/reject` → `REJECTED`. 되돌리지 않는다.

### 6.1 폼 초기값

| 칸 | KOPIS 공연 | 대학 공지 |
|---|---|---|
| 종류 | `EVENT` | `NOTICE` |
| 제목 | 공연명 (100자 초과 시 어드민이 줄인다) | 게시글 제목 |
| 일시 | **비워 둔다** | 비워 둔다 |
| 장소 | 공연장 | 비워 둔다 |
| 본문 | `summary` | "{게시판 이름}에 새 공지가 올라왔습니다. 자세한 내용은 원문을 확인하세요." |
| 상단 고정 | 끔 | 끔 |
| 출처 / 원문 링크 | KOPIS 표기 / 예매처 링크 | 게시판 이름 / 게시글 링크 |

* KOPIS 일시를 비우는 이유: KOPIS는 날짜와 "화~금 19:30" 같은 문장만 준다. 브라우저 날짜·시간 입력은 날짜만 채울 수 없고, 시각을 추측해 넣으면 달력에 틀린 시각이 뜬다. 폼 위에 공연 기간과 공연 시간 안내를 보여 주고, `EVENT`는 일시가 필수라는 기존 검증이 입력을 강제한다.

### 6.2 포스터

* 요청 대상 호스트를 허용 목록(설정값, 기본 `www.kopis.or.kr`, `kopis.or.kr`)으로 제한한다. 외부 데이터에서 온 URL을 서버가 받아 오므로 SSRF 통로가 되지 않게 한다. 실제 포스터 호스트는 구현 초기에 실제 응답으로 확인한다.
* `Content-Type`이 `image/*`가 아니거나 10MB를 넘으면 받지 않는다.
* 실패해도 승인은 성공한다(`posterSaved=false`).
* `FileService`에 바이트 입력 업로드 메서드를 추가한다(지금은 `MultipartFile`만 받는다). 저장 디렉터리는 공지 커버와 같다.

---

## 7. API와 에러 코드

모든 경로는 `/api/admin/**`이라 `SecurityConfig`의 기존 `hasRole("ADMIN")`으로 막힌다.

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/admin/imports?status=NEW&source=&page=&size=` | `Page<ImportedItemResponse>` |
| GET | `/api/admin/imports/runs/latest` | 원천별 마지막 실행 + 실행 중 여부 + 입시 집중 기간 여부·다음 실행 시각 |
| POST | `/api/admin/imports/runs?source=KOPIS\|UNIV_NOTICE` | 202 |
| POST | `/api/admin/imports/{id}/approve` | 201 `{ noticeId, posterSaved }` |
| POST | `/api/admin/imports/{id}/reject` | 200 |

| 코드 | resultCode | HTTP | 사유 |
|---|---|---|---|
| `IMPORT_ITEM_NOT_FOUND` | 404-13 | 404 | 수집 항목 없음 |
| `IMPORT_ITEM_ALREADY_HANDLED` | 409-11 | 409 | 이미 승인·거절된 항목 |
| `IMPORT_ALREADY_RUNNING` | 409-12 | 409 | 해당 원천 수집이 이미 실행 중 |

잘못된 `source`·`status` 값과 출처 누락은 기존 `INVALID_INPUT_VALUE`(400-01)를 쓴다.

---

## 8. FE

### 8.1 화면 `/admin/imports`

* 어드민 판정은 공지 화면과 같다. 신원 조회 후 로그인이 없으면 `/login`, 어드민이 아니면 `/`로 보낸다.
* 공지 화면과 서로 오가는 링크를 둔다. 전체 어드민 메뉴는 범위 밖이다.
* **상단: 원천별 상태**
  * 마지막 실행 시각·결과·새 항목 수, 실패 시 메시지.
  * 입시는 집중 기간 여부와 다음 실행 시각.
  * "지금 가져오기" 버튼. 실행 중에는 비활성화하고, 실행 중일 때만 5초마다 상태를 다시 읽는다.
* **본문: 항목 목록**
  * 탭: 새 항목(기본) / 승인됨 / 거절됨. 원천 필터. 페이지당 50건.
  * 공연 행: 썸네일, 제목, 기간, 공연장, 원문 링크. 썸네일은 KOPIS 원본 URL을 쓰고(`loading="lazy"`, `referrerPolicy="no-referrer"`), 깨지면 "이미지 없음".
  * 입시 행: 게시판 이름, 제목, 게시일, 원문 링크.
  * 원문 링크는 `isHttpUrl`을 통과할 때만 새 탭(`rel="noopener noreferrer"`)으로 그린다.
  * 승인됨 탭은 만들어진 공지로 가는 링크를 보여 준다.
* **승인·거절**
  * 승인: `NoticeForm`을 초기값과 함께 열고, 버튼 문구는 "승인하고 공지 등록". 성공하면 목록에서 빼고, `posterSaved=false`면 안내한다.
  * 거절: 한 번 확인한다. 취소하면 요청을 보내지 않는다.

### 8.2 공지 폼·공개 화면

* `NoticeForm`에 출처 이름·원문 링크 칸을 추가한다. 기존 공지 화면도 같은 폼을 쓴다.
* 공개 공지 화면에 출처와 원문 링크를 표시한다(§3.2).

### 8.3 BFF

`/api/bff/admin/imports/**` 다섯 라우트는 기존 `proxyAuthed`로 그대로 전달한다. BE에 닿지 못하면 502를 주는 기존 규칙을 따른다.

---

## 9. 설정과 환경변수

| 변수 | 뜻 |
|---|---|
| `KOPIS_SERVICE_KEY` | KOPIS 인증키. 비면 KOPIS 수집을 건너뛴다 |
| `IMPORT_CONTACT` | User-Agent에 넣는 연락처(메일 주소 또는 URL) |

`application.yml`의 `import` 아래에 KOPIS 기본 URL·장르·기간(주), 포스터 허용 호스트, 입시 집중 기간, 게시판 목록을 둔다. `docs/DEPLOY.md` 환경변수 표와 `.env.prod.example`에 두 변수를 추가한다.

---

## 10. 대학 게시판 목록

### 10.1 확인 완료 (2026-09-11)

| 코드 | 이름 | 목록 | robots | 형태 |
|---|---|---|---|---|
| `snu-admission` | 서울대학교 입학본부 | `admission.snu.ac.kr/undergraduate/notice` | 허용 | 표, UTF-8 |
| `snu-music` | 서울대학교 음악대학 | `music.snu.ac.kr/notice?sca=입학` | 허용 | 목록(`li`) |
| `yonsei-rolling` | 연세대학교 입학처(수시) | `admission.yonsei.ac.kr/seoul/admission/html/rolling/notice.asp` | robots 없음(허용) | 표, EUC-KR |
| `yonsei-regular` | 연세대학교 입학처(정시) | `…/regular/notice.asp` | robots 없음(허용) | 표, EUC-KR |
| `karts-admission` | 한국예술종합학교 입학 | `www.karts.ac.kr/cop/bbs/selectBoardList.do?bbsId=BBSMSTR_000000000007&…` | 허용(`/nri/bbs/`만 금지) | 목록(`li`) |

* 세 대학 모두 이용약관 페이지가 없고 자동수집 금지 조항이 없다.
* 한예종 저작권정책은 출처를 구체적으로 표시하라고 요구한다. 출처 필드로 충족한다.
* 서울대 입학본부는 파이썬 기본 TLS 설정으로 접속이 실패했다(curl은 정상). Java 클라이언트에서 되는지 구현 초기에 확인한다.

### 10.2 추가 조사 완료 (2026-09-11~13, 17곳)

robots 판정은 RFC 9309의 경로 접두사와 최장 일치 규칙을 적용했다. `AttaccaBot` 전용 그룹이 없으면 `User-agent: *` 그룹을 적용하고, 둘 다 없으면 허용으로 판정한다. 목록은 첫 페이지만 확인했다.

#### 설정 후보

| 코드 | 대학·게시판 | 목록 | robots (`*` / `AttaccaBot`) | 약관 | 형태·인코딩 | 글 번호 규칙 | 비고 |
|---|---|---|---|---|---|---|---|
| `hanyang-rolling` | 한양대 입학처(수시) | `go.hanyang.ac.kr/web/notice/notice_list.do?m_type=SUSI` | 허용 / 별도 그룹 없음 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `bn=(\d+)` | 음악대학 5개 학과. 음대 별도 공지판은 확인하지 못했다. |
| `hanyang-regular` | 한양대 입학처(정시) | `…/notice_list.do?m_type=JEONGSI` | 허용 / 별도 그룹 없음 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `bn=(\d+)` |  |
| `hanyang-common` | 한양대 입학처(공통) | `…/notice_list.do?m_type=COMMON` | 허용 / 별도 그룹 없음 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `bn=(\d+)` |  |
| `uos-admission` | 서울시립대 입학처 | `www.uos.ac.kr/admissionNew/noticeBoard/list.do?list_id=OB1&menuid=2002004001000000000` | 허용 / 별도 그룹 없음 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `seq=(\d+)` | 음악학과가 있다. `/noticeBoard/` 금지는 `/admissionNew/noticeBoard/`와 접두사가 달라 적용되지 않는다. |
| `cau-music` | 중앙대 음악학부 | `music.cau.ac.kr/dm/dm_1.php` | robots 404(허용) / 동일 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `view\('(\d+)'\)` | 입학처는 `* Disallow: /`라 제외한다. 학부 일반·콩쿠르 공지에서 키워드로 선별한다. |
| `khu-admission` | 경희대 입학처 | `iphak.khu.ac.kr/submenu.do?board_seq=12504&categoryid=1&menuurl=RnNfVbLHUGrJz9kJgEyRDQ%3D%3D` | 허용 / 별도 그룹 없음 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `board_seq=(\d+)` | 음악 관련 실기 공지가 실제로 올라온다. 음대 사이트는 robots 전면 금지와 TLS 오류로 제외한다. |
| `kangwon-admission` | 강원대 입학처 | `admission.kangwon.ac.kr/admission/bbs/1165/list.do` | `/admission/` 허용 / 별도 그룹 없음 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `/bbs/1165/(\d+)/view\.do` | 음악학과가 있다. |
| `gnu-rolling` | 경상국립대 입학처(수시) | `new.gnu.ac.kr/new/na/ntt/selectNttList.do?mi=2027&bbsId=1941` | 허용 / 별도 그룹 없음 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `nttSn=(\d+)` | 음악교육과가 있다. robots의 개별 금지 URL과 일치하지 않는다. |
| `gnu-regular` | 경상국립대 입학처(정시) | `…/selectNttList.do?mi=2028&bbsId=1942` | 허용 / 별도 그룹 없음 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `nttSn=(\d+)` |  |
| `pnu-music` | 부산대 음악학과 | `music.pusan.ac.kr/music/na/ntt/selectNttList.do?mi=6375&bbsId=1354` | robots 404(허용) / 동일 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `enc`를 URL·Base64 해제한 뒤 `/bbs/music/\d+/(\d+)/artclView\.do` | 음악학과 공지판. |
| `jnu-music` | 전남대 음악학과 | `music.jnu.ac.kr/music/16488/subview.do` | robots 404(허용) / 동일 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `/bbs/music/1656/(\d+)/artclView\.do` | 입학처는 `* Disallow: /`라 제외한다. |
| `jbnu-music` | 전북대 음악과 공지 | `top.jbnu.ac.kr/music/5494/subview.do` | robots 404(허용) / 동일 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `/bbs/music/643/(\d+)/artclView\.do` | 입학처는 `* Disallow: /`라 제외한다. |
| `jbnu-music-concours` | 전북대 음악과 콩쿠르 | `top.jbnu.ac.kr/music/36416/subview.do` | robots 404(허용) / 동일 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `/bbs/music/5736/(\d+)/artclView\.do` | 콩쿠르·오디션 공지를 직접 제공한다. |
| `cnu-music` | 충남대 음악과 | `music.cnu.ac.kr/` | 허용 / 별도 그룹 없음 | 자동수집 금지 없음 | 서버 HTML, UTF-8 | `articleNo=(\d+)` | 입학처는 `* Disallow: /`라 제외한다. |

위의 “자동수집 금지 없음”은 확인 가능한 홈페이지 약관·정책에서 게시판 자동수집을 명시적으로 금지한 조항을 찾지 못했다는 뜻이다. `이메일주소무단수집거부`는 게시판 크롤링 금지로 보지 않는다.

#### 제외 또는 보류

| 대학 | 음악 전공 | 입학처·음대 게시판 판단 | 제외·보류 사유 |
|---|---|---|---|
| 고려대 | 확인되지 않음 | 입학처 `oku.korea.ac.kr/oku/index.do`는 서버 HTML | 공식 학부 학과·모집단위에 음악 전공이 없어 제외한다. |
| 서강대 | 확인되지 않음 | 입학처 모집단위 자료는 서버 문서 | 공식 모집단위에 음악 전공이 없어 제외한다. |
| 성균관대 | 없음 | 예술대학은 미술·디자인·무용·영상·연기예술·의상 6개 학과 | 음악 전공이 없어 제외한다. |
| 한국외대 | 확인되지 않음 | 공식 학과 목록에서 음악 전공을 찾지 못함 | 음악 전공이 없어 제외한다. |
| 강원대 강릉원주 음악 사이트 | 있음 | `music.gwnu.ac.kr/music/2898/subview.do`, robots 허용, 서버 HTML·UTF-8 | 강원대 통합 뒤에도 별도 GWN 도메인으로 운영된다. 소속·지속 운영 여부를 구현 전에 확인한 뒤 추가한다. 상세 번호는 `enc` 해제 후 `/bbs/music/\d+/(\d+)/artclView\.do`이다. |
| 경북대 | 음악학과·국악학과 | 입학처 `ipsi1.knu.ac.kr`는 `* Disallow: /` | 허용되는 공식 음악 공지판을 확인하지 못해 제외한다. |
| 부산대 입학처 | 있음 | `go.pusan.ac.kr/college_2016/pages/index.asp?b=B_1_1&m=list`; 매칭 robots 그룹 없음(허용); `bn=(\d+)` | 브라우저에서는 서버 HTML이지만 단순 HTTP 클라이언트 응답이 비어 있었다. Java/jsoup 실제 응답을 확인하기 전에는 설정하지 않는다. |
| 제주대 | 음악학부 | 입학처는 `* Disallow: /`; 음대 HTTPS robots는 인증서 오류, HTTP robots는 `* Disallow: /` | 허용을 확인할 수 없어 보수적으로 제외한다. |
| 충북대 | 없음 | 입학처 공지는 서버 HTML·UTF-8, robots 404(허용), 상세 경로 `/BBSMSTR_[^/]+/(\d+)/view\.do` | 공식 단과대학·모집단위에 음악 전공이 없어 제외한다. |

* 구현은 10.1의 확인 완료 5개 게시판과 위 설정 후보 중 검토가 끝난 게시판만 설정에 넣는다.
* 설정 후보도 구현 시 Java HTTP 클라이언트로 목록 첫 페이지, 인코딩, 상세 링크 규칙을 한 번 더 검증한다.
* User-Agent는 `AttaccaBot/1.0 (+${IMPORT_CONTACT})` 형식으로 보내며, 운영 전에 `IMPORT_CONTACT`가 반드시 설정돼야 한다.

---

## 11. 테스트

TDD로 진행한다. **외부 네트워크를 타는 자동 테스트는 두지 않는다.** 실제 대학 페이지를 저장소에 복사하지 않고, 구조만 흉내 낸 최소 HTML·XML을 직접 만든다.

**BE**

* 엔티티: 상태 전이, 승인 시 `noticeId` 필수, 종결 상태 재처리 409-11.
* 리포지토리(`@DataJpaTest`): `(source, sourceKey)` 유일성, 상태·원천별 페이지 조회, 90일 지난 실행 기록 삭제.
* KOPIS 클라이언트(`MockRestServiceServer`): 28일씩 두 구간, 100건 미만까지 페이지 이동, 처음 보는 공연만 상세 호출, 요청 간격(대기 함수 주입), 키 없음 → `SKIPPED`, XML 매핑과 `summary` 조립, http(s)가 아닌 예매처 링크 무시.
* 게시판 파서: 표·목록 형태, EUC-KR 해석, 상대 링크 변환, 글 번호 추출(같은 글이 다른 `s_page`로 와도 같은 키), 키워드 필터, 게시일 없는 행 건너뜀.
* robots 판정: 봇 이름 그룹 우선, 긴 규칙 우선, 4xx 허용, 5xx·시간 초과 건너뜀.
* 수집 서비스: 거절 항목 미부활·`lastSeenAt` 갱신, 게시판 하나 실패 시 `PARTIAL`, 실행 기록 저장, 동시 실행 409-12.
* 스케줄 판정(시계 주입): 구간 첫날·마지막 날, 연말을 넘는 구간(12-31, 01-01), 22:00·23:00·00:00 경계.
* 승인 서비스: 출처 포함 공지 생성, 허용 목록 밖 포스터는 요청하지 않음, 이미지 아님·다운로드 실패 시 공지는 생성되고 `posterSaved=false`, 출처 이름 누락 400, 이중 승인 409-11.
* NOTICE 변경: `sourceUrl`에 `javascript:`·`data:`와 공백·대소문자 우회 거절, 링크만 있고 출처 없음 400, 공개 응답에 두 필드 포함.
* 컨트롤러: 비로그인 401, 일반 회원 403, 수동 실행 202.

**FE**

* 승인 폼 초기값 변환(공연·입시 각각).
* 화면: 탭 전환, 승인 시 초기값이 채워진 폼, 거절 확인 취소 시 요청 없음, 썸네일 실패 대체 문구, 위험 링크 미표시, 실행 중 버튼 비활성화.
* BFF: BE 연결 실패 시 502.
* `NoticeForm` 새 칸, 공개 화면의 출처 링크는 http(s)일 때만 표시.

**완료 기준:** BE `./gradlew clean build`, FE `vitest`·`tsc`·`eslint` 전부 통과.

**수동 검증:** 확인 완료 5개 게시판 실제 1회 수집, 서울대 입학본부 TLS, KOPIS 실제 호출(인증키 필요), 승인 → 홈 달력·캐러셀 노출.

---

## 12. 문서 반영 (구현 착수 전)

* 신설: `docs/DOMAIN-IMPORT-CONSTITUTION.md`, `docs/DOMAIN-IMPORT-STATUTE.md` (도메인 문서 없이 구현하지 않는다는 규칙).
* 개정: `DOMAIN-NOTICE-STATUTE.md`(필드·검증·공개 DTO), `DOMAIN-NOTICE-CONSTITUTION.md`(출처 표기 원칙 한 줄).
* 구조 변경 기록: `ARCHITECTURE-STATUTE.md` 기술 스택(`jackson-dataformat-xml`, `jsoup`, 스케줄링 도입).
* 배포: `docs/DEPLOY.md` 환경변수 표.

---

## 13. 범위 밖

* 거절 취소, 수집 항목 삭제, 새 항목 알림.
* 전체 어드민 메뉴.
* JS 렌더링 게시판 수집, 게시판 목록의 어드민 화면 관리(설정 파일로만 관리).
* KOPIS 외 공연 원천, 수집 항목을 PERFORMANCE로 반입.
* 게시글 본문·첨부 PDF 저장.

---

## 14. 착수 전 사용자 확인·조치

* **KOPIS 인증키 발급:** KOPIS 사이트에서 PC로 신청하면 이메일로 발급된다. 1인 1키이며 직접 신청해야 한다.
* **`IMPORT_CONTACT` 값:** User-Agent에 공개되는 연락처를 정해야 한다.
* **대학 17곳 확인:** §10 조사 완료. 설정 후보 중 검토가 끝난 게시판만 구현 설정에 넣는다.

미확인: KOPIS 일일 호출 한도 수치(공식 문서에 없음), KOPIS API의 https 지원, KOPIS 포스터 실제 호스트, 경희대·중앙대 게시 시기.
