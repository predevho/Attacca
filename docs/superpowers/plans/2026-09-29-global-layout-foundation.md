# Global Layout Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공통 페이지 프레임으로 홈·피드·구인·채팅의 콘텐츠 폭과 여백을 일관되게 만든다.

**Architecture:** `PageContainer`가 페이지 최상위 의미 요소와 폭 규칙을 제공한다. 화면은 데이터 요청과 도메인 컴포넌트를 그대로 두고, 기존의 개별 `main` 클래스만 공통 컨테이너로 교체한다. 헤더의 폭은 일반 콘텐츠 프레임과 동일하게 유지한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-29-global-layout-foundation-design.md`

## Global Constraints

- 인증, BFF 요청, 채팅 STOMP 연결·스크롤·입력창 동작은 변경하지 않는다.
- 기본 밝은 테마와 기존 CSS 색상 토큰을 유지한다.
- 모바일 메뉴의 Escape 닫기와 현재 페이지 `aria-current`를 유지한다.
- 수정 범위는 `FE/components/layout`, 대표 페이지, 관련 테스트와 작업 문서다.

---

### Task 1: PageContainer 공통 계약

**Files:**
- Create: `FE/components/layout/PageContainer.tsx`
- Test: `FE/__tests__/page-container.test.tsx`

**Interfaces:**
- Produces: `PageContainer({ children, width, className, ...props })`
- `width`: `'content' | 'wide' | 'narrow'`, 기본값은 `'content'`

- [ ] **Step 1: 실패하는 렌더링 테스트 작성**

```tsx
render(<PageContainer>콘텐츠</PageContainer>);
expect(screen.getByTestId('page-container')).toHaveClass(
  'mx-auto', 'w-full', 'max-w-5xl', 'px-4',
);
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --run __tests__/page-container.test.tsx`

Expected: `PageContainer` 모듈을 찾지 못해 실패한다.

- [ ] **Step 3: 최소 구현 작성**

```tsx
type PageWidth = 'content' | 'wide' | 'narrow';

const widths: Record<PageWidth, string> = {
  content: 'max-w-5xl',
  wide: 'max-w-6xl',
  narrow: 'max-w-3xl',
};

export function PageContainer({ width = 'content', className, ...props }) {
  return <main data-testid="page-container" className={`mx-auto w-full px-4 ${widths[width]} ${className ?? ''}`} {...props} />;
}
```

- [ ] **Step 4: 기본·넓은 폭 테스트 통과 확인**

Run: `npm test -- --run __tests__/page-container.test.tsx`

Expected: 두 테스트가 통과한다.

### Task 2: 대표 화면에 공통 프레임 적용

**Files:**
- Modify: `FE/app/page.tsx`
- Modify: `FE/app/feed/page.tsx`
- Modify: `FE/app/recruitments/page.tsx`
- Modify: `FE/app/chat/page.tsx`
- Modify: `FE/app/chat/[id]/page.tsx`
- Test: `FE/__tests__/chat-list-page.test.tsx`
- Test: `FE/__tests__/chat-room-page.test.tsx`

**Interfaces:**
- Consumes: `PageContainer`의 `content`, `wide`, `narrow` 폭 계약
- Produces: 홈은 `content`, 피드·구인은 `narrow`, 채팅 목록은 `narrow`, 대화방은 `wide` 프레임

- [ ] **Step 1: 대표 페이지의 기존 렌더링 테스트 실행**

Run: `npm test -- --run __tests__/chat-list-page.test.tsx __tests__/chat-room-page.test.tsx`

Expected: 기존 채팅 목록·대화방 동작이 통과한다.

- [ ] **Step 2: 각 최상위 `main`을 PageContainer로 교체**

```tsx
<PageContainer width="narrow" className="mt-8">
  {/* 기존 페이지 내용 */}
</PageContainer>
```

대화방은 고정 높이를 보존한다.

```tsx
<PageContainer width="wide" className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
  {/* ChatRoomHeader, ChatRoomTimeline, MessageComposer */}
</PageContainer>
```

- [ ] **Step 3: 채팅 회귀 테스트 통과 확인**

Run: `npm test -- --run __tests__/chat-list-page.test.tsx __tests__/chat-room-page.test.tsx __tests__/chat-history.test.ts`

Expected: 대화 목록·대화방·과거 이력 테스트가 모두 통과한다.

### Task 3: 전역 내비게이션 정렬과 전체 검증

**Files:**
- Modify: `FE/components/layout/Header.tsx`
- Test: `FE/__tests__/header.test.tsx`
- Modify: `docs/TODO-DOING.md`
- Modify: `docs/TODO-DONE.md`

**Interfaces:**
- Consumes: 일반 페이지 프레임 `max-w-5xl px-4`
- Produces: 헤더의 콘텐츠 폭이 일반 화면과 같은 수직선에 정렬된 상태

- [ ] **Step 1: 헤더 테스트 실행**

Run: `npm test -- --run __tests__/header.test.tsx __tests__/header-logic.test.ts`

Expected: 로그인 상태, 모바일 메뉴, Escape 닫기, 활성 메뉴 테스트가 통과한다.

- [ ] **Step 2: Header 탐색 컨테이너를 PageContainer의 일반 폭과 정렬**

`Header`의 `nav`는 `mx-auto max-w-5xl px-4`를 유지하고, 임의의 페이지별 폭 클래스를 추가하지 않는다. 모바일 메뉴는 같은 `nav` 내부에서 계속 열리고 닫혀야 한다.

- [ ] **Step 3: 전체 프론트 검증**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

Expected: 테스트·타입 검사·린트·프로덕션 빌드가 모두 통과한다. 기존 `<img>` lint 경고가 있으면 새 경고가 아니라는 점을 구분해 기록한다.

- [ ] **Step 4: 브라우저 확인 및 작업 문서 이동**

데스크톱과 모바일에서 홈, 피드, 구인, 채팅 목록, 채팅 대화방을 열어 콘텐츠 폭·모바일 메뉴·채팅 입력창 겹침을 확인한다. 완료 항목은 `docs/TODO-DONE.md`로 옮긴다.

- [ ] **Step 5: 커밋**

```bash
git add FE/components/layout/PageContainer.tsx FE/app FE/components/layout/Header.tsx FE/__tests__ docs
git commit -m "refactor: 전역 페이지 레이아웃을 통일한다"
```

## Self-review

- 범위: 공통 폭, 대표 화면, 헤더 정렬, 반응형·채팅 회귀 검증을 모두 포함한다.
- 비범위: API·인증·STOMP·상세/관리자 내부 화면 변경을 제외했다.
- 인터페이스: `PageContainer` 폭 이름과 사용 화면이 모든 작업에서 일치한다.

## 실행 중 범위 확장

2026-09-29 사용자 승인 후 공개 상세·작성 화면까지 같은 `narrow` 프레임을 적용했다. 피드·구인·공연·공지·인증 연주자 화면의 정상·로딩·없음 상태가 대상이며, 관리자 화면은 별도 작업으로 분리한다.
