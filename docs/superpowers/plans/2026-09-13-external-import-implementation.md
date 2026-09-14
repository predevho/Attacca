# External Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KOPIS 클래식 공연과 허용된 대학 게시판의 공지 후보를 수집하고, 어드민이 검토해 NOTICE로 승인하거나 거절할 수 있게 한다.

**Architecture:** `com.back.domain.imports`가 원천별 수집, 중복 제거, 실행 이력, 심사 상태를 소유하고 승인할 때만 `NoticeService`를 호출한다. KOPIS XML과 대학 서버 HTML은 공통 수집 계약 뒤에 격리하며 네트워크 호출은 트랜잭션 밖에서 수행한다. FE는 기존 BFF와 `NoticeForm`을 재사용해 `/admin/imports`에서 수집 상태와 후보 심사를 제공한다.

**Tech Stack:** Java 21, Spring Boot 3.4.x, Spring Data JPA, Spring Scheduling, RestClient, Jackson XML, jsoup, Flyway/MySQL/H2, JUnit 5/Mockito/MockMvc, Next.js 16, React 19, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-09-11-external-import-design.md`

## Global Constraints

* 도메인 규칙은 `docs/DOMAIN-IMPORT-CONSTITUTION.md`, `docs/DOMAIN-IMPORT-STATUTE.md`, `docs/DOMAIN-NOTICE-*.md`를 따른다.
* 외부 네트워크를 타는 자동 테스트와 실제 대학/KOPIS 원문 fixture를 저장소에 두지 않는다.
* 수집 후보는 자동 공개하지 않고 어드민 승인 뒤 NOTICE로만 공개한다.
* 게시판 목록은 첫 페이지만 읽으며 User-Agent는 `AttaccaBot/1.0 (+${IMPORT_CONTACT})`다.
* 설정 대상은 설계서 §10.1과 §10.2 “설정 후보”만이다. “제외 또는 보류” 표의 게시판은 넣지 않는다.
* KOPIS 인증키가 없으면 KOPIS 실제 호출 검증은 미루되 테스트 더블로 모든 계약을 검증한다.
* 구현은 각 작업에서 실패 테스트를 먼저 확인하고 최소 구현으로 통과시킨다.
* 커밋은 사용자가 요청한 경우에만 각 작업 끝의 제안 명령을 실행한다.

---

### Task 1: NOTICE 출처 계약과 DB 스키마

**Files:**
- Create: `BE/src/main/resources/db/migration/V4__external_import.sql`
- Modify: `BE/src/main/java/com/back/domain/notice/entity/Notice.java`
- Modify: `BE/src/main/java/com/back/domain/notice/dto/NoticeRequest.java`
- Modify: `BE/src/main/java/com/back/domain/notice/dto/NoticeResponse.java`
- Modify: `BE/src/main/java/com/back/domain/notice/dto/PublicNoticeResponse.java`
- Modify: `BE/src/main/java/com/back/domain/notice/service/NoticeService.java`
- Test: `BE/src/test/java/com/back/domain/notice/entity/NoticeTest.java`
- Test: `BE/src/test/java/com/back/domain/notice/service/NoticeServiceTest.java`
- Test: `BE/src/test/java/com/back/domain/notice/controller/NoticeAdminControllerTest.java`
- Test: `BE/src/test/java/com/back/domain/notice/controller/NoticePublicControllerTest.java`

**Interfaces:**
- Produces: `NoticeRequest(..., String sourceName, String sourceUrl)`, NOTICE 생성·수정 시 출처 저장, 두 응답 DTO의 `sourceName()`과 `sourceUrl()`.
- Produces: `NoticeService.create(long authorId, NoticeRequest request)`를 IMPORT 승인에서도 재사용한다.

- [ ] **Step 1: 출처 검증과 응답 직렬화 실패 테스트를 작성한다.** `sourceUrl="javascript:alert(1)"`, `sourceUrl=" HTTPS://example.com"`, URL만 있고 이름이 없는 요청은 400으로 단언하고, 정상 생성·수정·공개 응답에는 두 필드가 유지되는지 검증한다.
- [ ] **Step 2: `cd BE && ./gradlew test --tests '*Notice*Test'`를 실행해 생성자/DTO 시그니처 또는 검증 단언이 실패하는지 확인한다.**
- [ ] **Step 3: 엔티티와 DTO에 nullable `sourceName`(200), `sourceUrl`(500)을 추가한다.** 요청은 `@Pattern(regexp = "^\\s*(https?://\\S+)?\\s*$", flags = Pattern.Flag.CASE_INSENSITIVE)`를 적용하고 서비스에서 `sourceUrl`이 non-blank인데 `sourceName`이 blank면 `INVALID_INPUT_VALUE`를 던진다.
- [ ] **Step 4: `Notice.create`, `edit`, `NoticeService`, 어드민·공개 매퍼가 출처를 전달하도록 수정한다.** 외부 URL 가드는 trim한 http/https만 허용하며 `javascript:`와 `data:`는 저장하지 않는다.
- [ ] **Step 5: V4 마이그레이션에 `notice.source_name varchar(200)`, `notice.source_url varchar(500)`, `imported_item`, `import_run`을 추가한다.** `imported_item`은 `(source, source_key)` 유니크와 `status`, `created_at`, `id` 조회 인덱스를 포함한다.
- [ ] **Step 6: 같은 Notice 테스트 명령과 `./gradlew flywayMigrate -Dspring.profiles.active=test` 대신 프로젝트의 기존 Flyway 통합 테스트/전체 테스트를 실행해 H2·MySQL 호환성을 확인한다.** 별도 Flyway 테스트가 없다면 `./gradlew test`로 애플리케이션 컨텍스트와 스키마를 검증한다.
- [ ] **Step 7: 사용자 승인 시에만 `git add`로 위 파일만 올리고 `git commit -m "feat: 공지 출처 정보 지원"`을 실행한다.**

### Task 2: IMPORT 엔티티와 저장소

**Files:**
- Create: `BE/src/main/java/com/back/domain/imports/entity/ImportSource.java`
- Create: `BE/src/main/java/com/back/domain/imports/entity/ImportStatus.java`
- Create: `BE/src/main/java/com/back/domain/imports/entity/ImportTrigger.java`
- Create: `BE/src/main/java/com/back/domain/imports/entity/ImportRunResult.java`
- Create: `BE/src/main/java/com/back/domain/imports/entity/ImportedItem.java`
- Create: `BE/src/main/java/com/back/domain/imports/entity/ImportRun.java`
- Create: `BE/src/main/java/com/back/domain/imports/repository/ImportedItemRepository.java`
- Create: `BE/src/main/java/com/back/domain/imports/repository/ImportRunRepository.java`
- Test: `BE/src/test/java/com/back/domain/imports/entity/ImportedItemTest.java`
- Test: `BE/src/test/java/com/back/domain/imports/repository/ImportedItemRepositoryTest.java`
- Test: `BE/src/test/java/com/back/domain/imports/repository/ImportRunRepositoryTest.java`

**Interfaces:**
- Produces: `ImportedItem.newItem(...)`, `approve(long noticeId)`, `reject()`, `seenAt(LocalDateTime)`.
- Produces: `findBySourceAndSourceKey`, `findByIdForUpdate`, 상태·원천 필터 페이징, 원천별 최신 실행 조회, 90일 이전 실행 삭제.

- [ ] **Step 1: 엔티티 테스트에 기본 `NEW`, 허용된 두 상태 전이, 종결 상태 재전이 409-11, 승인 시 noticeId 필수, 재확인 시 상태 보존을 작성한다.**
- [ ] **Step 2: 저장소 테스트에 `(source, sourceKey)` 중복 거절, `createdAt DESC, id DESC`, 상태·원천 필터, 비관적 쓰기 잠금 조회, 최신 실행과 90일 정리를 작성한다.**
- [ ] **Step 3: `cd BE && ./gradlew test --tests 'com.back.domain.imports.*'`를 실행해 클래스 부재로 실패하는지 확인한다.**
- [ ] **Step 4: enum과 두 엔티티를 기존 `BaseEntity`, 보호 생성자, private 생성자, 정적 팩토리 패턴으로 최소 구현한다.** 모든 enum은 `EnumType.STRING`을 쓴다.
- [ ] **Step 5: Spring Data 저장소 쿼리를 구현한다.** `findByIdForUpdate`에는 `@Lock(PESSIMISTIC_WRITE)`를 사용하고 목록은 `Pageable` 정렬을 강제하지 않고 서비스가 `createdAt,id` 정렬을 전달하게 한다.
- [ ] **Step 6: Task 2 테스트와 `./gradlew test`를 실행해 통과를 확인한다.**
- [ ] **Step 7: 사용자 승인 시에만 `git commit -m "feat: 외부 반입 항목과 실행 이력 모델 추가"`를 실행한다.**

### Task 3: 공통 수집 저장 서비스와 실행 결과

**Files:**
- Create: `BE/src/main/java/com/back/domain/imports/collector/ImportCollector.java`
- Create: `BE/src/main/java/com/back/domain/imports/collector/CollectedItem.java`
- Create: `BE/src/main/java/com/back/domain/imports/service/ImportIngestionService.java`
- Create: `BE/src/main/java/com/back/domain/imports/service/ImportRunService.java`
- Modify: `BE/src/main/java/com/back/global/exception/ErrorCode.java`
- Test: `BE/src/test/java/com/back/domain/imports/service/ImportIngestionServiceTest.java`
- Test: `BE/src/test/java/com/back/domain/imports/service/ImportRunServiceTest.java`

**Interfaces:**
- Produces: `ImportCollector.source(): ImportSource`, `collect(): ImportCollectionResult`.
- Produces: `ImportIngestionService.save(ImportSource, List<CollectedItem>, LocalDateTime): int`.
- Produces: `ImportRunService.run(ImportSource, ImportTrigger)`가 원천 잠금, collector 실행, `SUCCESS/PARTIAL/FAILED/SKIPPED` 기록을 담당한다.

- [ ] **Step 1: 같은 키 신규 저장 수, 기존 항목 `lastSeenAt` 갱신, 승인·거절 상태 보존 테스트를 작성한다.**
- [ ] **Step 2: 원천 하나를 두 번 실행할 때 두 번째 요청이 `IMPORT_ALREADY_RUNNING`, collector 일부 실패가 `PARTIAL`, 키 없음 결과가 `SKIPPED`가 되는 테스트를 작성한다.**
- [ ] **Step 3: `./gradlew test --tests '*ImportIngestionServiceTest' --tests '*ImportRunServiceTest'`가 실패하는지 확인한다.**
- [ ] **Step 4: 불변 `CollectedItem`과 수집 결과 타입, 짧은 저장 트랜잭션, `ConcurrentHashMap<ImportSource, AtomicBoolean>` 기반 실행 잠금을 구현한다.** 플래그는 `finally`에서 반드시 해제하고 실행 종료 후에만 `ImportRun`을 저장한다.
- [ ] **Step 5: `IMPORT_ITEM_NOT_FOUND(404-13)`, `IMPORT_ITEM_ALREADY_HANDLED(409-11)`, `IMPORT_ALREADY_RUNNING(409-12)`을 `ErrorCode`에 추가한다.**
- [ ] **Step 6: 관련 테스트와 전체 BE 테스트를 실행한다.**
- [ ] **Step 7: 사용자 승인 시에만 `git commit -m "feat: 반입 수집 실행과 중복 저장 처리"`를 실행한다.**

### Task 4: KOPIS XML 수집기

**Files:**
- Modify: `BE/build.gradle.kts`
- Create: `BE/src/main/java/com/back/domain/imports/config/ImportProperties.java`
- Create: `BE/src/main/java/com/back/domain/imports/config/ImportClientConfig.java`
- Create: `BE/src/main/java/com/back/domain/imports/collector/KopisCollector.java`
- Create: `BE/src/main/java/com/back/domain/imports/collector/kopis/KopisListResponse.java`
- Create: `BE/src/main/java/com/back/domain/imports/collector/kopis/KopisDetailResponse.java`
- Test: `BE/src/test/java/com/back/domain/imports/collector/KopisCollectorTest.java`
- Test: `BE/src/test/resources/application-test.yml`

**Interfaces:**
- Consumes: `ImportedItemRepository.existsBySourceAndSourceKey`로 신규 공연만 상세 조회한다.
- Produces: KOPIS `ImportCollector`, 주입 가능한 `Sleeper.sleep(Duration)`.

- [ ] **Step 1: 최소 XML 문자열을 MockRestServiceServer로 응답해 두 28일 구간, `rows=100`, 페이지 종료, 신규 ID만 상세 호출, 필드 매핑을 검증한다.**
- [ ] **Step 2: 빈 `KOPIS_SERVICE_KEY`가 HTTP를 호출하지 않고 skipped 결과를 내며, 연속 요청 사이 `Sleeper`에 200ms 이상이 전달되는 테스트를 작성한다.**
- [ ] **Step 3: `./gradlew test --tests '*KopisCollectorTest'`가 XML 타입·수집기 부재로 실패하는지 확인한다.**
- [ ] **Step 4: `implementation("com.fasterxml.jackson.dataformat:jackson-dataformat-xml")`과 `@ConfigurationProperties(prefix="import")`를 추가하고 5초 연결·10초 읽기 타임아웃의 전용 RestClient를 만든다.**
- [ ] **Step 5: 목록·상세 DTO와 수집기를 구현한다.** source URL은 첫 http(s) relate URL, 없으면 KOPIS 홈을 쓰고 출처 이름은 법정 표기 문구로 고정한다.
- [ ] **Step 6: KOPIS 테스트와 전체 BE 테스트를 실행한다.** 인증키가 없으므로 실제 KOPIS smoke test는 실행하지 않았음을 실행 기록에 남긴다.
- [ ] **Step 7: 사용자 승인 시에만 `git commit -m "feat: KOPIS 클래식 공연 수집기 추가"`를 실행한다.**

### Task 5: robots 판정기와 대학 공통 파서

**Files:**
- Modify: `BE/build.gradle.kts`
- Create: `BE/src/main/java/com/back/domain/imports/collector/university/UniversityBoardProperties.java`
- Create: `BE/src/main/java/com/back/domain/imports/collector/university/RobotsPolicy.java`
- Create: `BE/src/main/java/com/back/domain/imports/collector/university/UniversityBoardParser.java`
- Create: `BE/src/main/java/com/back/domain/imports/collector/university/UniversityNoticeCollector.java`
- Test: `BE/src/test/java/com/back/domain/imports/collector/university/RobotsPolicyTest.java`
- Test: `BE/src/test/java/com/back/domain/imports/collector/university/UniversityBoardParserTest.java`
- Test: `BE/src/test/java/com/back/domain/imports/collector/university/UniversityNoticeCollectorTest.java`

**Interfaces:**
- Produces: `RobotsPolicy.evaluate(String userAgent, URI target): Decision`.
- Produces: `UniversityBoardParser.parse(UniversityBoardProperties.Board, byte[]): List<CollectedItem>`.
- Produces: 모든 설정 게시판을 장애 격리해 처리하는 `UNIV_NOTICE` collector.

- [ ] **Step 1: robots fixture로 `AttaccaBot` 우선, `*` fallback, 최장 Allow/Disallow, 404 허용, 5xx·timeout 건너뛰기를 테스트한다.**
- [ ] **Step 2: 직접 작성한 최소 `table/tr`·`ul/li` HTML로 UTF-8/EUC-KR, 상대 링크, query/path/JavaScript 글 번호, 날짜 포맷, 키워드, 고정글 중복 키를 테스트한다.**
- [ ] **Step 3: 한 게시판 실패 뒤 다음 게시판 수집과 `PARTIAL` 메시지, 호스트별 robots 1회, 같은 호스트 1초 간격을 테스트한다.**
- [ ] **Step 4: `./gradlew test --tests '*RobotsPolicyTest' --tests '*University*Test'`가 실패하는지 확인한다.**
- [ ] **Step 5: `implementation("org.jsoup:jsoup:1.23.2")`를 추가한다.** 2026-09-13 기준 jsoup 공식 최신 안정 릴리스이며, Gradle 의존성 해석 결과에서 해당 버전을 확인한다.
- [ ] **Step 6: properties, robots 파서, charset-aware jsoup 파서, 공통 collector를 최소 구현한다.** 게시일이나 글 번호를 읽지 못한 행은 로그와 실행 메시지에 이유를 남기고 건너뛴다.
- [ ] **Step 7: 관련 테스트와 전체 BE 테스트를 실행한다.**
- [ ] **Step 8: 사용자 승인 시에만 `git commit -m "feat: 대학 공지 공통 수집기 추가"`를 실행한다.**

### Task 6: 검증된 대학 게시판 설정

**Files:**
- Modify: `BE/src/main/resources/application.yml`
- Modify: `BE/src/test/resources/application-test.yml`
- Modify: `.env.prod.example`
- Test: `BE/src/test/java/com/back/domain/imports/config/UniversityBoardPropertiesTest.java`

**Interfaces:**
- Consumes: Task 5의 `UniversityBoardProperties.Board` 필드 전부.
- Produces: 설계서 §10.1의 5개와 §10.2 설정 후보. 보류된 강릉원주 음악·부산대 입학처 및 제외 대학은 생성하지 않는다.

- [ ] **Step 1: 설정 바인딩 테스트에 코드 유일성, 필수 선택자·날짜 형식·글 번호 패턴, 허용된 코드 목록을 단언한다.** 금지 목록에는 `pnu-admission`, `gwnu-music`, 제주·경북 입학처 코드를 명시해 실수로 설정되지 않게 한다.
- [ ] **Step 2: `./gradlew test --tests '*UniversityBoardPropertiesTest'`가 설정 부재로 실패하는지 확인한다.**
- [ ] **Step 3: 각 후보의 목록 첫 페이지를 식별 User-Agent와 간격을 지켜 한 번씩 Java smoke probe로 확인한다.** 서버 HTML, charset, row/title/link/date selector, 상세 번호 패턴이 설계서 §10과 다르면 코드를 넣기 전에 설계서를 먼저 갱신한다.
- [ ] **Step 4: 확인된 값만 `application.yml`의 `import.university.boards`에 추가한다.** §10.1의 `snu-admission`, `snu-music`, `yonsei-rolling`, `yonsei-regular`, `karts-admission`부터 넣고, §10.2 후보는 probe를 통과한 행만 같은 변경에 포함한다.
- [ ] **Step 5: `.env.prod.example`에 빈 `KOPIS_SERVICE_KEY`, `IMPORT_CONTACT`를 추가하고 실제 값은 넣지 않는다.**
- [ ] **Step 6: 설정 테스트와 전체 BE 테스트를 실행하고 probe 성공·제외 목록을 작업 로그에 남긴다.**
- [ ] **Step 7: 사용자 승인 시에만 `git commit -m "config: 검증된 대학 공지 게시판 등록"`을 실행한다.**

### Task 7: 스케줄과 수동 실행 API

**Files:**
- Create: `BE/src/main/java/com/back/domain/imports/config/ImportSchedulingConfig.java`
- Create: `BE/src/main/java/com/back/domain/imports/service/ImportScheduleService.java`
- Create: `BE/src/main/java/com/back/domain/imports/controller/ImportAdminController.java`
- Create: `BE/src/main/java/com/back/domain/imports/dto/ImportRunResponse.java`
- Create: `BE/src/main/java/com/back/domain/imports/dto/ImportRunStatusResponse.java`
- Test: `BE/src/test/java/com/back/domain/imports/service/ImportScheduleServiceTest.java`
- Test: `BE/src/test/java/com/back/domain/imports/controller/ImportAdminControllerTest.java`
- Test: `BE/src/test/java/com/back/global/security/SecurityConfigTest.java`

**Interfaces:**
- Produces: 월요일 05:00 KOPIS, 07:00~23:00 정각 대학 스케줄.
- Produces: `POST /api/admin/imports/runs?source=...` 202와 `GET /api/admin/imports/runs/latest`.

- [ ] **Step 1: Clock을 주입해 집중 기간 경계, `12-26~01-31` 연도 경계, 기간 밖 무실행, 수동 실행은 항상 허용을 테스트한다.**
- [ ] **Step 2: MockMvc로 미인증 401, 비어드민 403, 어드민 202, 잘못된 source 400, 중복 실행 409-12, 최신 상태 응답을 테스트한다.**
- [ ] **Step 3: 관련 테스트가 실패하는지 확인한다.**
- [ ] **Step 4: `@EnableScheduling`, `zone="Asia/Seoul"` cron, 집중 기간 값 객체, 기존 async executor를 확인한 백그라운드 실행을 구현한다.** executor가 없다면 이름 있는 단일 `TaskExecutor` bean을 IMPORT 전용으로 추가한다.
- [ ] **Step 5: 컨트롤러와 상태 DTO를 구현하고 `/api/admin/**` 기존 보안 계약을 유지한다.**
- [ ] **Step 6: 관련 테스트와 전체 BE 테스트를 실행한다.**
- [ ] **Step 7: 사용자 승인 시에만 `git commit -m "feat: 외부 반입 스케줄과 수동 실행 API 추가"`를 실행한다.**

### Task 8: 승인·거절과 포스터 저장

**Files:**
- Modify: `BE/src/main/java/com/back/global/storage/FileService.java`
- Create: `BE/src/main/java/com/back/domain/imports/service/PosterDownloader.java`
- Create: `BE/src/main/java/com/back/domain/imports/service/ImportReviewService.java`
- Create: `BE/src/main/java/com/back/domain/imports/dto/ImportApproveRequest.java`
- Create: `BE/src/main/java/com/back/domain/imports/dto/ImportApproveResponse.java`
- Modify: `BE/src/main/java/com/back/domain/imports/controller/ImportAdminController.java`
- Test: `BE/src/test/java/com/back/global/storage/FileServiceTest.java`
- Test: `BE/src/test/java/com/back/domain/imports/service/PosterDownloaderTest.java`
- Test: `BE/src/test/java/com/back/domain/imports/service/ImportReviewServiceTest.java`
- Test: `BE/src/test/java/com/back/domain/imports/controller/ImportAdminControllerTest.java`

**Interfaces:**
- Produces: `FileService.upload(byte[] content, String contentType, String originalName, String directory, long uploaderId)`.
- Produces: approve 201 `{noticeId, posterSaved}`, reject 200.

- [ ] **Step 1: 바이트 업로드 메타데이터·저장 실패 정리 테스트와 포스터 허용 호스트, redirect 후 호스트 재검증, `image/*`, 10MB 제한 테스트를 작성한다.**
- [ ] **Step 2: 승인 쓰기 잠금, 동시 두 승인 중 하나만 성공, NOTICE 출처 전달, 포스터 실패 시 승인 성공, 거절과 종결 상태 오류 테스트를 작성한다.**
- [ ] **Step 3: 관련 테스트가 실패하는지 확인한다.**
- [ ] **Step 4: 바이트 업로드와 redirect를 제한한 `PosterDownloader`를 구현한다.** DNS/IP 우회 방지를 위해 각 연결의 최종 URI 호스트를 allowlist와 다시 대조하고, 응답 스트림은 10MB+1에서 중단한다.
- [ ] **Step 5: 다운로드는 트랜잭션 밖, 잠금·NOTICE 생성·상태 전이는 트랜잭션 안인 승인 서비스를 구현한다.** 포스터 저장 실패는 `posterSaved=false`로 흡수한다.
- [ ] **Step 6: 승인·거절 컨트롤러를 연결하고 관련 테스트와 전체 BE 테스트를 실행한다.**
- [ ] **Step 7: 사용자 승인 시에만 `git commit -m "feat: 반입 후보 승인과 포스터 저장 지원"`을 실행한다.**

### Task 9: IMPORT 목록 API와 FE 타입·BFF

**Files:**
- Create: `BE/src/main/java/com/back/domain/imports/dto/ImportedItemResponse.java`
- Modify: `BE/src/main/java/com/back/domain/imports/controller/ImportAdminController.java`
- Create: `FE/lib/imports/types.ts`
- Create: `FE/lib/imports/logic.ts`
- Create: `FE/app/api/bff/admin/imports/route.ts`
- Create: `FE/app/api/bff/admin/imports/runs/route.ts`
- Create: `FE/app/api/bff/admin/imports/runs/latest/route.ts`
- Create: `FE/app/api/bff/admin/imports/[id]/approve/route.ts`
- Create: `FE/app/api/bff/admin/imports/[id]/reject/route.ts`
- Test: `BE/src/test/java/com/back/domain/imports/controller/ImportAdminControllerTest.java`
- Test: `FE/__tests__/import-logic.test.ts`
- Test: `FE/__tests__/bff-admin-imports.test.ts`

**Interfaces:**
- Produces: 필터·페이지가 적용된 `GET /api/admin/imports`와 동일 계약의 BFF 다섯 경로.
- Produces: KOPIS/대학 폼 초기값을 만드는 `toNoticeInitial(item): NoticeFormValues`.

- [ ] **Step 1: BE 목록의 기본 `status=NEW`, source 필터, 50건 상한, createdAt/id 정렬과 응답 필드를 테스트한다.**
- [ ] **Step 2: FE 로직 테스트에 KOPIS `EVENT`, 대학 `NOTICE`, 빈 scheduledAt, false pinned, 대학 안내 본문, 출처·링크 초기값을 작성한다.**
- [ ] **Step 3: BFF 테스트에 query 전달과 GET/POST body·상태 전달, BE 연결 실패 502를 작성한다.**
- [ ] **Step 4: BE와 FE 대상 테스트를 실행해 실패를 확인한다.**
- [ ] **Step 5: 목록 DTO·컨트롤러, TS 타입·순수 변환 함수, `proxyAuthed` 기반 BFF 라우트를 구현한다.**
- [ ] **Step 6: `cd BE && ./gradlew test --tests '*ImportAdminControllerTest'`와 `cd FE && npm test -- --run __tests__/import-logic.test.ts __tests__/bff-admin-imports.test.ts`를 실행한다.**
- [ ] **Step 7: 사용자 승인 시에만 `git commit -m "feat: 반입 목록 API와 BFF 추가"`를 실행한다.**

### Task 10: 공지 폼과 공개 출처 UI

**Files:**
- Modify: `FE/lib/notice/types.ts`
- Modify: `FE/lib/notice/logic.ts`
- Modify: `FE/components/notice/NoticeForm.tsx`
- Modify: `FE/app/admin/notices/page.tsx`
- Create: `FE/app/notices/[id]/page.tsx`
- Create: `FE/app/api/bff/public/notices/[id]/route.ts`
- Modify: `FE/lib/home/types.ts`
- Modify: `FE/lib/home/logic.ts`
- Test: `FE/__tests__/notice-logic.test.ts`
- Test: `FE/__tests__/admin-notices-page.test.tsx` 또는 기존 공지 페이지 테스트 파일
- Create: `FE/__tests__/public-notice-page.test.tsx`
- Create: `FE/__tests__/bff-public-notice.test.ts`

**Interfaces:**
- Consumes: BE NOTICE 응답의 `sourceName`, `sourceUrl`.
- Produces: 기존 등록·수정과 IMPORT 승인이 공유하는 출처 입력 필드와 안전한 공개 원문 링크.

- [ ] **Step 1: 폼 변환·검증 테스트에 200/500자 제한, 링크만 있는 상태 오류, http(s) 이외 URL 오류, 편집 왕복을 추가한다.**
- [ ] **Step 2: 컴포넌트 테스트에 출처 두 입력과 오류 표시를 추가하고, 공개 상세 페이지가 `isHttpUrl` 통과 링크만 `target="_blank" rel="noopener noreferrer"`로 렌더링하는 단언을 작성한다.** 공개 단건 BFF가 `/api/public/notices/{id}`를 전달하는 테스트도 작성한다.
- [ ] **Step 3: 대상 Vitest를 실행해 타입 또는 UI 단언이 실패하는지 확인한다.**
- [ ] **Step 4: Notice 타입·변환·검증·공유 폼을 수정하고 `FE/app/notices/[id]/page.tsx`에 제목·본문·일정·장소와 `출처: {sourceName}`·`원문 보기`를 추가한다.** 홈 캐러셀의 NOTICE 링크는 `/notices/{id}`로 연결한다. 링크가 없으면 출처 텍스트만, 출처도 없으면 블록 전체를 숨긴다.
- [ ] **Step 5: 대상 테스트, `npm run lint`, `npm run build`를 실행한다.**
- [ ] **Step 6: 사용자 승인 시에만 `git commit -m "feat: 공지 출처 입력과 공개 표시 추가"`를 실행한다.**

### Task 11: 어드민 IMPORT 심사 화면

**Files:**
- Create: `FE/app/admin/imports/page.tsx`
- Create: `FE/components/imports/ImportSourceStatus.tsx`
- Create: `FE/components/imports/ImportItemList.tsx`
- Create: `FE/components/imports/ImportReviewDialog.tsx`
- Modify: `FE/app/admin/notices/page.tsx`
- Test: `FE/__tests__/admin-imports-page.test.tsx`

**Interfaces:**
- Consumes: Task 9 BFF와 `toNoticeInitial`, Task 10 `NoticeForm`.
- Produces: 실행 상태, NEW/APPROVED/REJECTED 탭, source 필터, 승인·거절 사용자 흐름.

- [ ] **Step 1: 미로그인 `/login`, 비어드민 `/`, 상태·목록 초기 조회, 탭·필터·페이지 이동 테스트를 작성한다.**
- [ ] **Step 2: 실행 중에만 5초 polling, 실행 버튼 비활성화, 수동 실행 202, 오류 메시지 테스트를 작성한다.**
- [ ] **Step 3: KOPIS lazy/no-referrer 이미지와 fallback, 안전한 원문 링크, 승인 폼 초기값·제출·posterSaved 안내, 거절 확인 취소/확정 테스트를 작성한다.**
- [ ] **Step 4: 대상 Vitest를 실행해 페이지 부재로 실패하는지 확인한다.**
- [ ] **Step 5: 페이지와 세 컴포넌트를 구현한다.** 공지 관리 화면과 양방향 텍스트 링크를 두고, 승인 성공 항목은 현재 탭에서 제거한다.
- [ ] **Step 6: 대상 테스트, 전체 `npm test`, `npm run lint`, `npm run build`를 실행한다.**
- [ ] **Step 7: 사용자 승인 시에만 `git commit -m "feat: 외부 반입 심사 화면 추가"`를 실행한다.**

### Task 12: 통합 검증과 운영 문서 동기화

**Files:**
- Modify: `docs/TODO-DOING.md`
- Modify: `docs/TODO-DONE.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/AI-ACTION-LOGS.md`
- Modify: `docs/DEPLOY.md` (실제 검증 결과가 기존 내용과 다를 때만)
- Modify: `docs/DOMAIN-IMPORT-STATUTE.md` (구현 중 확정된 시그니처가 다를 때만)

**Interfaces:**
- Consumes: Task 1~11 전체 사용자 흐름.
- Produces: 재현 가능한 검증 결과와 docs 정본의 최종 상태.

- [ ] **Step 1: `cd BE && ./gradlew test`를 실행해 실패 0건을 확인한다.**
- [ ] **Step 2: `cd FE && npm test`와 `npm run lint`를 실행해 실패 0건을 확인한다.**
- [ ] **Step 3: `cd FE && npm run build`를 실행해 production build를 확인한다.**
- [ ] **Step 4: KOPIS 키 없이 애플리케이션을 실행해 KOPIS `SKIPPED`, 대학 수동 실행 202, 상태 조회, NEW 목록, 승인·거절 흐름을 로컬에서 smoke test한다.** 외부 게시판은 목록 첫 페이지만 요청하고 서버 로그에서 User-Agent와 간격을 확인한다.
- [ ] **Step 5: `git diff --check`와 `git status --short`로 whitespace 오류와 의도하지 않은 파일 변경을 확인한다.** `cspell.json`, `resource/`는 계속 제외한다.
- [ ] **Step 6: 실제 KOPIS 키·https·포스터 호스트 검증이 남아 있으면 완료로 숨기지 않고 TODO-DOING에 명시한다.** `IMPORT_CONTACT`가 없으면 대학 운영 수집 활성화도 같은 방식으로 남긴다.
- [ ] **Step 7: 구현과 검증 사실을 docs에 먼저 반영한 뒤 노션 TODO 항목을 같은 상태로 맞춘다.** 커넥터를 사용할 수 없으면 docs만 갱신하고 보고한다.
- [ ] **Step 8: 사용자 요청이 있을 때만 문서·BE·FE 변경을 관심사별로 stage하고 한글 커밋을 만든다.**
