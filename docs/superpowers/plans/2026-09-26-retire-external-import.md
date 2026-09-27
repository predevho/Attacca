# 외부 반입 기능 종료 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KOPIS 공연과 대학 공지 외부 반입을 코드·API·운영 설정에서 제거하고 기존 운영 DB 이력은 보존한다.

**Architecture:** IMPORT 도메인과 관리자 반입 경로를 제거한다. 기존 `import_run`, `imported_item` 테이블과 V4/V8 Flyway 이력은 수정하지 않고, 애플리케이션이 해당 테이블을 읽거나 쓰는 코드만 제거한다.

**Tech Stack:** Spring Boot, JPA/Flyway, Next.js App Router, Vitest, Gradle, Docker Compose

**Spec:** `docs/superpowers/specs/2026-09-26-retire-external-import-design.md`

## Global Constraints

* 운영 DB 테이블과 과거 Flyway 이력은 삭제·수정하지 않는다.
* NOTICE, 인증 심사, 채팅 등 IMPORT 외 도메인은 변경하지 않는다.
* `.env.prod` 비밀 값은 Git에 추가하지 않는다.
* 완료 전 BE 전체 테스트와 FE 테스트·타입 검사·lint·build를 통과시킨다.

## Review Focus

* `/admin/imports` 및 `/api/bff/admin/imports/**`가 재노출되지 않는다.
* 관리자 허브의 공지 관리와 인증 심사는 그대로 접근 가능하다.
* IMPORT 환경변수 없이도 BE가 기동한다.
* XML·HTML 파서 의존성 삭제가 다른 기능을 깨지 않는다.
* EC2 환경변수 정리 후에도 Compose와 BE health check가 정상이다.

---

### Task 1: 관리자 화면과 BFF 경로 제거

**Files:**
* Delete: `FE/app/admin/imports/page.tsx`
* Delete: `FE/components/imports/ImportReviewDialog.tsx`
* Delete: `FE/components/imports/ImportSourceStatus.tsx`
* Delete: `FE/lib/imports/logic.ts`
* Delete: `FE/lib/imports/types.ts`
* Delete: `FE/app/api/bff/admin/imports/**`
* Delete: `FE/__tests__/admin-imports-page.test.tsx` 및 IMPORT BFF 계약 테스트
* Modify: `FE/app/admin/page.tsx`와 관리자 허브 테스트

**Interfaces:** `/admin`은 공지 관리와 인증 심사만 제공한다. `/admin/imports`와 IMPORT BFF 경로는 제거한다. 공지 상세 화면의 URL 검증은 공용 `@/lib/url`을 사용하며 `lib/imports` 모듈은 남기지 않는다.

- [x] **Step 1: 외부 반입 링크 부재를 기대하는 관리자 허브 테스트를 작성한다.**

```ts
expect(screen.queryByRole('link', { name: /외부 반입/i })).not.toBeInTheDocument();
expect(screen.getByRole('link', { name: /공지 관리/i })).toBeInTheDocument();
```

- [x] **Step 2: 테스트가 기존 링크 때문에 실패하는지 확인한다.**

Run: `cd FE && npm test -- --run <admin-hub-test-file>`

- [x] **Step 3: 관리자 허브 링크·반입 화면·BFF 라우트·전용 테스트와 로직을 삭제한다.**

- [x] **Step 4: 참조와 프런트 검증을 실행한다.**

Run: `rg -n 'admin/imports|lib/imports|components/imports' FE/app FE/components FE/lib FE/__tests__ && cd FE && npm test -- --run && npm run typecheck`

Expected: generated build 산출물 외 참조 없음, 테스트와 타입 검사 통과.

### Task 2: 백엔드 IMPORT 도메인과 수집 API 제거

**Files:**
* Delete: `BE/src/main/java/com/back/domain/imports/**`
* Delete: `BE/src/test/java/com/back/domain/imports/**`
* Modify: `BE/src/main/java/com/back/global/exception/ErrorCode.java`

**Interfaces:** `/api/admin/imports/**`, KOPIS·대학 공지 수집과 예약 실행은 제거한다. 기존 NOTICE API와 DB의 반입 이력 테이블은 유지한다.

- [x] **Step 1: IMPORT 오류 코드와 도메인 참조를 정적 검사로 목록화한다.**

Run: `rg -n 'domain\.imports|IMPORT_' BE/src/main BE/src/test`

- [x] **Step 2: IMPORT 패키지·전용 테스트·`ErrorCode`의 IMPORT 항목을 삭제한다.**

- [x] **Step 3: 잔여 IMPORT 참조가 없는지 확인하고 BE 전체 테스트를 실행한다.**

Run: `rg -n 'domain\.imports|IMPORT_' BE/src/main BE/src/test && cd BE && ./gradlew test`

Expected: 참조 없음, 전체 테스트 통과.

### Task 3: 의존성과 배포 설정 제거

**Files:**
* Modify: `BE/build.gradle.kts`
* Modify: `BE/src/main/resources/application.yaml`
* Modify: `docker-compose.prod.yml`
* Modify: `.env.prod.example`

**Interfaces:** `jackson-dataformat-xml`, `jsoup`, `KOPIS_SERVICE_KEY`, `IMPORT_CONTACT`, `import.*` 설정을 제거한다. 다른 기능의 Spring Scheduling 설정은 유지한다.

- [x] **Step 1: XML·HTML 파서 의존성이 IMPORT 외 코드에서 쓰이지 않는지 확인한다.**

Run: `rg -n 'XmlMapper|jackson\.dataformat\.xml|org\.jsoup' BE/src`

- [x] **Step 2: IMPORT 전용 Gradle 의존성, YAML 설정, Compose 환경변수와 예제 값을 제거한다.**

- [x] **Step 3: Compose와 BE 전체 테스트를 검증한다.**

Run: `docker compose --env-file .env.prod.example -f docker-compose.prod.yml config && cd BE && ./gradlew test`

Expected: KOPIS·IMPORT 설정 없이 구성과 테스트 통과.

### Task 4: 문서와 상태 전환

**Files:**
* Modify: `docs/TODO-DOING.md`
* Modify: `docs/TODO-DONE.md`
* Modify: `docs/TODO-BACKLOG.md`
* Modify: `docs/ARCHITECTURE-STATUTE.md`
* Modify: `docs/AI-ACTION-LOGS.md`
* Modify: `docs/AI-MAJOR-EVENT.md`
* Modify: `docs/AI-MAJOR-EVENT-RECAP.md`

**Interfaces:** 과거 설계와 장애 문서는 보존하고, 현재 제품에 외부 반입이 없다는 결정을 정본 문서에 반영한다.

- [x] **Step 1: TODO-DOING과 BACKLOG의 외부 반입 작업을 종료 처리한다.**

- [x] **Step 2: 아키텍처·주요 사건 문서에 종료 이유, DB 이력 보존, 재도입 시 별도 설계 필요 원칙을 기록한다.**

- [x] **Step 3: 활성 기능으로 잘못 표현된 외부 반입 문서가 없는지 확인한다.**

Run: `rg -n '외부 반입|KOPIS|대학 공지|IMPORT' docs`

Expected: 과거 기록과 종료 결정 외 활성 기능 설명 없음.

### Task 5: 종합 검증과 운영 전환

**Files:**
* Verify only: `BE`, `FE`, `docker-compose.prod.yml`, EC2 `/home/ubuntu/attacca/.env.prod`

**Interfaces:** 반입 제거 후 로그인·공지 관리·채팅의 정상 동작과 BE health를 검증한다.

- [x] **Step 1: FE 전체 검증을 실행한다.**

Run: `cd FE && npm test -- --run && npm run typecheck && npm run lint && npm run build`

- [x] **Step 2: BE 전체 테스트를 실행한다.**

Run: `cd BE && ./gradlew test`

- [ ] **Step 3: 변경 파일만 커밋·푸시한다.**

Run:

```bash
git add BE FE docker-compose.prod.yml .env.prod.example docs
git commit -m "refactor: 외부 반입 기능을 제거한다"
git push origin main
```

- [ ] **Step 4: 배포 후 EC2 BE 이미지와 health를 확인한다.**

Run:

```bash
cd /home/ubuntu/attacca
docker compose --env-file .env.prod -f docker-compose.prod.yml ps be
docker inspect -f '{{ index .Config.Labels "org.opencontainers.image.revision" }}' attacca-be-1
```

- [ ] **Step 5: 새 이미지가 healthy인 것을 확인한 뒤에만 EC2 환경변수를 제거한다.**

Run:

```bash
cd /home/ubuntu/attacca
sed -i '/^KOPIS_SERVICE_KEY=/d; /^IMPORT_CONTACT=/d; /^KOPIS_BASE_URL=/d' .env.prod
```

- [ ] **Step 6: 운영 스모크를 확인한다.**

Expected: `/admin`에 외부 반입 링크가 없고, 로그인·공지 관리·채팅이 정상이다.
