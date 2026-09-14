# DOMAIN-IMPORT-STATUTE

외부 공연·입시 공지 후보 반입 도메인 구현 규칙.

> 작성일: 2026-09-13. 승인된 설계 `docs/superpowers/specs/2026-09-11-external-import-design.md`를 정본 규칙으로 옮겼다.

---

## 1. 패키지와 의존 방향

Java 예약어 `import`를 피해서 패키지는 `com.back.domain.imports`를 쓴다.

```
com.back.domain.imports
├── controller
├── service
├── repository
├── entity
├── dto
├── collector
└── config
```

* 원천별 수집기는 공통 `ImportCollector` 계약을 구현한다.
* 네트워크 호출은 트랜잭션 밖에서 끝내고, 수집 결과 저장만 트랜잭션 안에서 처리한다.
* 승인 흐름에서만 IMPORT 서비스가 NOTICE 서비스를 호출한다. NOTICE에서 IMPORT로의 의존은 금지한다.

---

## 2. 엔티티

### 2.1 ImportedItem

`BaseEntity`를 상속하며 soft delete를 두지 않는다. 거절도 이력으로 남긴다.

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | Long | PK |
| `source` | ImportSource | `KOPIS` / `UNIV_NOTICE`, STRING |
| `sourceKey` | String | KOPIS `mt20id`, 대학 `{게시판코드}:{글번호}`, non-null, ≤200 |
| `sourceName` | String | 공개 출처 표기, non-null, ≤200 |
| `sourceUrl` | String | http(s) 원문 링크, nullable, ≤500 |
| `title` | String | non-null, ≤200 |
| `startsAt` / `endsAt` | LocalDate | 공연 기간, 대학 공지는 null |
| `postedAt` | LocalDate | 대학 게시일, KOPIS는 null |
| `place` | String | 공연장, nullable, ≤200 |
| `summary` | String | 공연 심사용 요약, nullable, ≤2000 |
| `posterUrl` | String | KOPIS 원본 포스터 URL, nullable, ≤500 |
| `status` | ImportStatus | `NEW` / `APPROVED` / `REJECTED`, STRING |
| `noticeId` | Long | `APPROVED`일 때만 non-null |
| `lastSeenAt` | LocalDateTime | 원천에서 마지막으로 확인한 시각 |

* `(source, sourceKey)` 유니크 제약을 둔다.
* 상태 전이는 `NEW → APPROVED(noticeId)` 또는 `NEW → REJECTED`만 허용한다.
* 종결 상태를 다시 처리하면 `IMPORT_ITEM_ALREADY_HANDLED`를 던진다.
* 재수집된 키는 상태와 무관하게 새 행을 만들지 않고 `lastSeenAt`만 갱신한다.
* 목록은 `createdAt DESC, id DESC`로 정렬한다.

### 2.2 ImportRun

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | Long | PK |
| `source` | ImportSource | `KOPIS` / `UNIV_NOTICE`, STRING |
| `trigger` | ImportTrigger | `SCHEDULED` / `MANUAL`, STRING |
| `startedAt` / `finishedAt` | LocalDateTime | non-null |
| `result` | ImportRunResult | `SUCCESS` / `PARTIAL` / `FAILED` / `SKIPPED`, STRING |
| `newCount` | int | 새 항목 수 |
| `message` | String | 실패 원천과 사유 요약, nullable, ≤1000 |

* 실행 중 상태는 원천별 메모리 플래그로 관리하고, 실행이 끝날 때 `ImportRun`을 한 번 저장한다.
* KOPIS 키가 없거나 모든 대학 게시판이 robots로 막히면 `SKIPPED`다.
* 90일이 지난 실행 기록은 KOPIS 주간 실행 때 삭제한다.

---

## 3. KOPIS 수집

* Spring `RestClient`를 사용하고 연결 5초, 읽기 10초 타임아웃을 둔다.
* XML은 `jackson-dataformat-xml`로 파싱한다.
* 목록 `/openApi/restful/pblprfr`를 `shcate=CCCA`, `rows=100`으로 호출한다.
* 오늘부터 56일을 28일씩 두 구간으로 나누고, 각 구간은 100건 미만 페이지가 나올 때까지 조회한다.
* 상세 `/openApi/restful/pblprfr/{mt20id}`는 처음 보는 공연에 대해서만 호출한다.
* 요청 사이를 200ms 이상 띄운다. 대기 함수는 주입 가능하게 만들어 테스트에서는 실제로 기다리지 않는다.
* `KOPIS_SERVICE_KEY`가 비어 있으면 외부 요청 없이 `SKIPPED` 실행 기록을 남긴다.
* 기본 URL은 설정값이다. 실제 인증키를 받은 뒤 https 지원과 포스터 호스트를 검증한다.

매핑은 다음과 같다.

| ImportedItem | KOPIS |
|---|---|
| `sourceKey` | `mt20id` |
| `title` | `prfnm` |
| `startsAt` / `endsAt` | `prfpdfrom` / `prfpdto` |
| `place` | `fcltynm` |
| `summary` | `prfcast`, `pcseguidance`, `dtguidance`, `prfruntime`를 줄 단위로 결합 |
| `posterUrl` | `poster` |
| `sourceUrl` | `relates`의 첫 http(s) `relateurl`, 없으면 `https://www.kopis.or.kr` |
| `sourceName` | `(재)예술경영지원센터 공연예술통합전산망(www.kopis.or.kr)` |

---

## 4. 대학 게시판 수집

* 대학별 클래스를 만들지 않고 게시판 설정과 jsoup 기반 공통 수집기 하나를 둔다.
* 게시판 설정은 `code`, `name`, `listUrl`, `charset`, CSS 선택자 4종, `dateFormat`, `postIdPattern`, `keywords`를 가진다.
* 목록 첫 페이지만 읽고, 상대 링크는 `listUrl` 기준 절대 URL로 바꾼다.
* 상세 링크에서 글 번호를 추출하여 `{code}:{글번호}`를 `sourceKey`로 쓴다. 번호를 추출하지 못하거나 게시일을 파싱하지 못한 행은 건너뛴다.
* 기본 키워드는 `음악, 실기, 곡목, 악보, 예능, 예체능, 모집요강, 수시, 정시`다. 이미 입학 분류인 게시판은 키워드를 비울 수 있다.
* User-Agent는 `AttaccaBot/1.0 (+${IMPORT_CONTACT})`다. 운영 환경에서 `IMPORT_CONTACT`는 필수다.
* 연결 5초, 읽기 10초 타임아웃을 적용하고 같은 호스트 요청 사이를 1초 이상 띄운다.
* 설정에는 설계서 §10의 확인 완료 게시판과 사용자 검토를 마친 설정 후보만 넣는다. 보류·제외 게시판은 넣지 않는다.

### 4.1 robots.txt

* 실행마다 호스트별로 한 번만 조회한다.
* `AttaccaBot` 그룹이 있으면 해당 규칙을, 없으면 `*` 그룹을 적용한다.
* Allow와 Disallow가 겹치면 요청 경로에 가장 길게 일치하는 규칙이 이긴다.
* 4xx는 허용으로, 5xx·시간 초과·판정 불가는 해당 호스트 건너뛰기로 처리한다.
* 금지된 게시판은 요청하지 않고 실행 기록 `message`에 남긴다.

### 4.2 장애 격리

게시판 하나가 실패해도 다음 게시판을 계속 처리한다. 일부만 실패하면 `PARTIAL`, 모두 실패하면 `FAILED`이며 KOPIS 실행과 서로 영향을 주지 않는다.

---

## 5. 스케줄과 중복 실행 방지

* 스케줄 시간대는 `Asia/Seoul`로 고정한다.
* KOPIS는 매주 월요일 05:00에 실행한다.
* 대학 공지는 매일 07:00~23:00 매시 정각에 깨어나며, 아래 집중 기간 안에서만 자동 수집한다. 수동 실행은 기간과 무관하다.
  * `03-25~04-10`, `05-25~06-05`, `07-01~09-20`, `11-01~11-30`, `12-26~01-31`
  * 기간은 매년 반복하고 연말을 넘는 구간을 지원한다.
* 원천별 메모리 플래그를 수동·스케줄 실행이 함께 사용한다. 이미 실행 중이면 `IMPORT_ALREADY_RUNNING`을 반환한다.
* 수동 실행 API는 작업을 백그라운드에 넘기고 즉시 202를 반환한다.
* 서버 한 대를 전제로 하며 분산 잠금은 두지 않는다.

---

## 6. 승인과 거절

* 승인 API는 어드민이 편집한 NOTICE 등록 요청과 함께 호출한다.
* KOPIS 포스터 다운로드는 트랜잭션 밖에서 시도한다.
* 트랜잭션 안에서 항목을 쓰기 잠금으로 조회하고 `NEW`를 확인한 뒤 NOTICE를 생성하고 `APPROVED(noticeId)`로 바꾼다.
* 승인 요청의 `sourceName`은 필수다. 없으면 `INVALID_INPUT_VALUE`다.
* 포스터 실패는 승인을 실패시키지 않고 응답의 `posterSaved=false`로 알린다.
* 거절은 `NEW → REJECTED`이며 되돌리지 않는다.

### 6.1 승인 폼 초기값

* KOPIS는 `EVENT`, 대학 공지는 `NOTICE`로 시작한다.
* KOPIS의 제목·장소·요약과 대학 공지의 제목·안내 문구를 채우되, `scheduledAt`은 추측하지 않고 비워 둔다.
* `pinned`는 false다.
* 출처 이름과 원문 링크는 수집 항목 값으로 채운다.

### 6.2 KOPIS 포스터

* URL 호스트를 설정 허용 목록으로 제한한다. 기본값은 `www.kopis.or.kr`, `kopis.or.kr`다.
* `image/*`만 허용하고 10MB를 초과하면 저장하지 않는다.
* `FileService`의 바이트 입력 업로드를 사용하며 공지 커버와 같은 디렉터리에 저장한다.

---

## 7. API와 오류

모든 경로는 `/api/admin/**` 아래에 두고 `ROLE_ADMIN`만 허용한다.

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/admin/imports?status=NEW&source=&page=&size=` | `Page<ImportedItemResponse>` |
| GET | `/api/admin/imports/runs/latest` | 원천별 마지막 실행, 실행 중 여부, 입시 집중 기간 여부·다음 실행 시각 |
| POST | `/api/admin/imports/runs?source=KOPIS\|UNIV_NOTICE` | 202 |
| POST | `/api/admin/imports/{id}/approve` | 201 `{ noticeId, posterSaved }` |
| POST | `/api/admin/imports/{id}/reject` | 200 |

| 코드 | resultCode | HTTP | 사유 |
|---|---|---|---|
| `IMPORT_ITEM_NOT_FOUND` | 404-13 | 404 | 수집 항목 없음 |
| `IMPORT_ITEM_ALREADY_HANDLED` | 409-11 | 409 | 이미 승인·거절된 항목 |
| `IMPORT_ALREADY_RUNNING` | 409-12 | 409 | 해당 원천 수집이 이미 실행 중 |

잘못된 enum 값과 승인 출처 누락은 `INVALID_INPUT_VALUE`(400-01)를 사용한다.

---

## 8. 스키마와 설정

* 새 Flyway 마이그레이션 하나로 NOTICE 출처 컬럼 두 개와 `imported_item`, `import_run` 테이블을 추가한다.
* `application.yml`의 `import` 아래에 KOPIS 기본 URL·장르·기간, 포스터 허용 호스트, 입시 집중 기간, 게시판 목록을 둔다.
* 비밀값·운영값은 `KOPIS_SERVICE_KEY`, `IMPORT_CONTACT` 환경변수로 주입한다.

---

## 9. 테스트

* 자동 테스트는 외부 네트워크를 사용하지 않는다. 저장소에는 실제 대학 HTML·KOPIS 응답을 복사하지 않고 구조만 재현한 최소 fixture를 둔다.
* 엔티티 상태 전이, 유니크 재수집, 실행 결과와 90일 정리를 검증한다.
* KOPIS XML 페이지·상세 매핑, 28일 구간, 페이지 종료, 신규 항목만 상세 조회, 요청 간격을 검증한다.
* 대학 표·목록 선택자, EUC-KR, 상대 URL, 글 번호 추출, 키워드·날짜 실패 건너뛰기를 검증한다.
* robots의 전용 그룹 우선, 최장 일치, 4xx 허용, 5xx 건너뛰기를 검증한다.
* 게시판 장애 격리와 `PARTIAL`, 원천별 중복 실행 방지를 검증한다.
* 승인 동시성, NOTICE 생성·출처 전달, 포스터 SSRF·크기·형식 제한과 실패 허용을 검증한다.
* 어드민 API 권한, 페이징, 필터, 202 수동 실행, 승인·거절 오류 응답을 검증한다.
