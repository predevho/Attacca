# API 페이지 계약 안정화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공연 목록과 관리자 인증 심사 목록이 Spring `PageImpl` 내부 구조 대신 안정적인 `PageResponse<T>` JSON 계약을 사용하게 한다.

**Architecture:** 서비스와 리포지토리는 Spring Data `Page<T>`를 계속 사용한다. HTTP 경계인 두 컨트롤러에서만 기존 `PageResponse.from(Page<T>)`로 변환하고, 해당 프런트 소비처는 `number`가 아닌 `page` 필드를 읽는다. 다른 도메인의 페이지 API와 페이지 정책은 이 작업에서 건드리지 않는다.

**Tech Stack:** Java 21, Spring Boot, Spring Data JPA, JUnit 5, Next.js, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-09-27-api-contract-stabilization-design.md`

## Global Constraints

* 사용자 화면 흐름, 정렬, 페이지 기본값, 최대 크기, 권한 규칙을 변경하지 않는다.
* 외부 JSON 계약은 `content`, `page`, `size`, `totalElements`, `totalPages`, `first`, `last`만 사용한다.
* `number` 호환 별칭을 추가하지 않는다.
* `/api/admin/**` 권한 강제는 계속 Spring Security와 도메인 서비스가 담당한다.
* 커밋과 푸시는 사용자 요청이 있을 때만 수행한다.

## Review Focus

* 첫 페이지(`page=0`)가 마지막 페이지가 아닐 때 프런트가 다음 요청을 `page=1`로 보내야 한다.
* 마지막 페이지는 다음 페이지 요청을 만들지 않아야 한다.
* 빈 결과도 `content=[]`, `first=true`, `last=true`의 안정된 계약을 유지해야 한다.
* 관리자 인증 심사 목록은 상태 필터와 관리자 권한 검사를 유지해야 한다.
* 공연 목록의 공개 BFF 경로는 BE의 새 `page` 필드를 그대로 전달해야 한다.

---

### Task 1: 백엔드 두 목록 API를 `PageResponse<T>`로 고정

**Files:**
- Modify: `BE/src/main/java/com/back/domain/performance/controller/PerformanceController.java`
- Modify: `BE/src/main/java/com/back/domain/verifiedperformer/controller/VerifiedPerformerAdminController.java`
- Modify: `BE/src/test/java/com/back/domain/performance/controller/PerformanceControllerTest.java`
- Modify: `BE/src/test/java/com/back/domain/verifiedperformer/controller/VerifiedPerformerAdminControllerTest.java`

**Interfaces:**
- Consumes: `PageResponse.from(Page<T>)` from `com.back.global.common.PageResponse`
- Produces: `ApiResponse<PageResponse<PerformanceResponse>>` and `ApiResponse<PageResponse<ApplicationResponse>>`

- [x] **Step 1: 두 컨트롤러 테스트에 새 JSON 계약 단언을 먼저 추가한다.**

공연 목록 테스트는 응답 `data`에 `content`, `page`, `size`, `totalElements`, `totalPages`, `first`, `last`가 있고 `number`가 없음을 단언한다. 인증 심사 목록도 동일 필드와 요청한 `status`의 결과를 단언한다.

```java
.andExpect(jsonPath("$.data.page").value(0))
.andExpect(jsonPath("$.data.size").value(20))
.andExpect(jsonPath("$.data.totalElements").value(1))
.andExpect(jsonPath("$.data.first").value(true))
.andExpect(jsonPath("$.data.last").value(true))
.andExpect(jsonPath("$.data.number").doesNotExist());
```

- [x] **Step 2: 새 단언이 현재 구현에서 실패하는지 확인한다.**

Run:

```bash
cd BE
./gradlew test --tests com.back.domain.performance.controller.PerformanceControllerTest --tests com.back.domain.verifiedperformer.controller.VerifiedPerformerAdminControllerTest
```

Expected: `$.data.page` 누락 또는 `$.data.number` 존재 때문에 FAIL.

- [x] **Step 3: 컨트롤러 경계에서만 `PageResponse`로 변환한다.**

```java
return ApiResponse.success(PageResponse.from(
        performanceService.getPerformances(scope, PageRequest.of(Math.max(page, 0), clamp(size))));
```

인증 심사 목록도 서비스 반환값 `Page<ApplicationResponse>`를 같은 방식으로 감싼다. 서비스·리포지토리의 반환 타입과 `PageRequest` 생성 코드는 바꾸지 않는다.

- [x] **Step 4: 두 컨트롤러 테스트를 다시 실행한다.**

Run:

```bash
cd BE
./gradlew test --tests com.back.domain.performance.controller.PerformanceControllerTest --tests com.back.domain.verifiedperformer.controller.VerifiedPerformerAdminControllerTest
```

Expected: PASS. 관리자 아닌 토큰의 403과 상태 필터 테스트도 기존대로 통과.

### Task 2: 공연·인증 심사 프런트의 페이지 필드를 새 계약으로 전환

**Files:**
- Modify: `FE/lib/performance/types.ts`
- Modify: `FE/lib/performance/logic.ts`
- Modify: `FE/app/performances/page.tsx`
- Modify: `FE/lib/verification/types.ts`
- Modify: `FE/lib/verification/logic.ts`
- Modify: `FE/app/admin/verified-performers/page.tsx`
- Modify: `FE/__tests__/performance-logic.test.ts`
- Modify: `FE/__tests__/performances-page.test.tsx`
- Modify: `FE/__tests__/admin-verified-performers-page.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `PageResponse<T>` JSON 필드
- Produces: `toCursorPage`가 `page.last ? null : page.page + 1`로 다음 요청 번호를 계산

- [x] **Step 1: 프런트 테스트 fixture를 `page` 계약으로 바꾼다.**

```ts
expect(toCursorPage({ content: [{ id: 1 } as never], page: 0, totalPages: 3, last: false }))
  .toEqual({ items: [{ id: 1 }], nextCursor: 1 });
```

공연 화면 fixture와 관리자 인증 심사 fixture의 `number: 0`도 `page: 0`으로 바꾼다. 마지막 페이지 fixture는 `page: 2, last: true`로 유지해 `nextCursor: null`을 검증한다.

- [x] **Step 2: 현재 구현에서 타입 또는 테스트가 실패하는지 확인한다.**

Run:

```bash
cd FE
npm test -- --run __tests__/performance-logic.test.ts __tests__/performances-page.test.tsx __tests__/admin-verified-performers-page.test.tsx
npm run typecheck
```

Expected: `number` 필드 누락 또는 `page` 미정의로 FAIL.

- [x] **Step 3: 도메인별 `SpringPage<T>` 타입을 `PageResponse<T>` 계약으로 바꾼다.**

공연과 인증 심사 도메인에서만 아래 형태를 사용한다.

```ts
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};
```

`toCursorPage`는 `page.page + 1`을 사용한다. `FE/app/performances/page.tsx`와 `FE/app/admin/verified-performers/page.tsx`의 `getBff` 제네릭과 캐스팅도 새 타입으로 바꾼다. 채팅·구인·공지의 기존 `SpringPage` 타입은 수정하지 않는다.

- [x] **Step 4: 대상 프런트 테스트와 타입 검사를 다시 실행한다.**

Run:

```bash
cd FE
npm test -- --run __tests__/performance-logic.test.ts __tests__/performances-page.test.tsx __tests__/admin-verified-performers-page.test.tsx
npm run typecheck
```

Expected: PASS. 첫 페이지가 다음 페이지 `1`을 계산하고 마지막 페이지가 추가 요청을 멈춘다.

### Task 3: 전체 회귀와 문서 상태를 확인

**Files:**
- Modify: `docs/TODO-BACKLOG.md`
- Modify: `docs/TODO-DOING.md`
- Modify: `docs/TODO-DONE.md`
- Modify: `docs/AI-ACTION-LOGS.md`

**Interfaces:**
- Consumes: Task 1과 Task 2의 안정된 페이지 계약
- Produces: 완료 상태와 남은 범위(다른 도메인 페이지 API, 페이지 크기 보정 공용화)의 정확한 기록

- [x] **Step 1: 백엔드 전체 회귀를 실행한다.**

Run:

```bash
cd BE
./gradlew test
```

Expected: PASS. `PageImpl` 직접 직렬화 경고가 대상 두 API 요청에서 재현되지 않는다.

- [x] **Step 2: 프런트 전체 자동 검증을 실행한다.**

Run:

```bash
cd FE
npm test -- --run
npm run typecheck
npx eslint .
npm run check:colors
npm run build
```

Expected: 모든 명령 성공. 기존 허용 경고가 있다면 새 경고가 추가되지 않는다.

- [x] **Step 3: 문서 상태를 실제 결과로 갱신한다.**

`TODO-DOING`의 API 계약 안정화 작업을 `TODO-DONE`으로 옮긴다. `TODO-BACKLOG`에서 대상 두 API의 `PageResponse<T>` 전환 항목은 완료로 표시하고, 다른 도메인 페이지 API와 `clamp` 공용화는 미완료로 남긴다. `AI-ACTION-LOGS`에는 사용자 기능 변화 없이 두 외부 계약을 안정화한 사실과 검증 명령 결과를 기록한다.

- [x] **Step 4: 변경 범위와 Git 상태를 검토한다.**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: 계획 범위의 BE·FE·문서 파일만 변경되어 있고, 사용자의 기존 untracked 파일은 수정·추가·삭제하지 않는다.

## Self-Review

* Spec coverage: 두 외부 API의 `PageResponse` 전환, 공연·인증 심사 FE 소비처 전환, 사용자 UX·권한·페이지 정책 보존, 전 계층 검증과 문서 상태 반영을 Task 1~3에 각각 배치했다.
* Placeholder scan: 계획에 `TBD`, `TODO`, `implement later`, "appropriate" 같은 실행 불가능한 지시가 없다.
* Type consistency: 백엔드는 `PageResponse<T>`의 `page`, 프런트도 동일한 `page`를 사용한다. 무한 목록의 다음 페이지 계산은 두 도메인에서 같은 `page.last ? null : page.page + 1`이다.
* Review Focus coverage: 첫 페이지·마지막 페이지는 Task 2 테스트, 빈 결과는 Task 1 JSON 테스트, 관리자 상태·권한은 Task 1 기존 컨트롤러 회귀, 공개 BFF 전달은 Task 2 공연 화면 테스트로 고정한다.
