# Admin Operations Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 허브, 공지 관리, 인증 심사에 일관된 운영 화면 프레임을 적용한다.

**Architecture:** `AdminPageFrame`은 운영 화면의 최상위 의미 요소와 두 가지 폭, 제목·설명·행동 슬롯을 제공한다. 페이지는 기존 BFF 요청, 권한 확인, 목록·폼·심사 컴포넌트를 유지하고 각자 흩어진 `main`과 헤더 마크업만 공통 프레임으로 대체한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-29-admin-operations-layout-design.md`

## Global Constraints

- BE API, BFF 경로, ADMIN 판별, 리다이렉트, 공지·인증 심사의 도메인 규칙을 바꾸지 않는다.
- 기본 운영 폭은 `max-w-5xl`, 공지 등록·수정처럼 한 건을 작성하는 집중형 폭은 `max-w-3xl`이다.
- 기존 `alert`, `status`, 탭, 행 단위 행동의 접근성 계약을 유지한다.
- 운영 지표, 일괄 처리, 감사 로그, 사이드바와 새 디자인 라이브러리를 추가하지 않는다.
- 커밋과 푸시는 사용자 요청이 있을 때만 수행한다.

## Review Focus

- 비로그인·비관리자: 기존 `/login`, `/`, `/feed` 리다이렉트가 레이아웃 변경 뒤에도 정확히 유지되어야 한다. Task 2와 3의 기존 권한 회귀 테스트를 실행한다.
- 공지 목록 오류·빈 상태: 운영 헤더를 추가해도 재시도 버튼, `alert`, 빈 상태 문구가 남아야 한다. Task 2에서 테스트한다.
- 긴 공지 제목과 작은 화면: 제목·일정·수정/삭제가 가로로 겹치지 않아야 한다. Task 2의 목록 행 클래스와 브라우저 확인에서 검증한다.
- 심사 상태 전환: 프레임 적용 뒤에도 탭의 선택 상태와 API 호출이 바뀌지 않아야 한다. Task 3의 탭·승인·거절 테스트를 실행한다.
- 등록·수정 폼: `narrow` 폭에서도 취소 및 저장 중 상태가 기존처럼 동작해야 한다. Task 2의 폼 렌더·취소 회귀 테스트를 추가한다.

---

### Task 1: AdminPageFrame 공통 계약

**Files:**
- Create: `FE/components/admin/AdminPageFrame.tsx`
- Create: `FE/__tests__/admin-page-frame.test.tsx`

**Interfaces:**
- Produces: `AdminPageFrame({ title, description, action, width, children, className })`
- `width`: `'default' | 'narrow'`, 기본값은 `'default'`
- `action`: 제목 오른쪽에 두는 선택 `ReactNode`

- [ ] **Step 1: 실패하는 공통 프레임 렌더링 테스트 작성**

```tsx
render(<AdminPageFrame title="공지 관리" description="운영 공지를 관리합니다.">목록</AdminPageFrame>);
expect(screen.getByRole('main')).toHaveClass('max-w-5xl');
expect(screen.getByRole('heading', { name: '공지 관리' })).toBeInTheDocument();
expect(screen.getByText('운영 공지를 관리합니다.')).toBeInTheDocument();
```

`width="narrow"`와 `action={<button>공지 등록</button>}`도 각각 `max-w-3xl`, 버튼 노출을 단언한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run __tests__/admin-page-frame.test.tsx`

Expected: `AdminPageFrame` 모듈을 찾지 못해 실패한다.

- [ ] **Step 3: 최소 공통 프레임 구현**

`FE/components/admin/AdminPageFrame.tsx`에 다음 계약을 구현한다.

```tsx
type AdminPageWidth = 'default' | 'narrow';

type AdminPageFrameProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  width?: AdminPageWidth;
  children: ReactNode;
  className?: string;
};
```

`main`은 `mx-auto w-full px-4`, 폭, `py-10`을 공유한다. 제목·설명·행동은 `border-b border-line` 상단 영역에 배치하고, `action`이 없을 때는 빈 행동 영역을 만들지 않는다.

- [ ] **Step 4: 공통 프레임 테스트 통과 확인**

Run: `npm test -- --run __tests__/admin-page-frame.test.tsx`

Expected: 기본 폭·집중 폭·제목·설명·행동 슬롯 테스트가 통과한다.

### Task 2: 관리 허브와 공지 관리 적용

**Files:**
- Modify: `FE/app/admin/page.tsx`
- Modify: `FE/app/admin/notices/page.tsx`
- Modify: `FE/__tests__/admin-page.test.tsx`
- Modify: `FE/__tests__/admin-notices-page.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `AdminPageFrame`
- Produces: 기본 폭의 관리 허브·공지 목록과 집중 폭의 공지 등록/수정 화면

- [ ] **Step 1: 기존 허브·공지 관리 테스트 실행**

Run: `npm test -- --run __tests__/admin-page.test.tsx __tests__/admin-notices-page.test.tsx`

Expected: 관리자 권한, 공지 CRUD 요청, 로딩·오류·빈 상태 테스트가 통과한다.

- [ ] **Step 2: 공지 폼 흐름의 실패하는 회귀 테스트 추가**

```tsx
fireEvent.click(await screen.findByRole('button', { name: '공지 등록' }));
expect(screen.getByRole('heading', { name: '공지 등록' })).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: '취소' }));
expect(screen.getByRole('heading', { name: '공지 관리' })).toBeInTheDocument();
```

- [ ] **Step 3: 관리 허브와 공지 관리의 최상위 구조 교체**

`FE/app/admin/page.tsx`는 `AdminPageFrame` 기본 폭에 `관리`, `운영 업무를 선택하세요.`를 전달하고 기존 업무 목록 `nav`를 자식으로 둔다.

`FE/app/admin/notices/page.tsx`는 다음을 적용한다.

- 목록: 기본 폭, `공지 관리`, 공지 관리 목적 설명, `공지 등록`을 `action`으로 전달한다.
- 등록/수정: `narrow` 폭, `공지 등록` 또는 `공지 수정`, 목록으로 돌아가는 버튼을 제목 위에 유지한다.
- 기존 로딩·오류·빈 상태·목록 행·수정/삭제 동작은 자식으로 유지한다.

- [ ] **Step 4: 허브·공지 관리 회귀 테스트 통과 확인**

Run: `npm test -- --run __tests__/admin-page.test.tsx __tests__/admin-notices-page.test.tsx`

Expected: 기존 테스트와 공지 등록→취소 회귀 테스트가 통과한다.

### Task 3: 인증 심사 운영 프레임 적용

**Files:**
- Modify: `FE/app/admin/verified-performers/page.tsx`
- Modify: `FE/__tests__/admin-verified-performers-page.test.tsx`

**Interfaces:**
- Consumes: Task 1의 기본 폭 `AdminPageFrame`
- Produces: 제목·설명, 직접 지정, 상태 탭, 심사 목록이 분리된 인증 심사 화면

- [ ] **Step 1: 기존 인증 심사 테스트 실행**

Run: `npm test -- --run __tests__/admin-verified-performers-page.test.tsx`

Expected: 권한 리다이렉트, 탭, 직접 지정, 승인·거절 호출 테스트가 통과한다.

- [ ] **Step 2: 운영 헤더와 업무 영역의 실패하는 구조 테스트 추가**

```tsx
expect(await screen.findByRole('heading', { name: '인증 연주자 심사' })).toBeInTheDocument();
expect(screen.getByText('신청을 검토하고 처리합니다.')).toBeInTheDocument();
expect(screen.getByRole('tablist', { name: '신청 상태' })).toBeInTheDocument();
```

- [ ] **Step 3: 인증 심사 최상위 구조 교체**

`FE/app/admin/verified-performers/page.tsx`의 준비 중 상태와 일반 상태를 `AdminPageFrame` 기본 폭으로 바꾼다. 일반 상태에서는 제목·설명 아래에 `GrantForm`을 별도 경계 영역으로 두고, 메시지·상태 탭·심사 목록의 현재 순서와 API 행동을 유지한다.

- [ ] **Step 4: 인증 심사 회귀 테스트 통과 확인**

Run: `npm test -- --run __tests__/admin-verified-performers-page.test.tsx`

Expected: 기존 권한·탭·행동 테스트와 운영 헤더 테스트가 통과한다.

### Task 4: 전체 검증과 작업 기록

**Files:**
- Modify: `docs/TODO-DOING.md`
- Modify: `docs/TODO-DONE.md`
- Modify: `docs/AI-ACTION-LOGS.md`

**Interfaces:**
- Consumes: Task 1~3의 공통 운영 프레임과 회귀 테스트
- Produces: 검증 근거가 있는 완료 기록

- [ ] **Step 1: 관리자 관련 테스트 묶음 실행**

Run: `npm test -- --run __tests__/admin-page-frame.test.tsx __tests__/admin-page.test.tsx __tests__/admin-notices-page.test.tsx __tests__/admin-verified-performers-page.test.tsx`

Expected: 공통 프레임과 세 운영 화면의 테스트가 통과한다.

- [ ] **Step 2: 전체 프런트엔드 검증**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

Expected: 테스트·타입 검사·lint·production build가 통과한다. 기존 `<img>` lint 경고가 있으면 새 경고와 구분해 기록한다.

- [ ] **Step 3: 로컬 브라우저 확인**

데스크톱과 모바일 폭에서 `/admin`, `/admin/notices`, `/admin/verified-performers`를 연다. 제목·설명·주요 행동의 배치, 목록 가로 넘침, 탭과 작업 버튼의 터치 영역을 확인한다. 권한이 없는 상태에서는 기존 리다이렉트만 확인하고 운영 데이터를 변경하지 않는다.

- [ ] **Step 4: 작업 문서 이동**

`TODO-DOING`의 관리자 운영 화면 프레임 항목을 완료 기록으로 옮기고, 적용 화면·비범위·검증 결과·남은 운영 기능을 `TODO-DONE`과 `AI-ACTION-LOGS`에 기록한다.

- [ ] **Step 5: 사용자 요청 시 커밋**

```bash
git add FE/components/admin FE/app/admin FE/__tests__/admin-*.test.tsx docs
git commit -m "refactor: 관리자 운영 화면 프레임을 통일한다"
```

## Self-review

- Spec coverage: 공통 프레임, 두 폭, 허브, 공지 관리, 인증 심사, 접근성 상태, 브라우저·전체 검증을 Task 1~4에 각각 배정했다.
- Step scan: 각 태스크는 실패 테스트, 실패 확인, 최소 구현, 통과 확인으로 나눴고 기존 API·권한 계약은 변경하지 않는다.
- Type consistency: 모든 소비 화면은 `AdminPageFrame`의 `title`, `description`, `action`, `width`, `children` 계약만 사용한다.
- Review focus: 권한, 공지 상태, 작은 폭의 목록, 심사 탭·행동, 폼 취소 흐름을 각각 Task 2~4의 테스트 또는 브라우저 검증에 연결했다.
- Proportion: 새 공통 컴포넌트와 세 화면의 최상위 구조만 다루며, 운영 기능 확장은 범위에서 제외했다.

## 실행 상태

- Task 1~3: 2026-09-29 구현 및 관련 테스트 완료.
- Task 4: 관리자 관련 18건, FE 전체 573건, 타입 검사, lint(기존 `<img>` 경고 4건), production build를 통과했다. 실제 운영 브라우저 확인은 커밋·푸시 후 남아 있다.
