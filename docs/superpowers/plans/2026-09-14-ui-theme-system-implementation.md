# Attacca UI 테마·엔터프라이즈 UI 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attacca FE에 명시적 `system/light/dark` 테마와 공통 상태·입력·버튼 기반을 도입하고 NOTICE/IMPORT 화면에 적용한다.

**Architecture:** 기존 CSS semantic token을 `data-theme`와 시스템 기본값으로 확장한다. 테마 선택은 작은 client provider가 localStorage를 관리하고, 공통 UI는 FE/components/ui 아래에 최소 컴포넌트로 둔다. 화면 기능·API·BFF 계약은 변경하지 않는다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-14-ui-theme-system-design.md`

## Global Constraints

- 테마 선택지는 `system`, `light`, `dark` 세 가지다.
- 최초 상태는 `system`이며 사용자 선택은 `localStorage`에 저장한다.
- 컴포넌트는 semantic token만 사용하고 원색을 직접 사용하지 않는다.
- 기존 API, 인증, BFF, 도메인 상태 계약은 변경하지 않는다.
- 라이트·다크 모두 WCAG AA 대비와 키보드 포커스를 유지한다.
- Playwright·Vitest·typecheck·lint·build를 모두 통과시킨다.

### Task 1: 테마 상태와 semantic token

**Files:**
- Create: `FE/components/theme/ThemeProvider.tsx`
- Create: `FE/components/theme/ThemeControl.tsx`
- Test: `FE/__tests__/theme.test.tsx`
- Modify: `FE/app/layout.tsx`
- Modify: `FE/app/globals.css`

**Interfaces:**
- Produces `ThemeMode = 'system' | 'light' | 'dark'`, `useTheme(): { mode: ThemeMode; setMode(mode: ThemeMode): void }`, and a document `data-theme` attribute.

- [ ] **Step 1: `useTheme`의 초기값·저장·문서 속성 테스트를 작성한다.** `system` 기본값, `localStorage` 복원, `light/dark` 선택 시 `document.documentElement.dataset.theme` 갱신을 단언한다.
- [ ] **Step 2: `npm test -- --run __tests__/theme.test.tsx`로 RED를 확인한다.** provider와 hook 부재 또는 기대 상태 불일치로 실패해야 한다.
- [ ] **Step 3: `ThemeProvider`를 구현한다.** 초기 hydration 차이를 피하기 위해 mounted 전에는 children을 유지하고, `matchMedia`는 `system`의 실제 CSS 해석에 맡긴다. 선택값은 `attacca-theme` 키에 저장한다.
- [ ] **Step 4: `globals.css`에 `:root`, `[data-theme='light']`, `[data-theme='dark']` 토큰을 정리한다.** 기존 시스템 다크 규칙은 system 기본값으로 보존하고 `data-theme`가 있으면 명시 선택이 우선하도록 한다.
- [ ] **Step 5: `ThemeControl`을 Header에 연결한다.** 버튼 또는 menu는 현재 모드와 각 선택지를 accessible name으로 노출하고 키보드로 선택 가능하게 한다.
- [ ] **Step 6: focused test와 `npm run typecheck`를 실행한다.** 테마 테스트와 기존 Header 테스트가 함께 통과해야 한다.

### Task 2: 공통 UI 상태 컴포넌트

**Files:**
- Create: `FE/components/ui/Button.tsx`
- Create: `FE/components/ui/Field.tsx`
- Create: `FE/components/ui/StatusMessage.tsx`
- Create: `FE/components/ui/EmptyState.tsx`
- Test: `FE/__tests__/ui-components.test.tsx`

**Interfaces:**
- `Button` accepts `variant: 'primary' | 'secondary' | 'danger'`, `loading?: boolean`, and native button props.
- `Field` accepts `label`, `error?`, `hint?`, and input children, wiring `aria-invalid`/`aria-describedby` through stable ids.
- `StatusMessage` accepts `tone: 'info' | 'success' | 'warning' | 'danger'` and children.

- [ ] **Step 1: 버튼 loading/disabled, Field 오류 접근성, 상태 tone, EmptyState 테스트를 작성한다.** 화면 텍스트와 role을 기준으로 단언한다.
- [ ] **Step 2: focused Vitest를 실행해 RED를 확인한다.**
- [ ] **Step 3: semantic token과 기존 rounded/border 스타일을 사용해 네 컴포넌트를 구현한다.** 상태 색은 CSS 원색이 아니라 `success/warning/danger/info` 토큰을 사용한다.
- [ ] **Step 4: focused Vitest, typecheck, lint를 실행한다.**

### Task 3: NOTICE/IMPORT 폼과 운영 화면 적용

**Files:**
- Modify: `FE/components/notice/NoticeForm.tsx`
- Modify: `FE/components/imports/ImportItemList.tsx`
- Modify: `FE/components/imports/ImportReviewDialog.tsx`
- Modify: `FE/components/imports/ImportSourceStatus.tsx`
- Modify: `FE/app/admin/imports/page.tsx`
- Test: existing NOTICE/IMPORT component tests

- [ ] **Step 1: NOTICE 출처 필드 오류, IMPORT 빈 목록/실패/실행 중 상태, 승인 버튼 loading 상태의 테스트를 먼저 보강한다.**
- [ ] **Step 2: `Field`, `Button`, `StatusMessage`, `EmptyState`를 적용한다.** 기존 API payload와 validation 함수는 그대로 호출한다.
- [ ] **Step 3: IMPORT 운영 화면의 필터·페이지·상태 배지를 semantic token과 공통 버튼으로 정리한다.** 위험한 거절은 기존 확인 흐름을 유지하면서 `danger` variant를 사용한다.
- [ ] **Step 4: NOTICE/IMPORT 대상 테스트와 Playwright smoke를 실행한다.** 기존 E2E URL 계약이 유지되어야 한다.

### Task 4: 공개 화면과 Header 밀도 조율

**Files:**
- Modify: `FE/components/layout/Header.tsx`
- Modify: `FE/app/notices/[id]/page.tsx`
- Modify: `FE/app/performances/[id]/page.tsx`
- Modify: `FE/app/page.tsx` and affected home components as needed
- Test: existing home/header/public detail tests

- [ ] **Step 1: Header 테마 선택의 모바일·키보드 상태와 공개 상세 출처 링크의 라이트/다크 렌더링 테스트를 추가한다.**
- [ ] **Step 2: Header의 테마 control과 공개 상세의 섹션·링크·상태 표현을 공통 token으로 조정한다.** 기능·링크·보안 URL guard는 유지한다.
- [ ] **Step 3: 375px과 데스크톱에서 텍스트가 겹치지 않는지 Playwright viewport smoke를 실행한다.**

### Task 5: 통합 검증과 문서 동기화

**Files:**
- Modify: `FE/README.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/AI-ACTION-LOGS.md`

- [ ] **Step 1: `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`를 실행한다.**
- [ ] **Step 2: `git diff --check`와 라이트/다크 토큰 누락 검색을 실행한다.**
- [ ] **Step 3: 테마 선택, 공통 UI, NOTICE/IMPORT 적용 범위와 남은 화면을 문서에 기록한다.**
- [ ] **Step 4: 운영 후속 작업(KOPIS 키·IMPORT_CONTACT·실데이터 smoke)은 숨기지 않고 다음 작업으로 남긴다.**
