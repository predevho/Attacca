# 전역 내비게이션 + 악보지 테마 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전 도메인 화면을 잇는 공용 헤더를 만들고, 앱 전체를 헨레 악보 기반의 시맨틱 색 토큰(종이/밤 두 팔레트)으로 전환한다.

**Architecture:** `globals.css`에 의미 기반 CSS 변수를 정의하고 Tailwind v4 `@theme inline`으로 유틸리티를 생성한다. 컴포넌트는 `bg-surface`, `text-ink-muted`처럼 **의미로만** 색을 쓰고 다크모드를 알지 못한다. 다크는 `prefers-color-scheme` 미디어쿼리에서 변수 값만 교체한다. 헤더는 루트 레이아웃에 두고, 인증 화면에서는 헤더 자신이 `usePathname()`으로 판단해 렌더하지 않는다.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Vitest + @testing-library/react

**설계 문서:** `docs/superpowers/specs/2026-08-18-global-nav-paper-theme-design.md`

---

## 사전 확인 (작업 시작 전 1회)

- [ ] BE·FE가 기동 중인지 확인. 8080/3000이 다른 프로젝트에 점유돼 있으면 Attaca는 BE 8081 / FE 3001로 띄운다.

```bash
export JAVA_HOME=/Users/predevho/Library/Java/JavaVirtualMachines/graalvm-jdk-21.0.7/Contents/Home
```

`CONTEXT.md`의 "주의" 절 참고. Gradle 8.11.1은 시스템 기본 JDK 25에서 실패한다.

- [ ] 기준선 확인: `cd FE && npx vitest run` → **285 passed** 이어야 한다. 여기서 실패가 있으면 먼저 원인을 확인하고 시작한다.

---

## 치환 규칙 (Task 8~14 공통 참조)

색 치환 작업은 아래 표를 **그대로** 적용한다. 표에 없는 색을 만나면 임의로 판단하지 말고 기록해 두고 보고한다.

| 기존 클래스 | 새 클래스 | 의미 |
|---|---|---|
| `text-gray-400` | `text-ink-faint` | 흐린 텍스트 |
| `text-gray-500` | `text-ink-muted` | 보조 텍스트 |
| `text-gray-600` | `text-ink-muted` | 보조 텍스트 |
| `text-gray-700` | `text-ink-muted` | 보조 텍스트 |
| `text-gray-800` | `text-ink` | 본문 |
| `text-black` | `text-ink` | 본문 |
| `bg-gray-100` | `bg-surface-2` | 은은한 면 |
| `bg-gray-200` | `bg-surface-2` | 은은한 면 |
| `bg-black` | `bg-brand` | 주요 버튼·활성 칩 |
| `text-white` | `text-on-brand` | 브랜드 면 위 글자 |
| `bg-indigo-600` | `bg-brand` | 주요 버튼 |
| `bg-indigo-100` | `bg-brand` | 인증 뱃지 배경 |
| `text-indigo-600` | `text-brand-strong` | 링크 |
| `text-indigo-700` | `text-on-brand` | 인증 뱃지 글자 (배경이 `bg-brand`가 되므로) |
| `text-indigo-800` | `text-on-brand` | 인증 뱃지 계열 칩 글자 |
| `text-red-600` | `text-danger` | 에러 |
| `bg-amber-50` | `bg-surface-2` | 경고 배너 배경 |
| `text-amber-700` | `text-warn` | 경고 글자 |
| `border-amber-300` | `border-warn` | 경고 테두리 |
| `bg-green-50` | `bg-surface-2` | 성공 배너 배경 |
| `text-green-700` | `text-success` | 성공 글자 |
| `border-green-300` | `border-success` | 성공 테두리 |
| 색 없는 `border` | `border border-line` | 테두리 (v4 기본값이 `currentColor`라 명시 필요) |
| 카드 컨테이너 (`rounded* border p-*`) | `bg-surface` 추가 | 종이 위 카드 |

**`text-indigo-800` 주의:** 프로필의 악기 칩(`bg-indigo-100 text-indigo-800`)이 여기 해당한다. 쌍으로 `bg-brand text-on-brand`가 된다.

**카드 판정 기준:** 목록 항목·게시글·상세 패널처럼 **테두리로 구획된 블록**에만 `bg-surface`를 붙인다. 버튼·입력창·칩에는 붙이지 않는다.

### 치환하지 않는 예외 (전수 조사로 확정)

| 위치 | 클래스 | 이유 |
|---|---|---|
| `app/(auth)/login/LoginForm.tsx:43` | `bg-[#FEE500]` + `text-black` | 카카오 브랜드 식별색. 배경이 노랑 고정이므로 그 위 글자도 검정 고정이어야 한다. `text-on-brand`로 바꾸면 라이트에서 크림 글자가 노란 배경에 올라가 읽히지 않는다. |

### 상태색이 실제로 쓰인 곳 (전수 조사로 확정)

| 색 | 위치 | 용도 | 담당 태스크 |
|---|---|---|---|
| amber | `app/performances/[id]/page.tsx:52` | 포스터 업로드 실패 배너 | Task 10 |
| amber | `app/chat/[id]/page.tsx:94` | 실시간 연결 끊김 배너 | Task 13 |
| green | `components/recruitment/ApplyPanel.tsx:17` | 지원 완료 표시 | Task 11 |

이 세 곳이 전부다. 다른 파일에서 `warn`/`success` 토큰을 새로 쓸 일은 없다.

---

## Task 1: 색 토큰 정의

**Files:**
- Modify: `FE/app/globals.css` (전체 교체)

이 태스크에는 자동 테스트가 없다. CSS 토큰의 정확성은 클래스명 단언으로 검증되지 않고(설계 문서 §6), 빌드 성공과 실화면으로 확인한다.

- [ ] **Step 1: `globals.css`를 아래 내용으로 교체**

```css
@import "tailwindcss";

/*
 * 악보지 팔레트 — 헨레 악보의 종이(배경) · 음표(글자) · 표지(브랜드)에서 따왔다.
 * 컴포넌트는 이 변수를 직접 쓰지 않고 @theme이 만든 유틸리티(bg-paper, text-ink ...)로만 쓴다.
 * 다크는 아래 미디어쿼리에서 값만 교체하므로 컴포넌트는 다크를 알지 못한다.
 */
:root {
  --paper: #f5f0e6;
  --surface: #faf7f0;
  --surface-2: #ede6d8;
  --ink: #171717;
  --ink-muted: #5c574e;
  --ink-faint: #8a8378;
  --line: #ded5c4;
  --brand: #4e6e8e;
  --brand-strong: #3d5a80;
  --on-brand: #f5f0e6;
  --header: #3d5a80;
  --on-header: #f5f0e6;
  --danger: #dc2626;
  --warn: #b45309;
  --success: #15803d;
}

/*
 * 밤의 무대(다크). 헤더만 명암이 반전된다 — 라이트에서는 짙은 표지,
 * 다크에서는 밝은 표지가 어둠 위로 떠오른다.
 * 헤더 바를 그대로 두고 글자만 검정으로 바꾸면 대비 2.5:1로 기준(4.5) 미달이라 쓸 수 없다.
 */
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #1a1917;
    --surface: #232120;
    --surface-2: #2c2a28;
    --ink: #ede7da;
    --ink-muted: #a8a296;
    --ink-faint: #75706a;
    --line: #34312e;
    --brand: #8fb0ce;
    --brand-strong: #a9c6de;
    --on-brand: #16211c;
    --header: #8fb0ce;
    --on-header: #16211c;
    --danger: #f87171;
    --warn: #fbbf24;
    --success: #4ade80;
  }
}

@theme inline {
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-ink-faint: var(--ink-faint);
  --color-line: var(--line);
  --color-brand: var(--brand);
  --color-brand-strong: var(--brand-strong);
  --color-on-brand: var(--on-brand);
  --color-header: var(--header);
  --color-on-header: var(--on-header);
  --color-danger: var(--danger);
  --color-warn: var(--warn);
  --color-success: var(--success);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--paper);
  color: var(--ink);
  font-family: Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 2: 빌드가 통과하는지 확인**

```bash
cd FE && npx next build
```

Expected: 성공. `Compiled successfully` 이후 라우트 목록이 출력된다.

- [ ] **Step 3: 기존 테스트가 그대로 통과하는지 확인**

```bash
cd FE && npx vitest run
```

Expected: 285 passed. 색은 테스트되지 않으므로 이 단계에서 숫자가 바뀌면 안 된다.

- [ ] **Step 4: 커밋**

```bash
git add FE/app/globals.css
git commit -m "feat: 악보지 색 토큰 정의(종이/밤 두 팔레트)"
```

---

## Task 2: 헤더 로직 순수 함수

**Files:**
- Create: `FE/lib/layout/header.ts`
- Test: `FE/__tests__/header-logic.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/header-logic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, isActive, shouldShowHeader } from '@/lib/layout/header';

describe('shouldShowHeader', () => {
  it('인증 화면에서는 헤더를 숨긴다', () => {
    expect(shouldShowHeader('/login')).toBe(false);
    expect(shouldShowHeader('/signup')).toBe(false);
  });

  it('그 외 화면에서는 헤더를 보여준다', () => {
    expect(shouldShowHeader('/feed')).toBe(true);
    expect(shouldShowHeader('/feed/12')).toBe(true);
    expect(shouldShowHeader('/')).toBe(true);
  });

  it('경로 접두가 우연히 겹치는 것은 인증 화면으로 보지 않는다', () => {
    expect(shouldShowHeader('/loginsomething')).toBe(true);
  });
});

describe('isActive', () => {
  it('정확히 일치하면 활성이다', () => {
    expect(isActive('/feed', '/feed')).toBe(true);
  });

  it('하위 경로도 활성으로 본다', () => {
    expect(isActive('/feed/12', '/feed')).toBe(true);
    expect(isActive('/recruitments/3/edit', '/recruitments')).toBe(true);
  });

  it('다른 경로는 활성이 아니다', () => {
    expect(isActive('/performances', '/feed')).toBe(false);
  });
});

describe('NAV_ITEMS', () => {
  it('도메인 화면 4개를 담는다', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(['/feed', '/performances', '/recruitments', '/chat']);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd FE && npx vitest run __tests__/header-logic.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/layout/header"`

- [ ] **Step 3: 구현 작성**

`FE/lib/layout/header.ts`:

```ts
/** 헤더에 노출하는 도메인 화면. 순서가 곧 표시 순서다. */
export const NAV_ITEMS = [
  { href: '/feed', label: '피드' },
  { href: '/performances', label: '공연' },
  { href: '/recruitments', label: '구인' },
  { href: '/chat', label: '채팅' },
] as const;

/** 헤더를 감출 화면(인증). 여기서 걸러 신원 조회 요청 자체를 보내지 않는다. */
const HIDDEN_PREFIXES = ['/login', '/signup'];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function shouldShowHeader(pathname: string): boolean {
  return !HIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** 하위 경로(/feed/12)도 상위 링크(/feed)를 활성으로 본다. */
export function isActive(pathname: string, href: string): boolean {
  return matchesPrefix(pathname, href);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd FE && npx vitest run __tests__/header-logic.test.ts
```

Expected: PASS (3 describe / 7 test)

- [ ] **Step 5: 커밋**

```bash
git add FE/lib/layout/header.ts FE/__tests__/header-logic.test.ts
git commit -m "feat: 헤더 내비 항목·활성 판정·노출 여부 로직"
```

---

## Task 3: Header 컴포넌트

**Files:**
- Create: `FE/components/layout/Header.tsx`
- Test: `FE/__tests__/header.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/header.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const push = vi.fn();
let pathname = '/feed';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

const getBff = vi.fn();
const postBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  postBff: (...a: unknown[]) => postBff(...a),
}));

import { Header } from '@/components/layout/Header';

const ME = { id: 1, nickname: '스모크1', role: 'USER', verified: true };

beforeEach(() => {
  vi.clearAllMocks();
  pathname = '/feed';
  getBff.mockResolvedValue({ ok: true, data: ME, message: null });
  postBff.mockResolvedValue({ ok: true, message: null });
});

describe('Header', () => {
  it('도메인 링크 4개와 닉네임을 보여준다', async () => {
    render(<Header />);
    expect(await screen.findByRole('link', { name: '피드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '공연' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '구인' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '채팅' })).toBeInTheDocument();
    expect(screen.getByText('스모크1')).toBeInTheDocument();
  });

  it('현재 경로의 링크에 aria-current를 붙인다', async () => {
    pathname = '/recruitments/3/edit';
    render(<Header />);
    const active = await screen.findByRole('link', { name: '구인' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '피드' })).not.toHaveAttribute('aria-current');
  });

  it('인증 회원에게 인증 뱃지를 보여준다', async () => {
    render(<Header />);
    expect(await screen.findByText('인증')).toBeInTheDocument();
  });

  it('ADMIN에게만 어드민 링크를 보여준다', async () => {
    getBff.mockResolvedValue({ ok: true, data: { ...ME, role: 'ADMIN' }, message: null });
    render(<Header />);
    expect(await screen.findByRole('link', { name: '어드민' })).toBeInTheDocument();
  });

  it('일반 회원에게는 어드민 링크를 보여주지 않는다', async () => {
    render(<Header />);
    await screen.findByText('스모크1');
    expect(screen.queryByRole('link', { name: '어드민' })).not.toBeInTheDocument();
  });

  it('신원 조회에 실패하면 아무것도 렌더하지 않는다', async () => {
    getBff.mockResolvedValue({ ok: false, message: '인증 필요' });
    const { container } = render(<Header />);
    await waitFor(() => expect(getBff).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('fetch가 reject해도 죽지 않고 렌더만 건너뛴다', async () => {
    getBff.mockRejectedValue(new Error('network'));
    const { container } = render(<Header />);
    await waitFor(() => expect(getBff).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('로그인 화면에서는 렌더하지 않고 신원 조회도 하지 않는다', async () => {
    pathname = '/login';
    const { container } = render(<Header />);
    expect(container).toBeEmptyDOMElement();
    expect(getBff).not.toHaveBeenCalled();
  });

  it('로그아웃하면 BFF를 호출하고 /login으로 보낸다', async () => {
    render(<Header />);
    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/logout'));
    expect(push).toHaveBeenCalledWith('/login');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd FE && npx vitest run __tests__/header.test.tsx
```

Expected: FAIL — `Failed to resolve import "@/components/layout/Header"`

- [ ] **Step 3: 구현 작성**

`FE/components/layout/Header.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { NAV_ITEMS, isActive, shouldShowHeader } from '@/lib/layout/header';
import type { Me } from '@/lib/feed/types';

/**
 * 전역 헤더. 루트 레이아웃에 배치하되 인증 화면에서는 스스로 렌더를 건너뛴다.
 * 신원을 못 얻으면(비로그인·조회 실패) 헤더를 그리지 않는다 — 빈 껍데기를 노출하지 않기 위함.
 */
export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const visible = shouldShowHeader(pathname);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!visible) { setMe(null); return; }
    let cancelled = false;
    // 네트워크 레벨 reject까지 삼킨다. 헤더 때문에 페이지 전체가 죽으면 안 된다.
    getBff<Me>('/api/bff/me/identity')
      .then((res) => { if (!cancelled) setMe(res.ok ? (res.data as Me) : null); })
      .catch(() => { if (!cancelled) setMe(null); });
    return () => { cancelled = true; };
  }, [visible]);

  async function onLogout() {
    await postBff('/api/bff/logout');
    router.push('/login');
  }

  if (!visible || !me) return null;

  return (
    <header className="bg-header text-on-header">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/feed" className="text-lg font-bold tracking-tight">Attaca</Link>

        <ul className="flex flex-wrap items-center gap-4 text-sm">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'border-b-2 border-current pb-0.5 font-semibold' : 'opacity-75'}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <Link href="/profile" className="inline-flex items-center gap-1.5 font-semibold">
            {me.nickname}
            {me.verified && (
              <span className="rounded-full bg-on-header px-1.5 py-0.5 text-[10px] font-semibold text-header">인증</span>
            )}
          </Link>
          {me.role === 'ADMIN' && (
            <Link href="/admin/verified-performers" className="opacity-75">어드민</Link>
          )}
          <button type="button" onClick={onLogout} className="opacity-75">로그아웃</button>
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd FE && npx vitest run __tests__/header.test.tsx
```

Expected: PASS (9 test)

- [ ] **Step 5: 커밋**

```bash
git add FE/components/layout/Header.tsx FE/__tests__/header.test.tsx
git commit -m "feat: 전역 헤더 컴포넌트(도메인 링크·활성 표시·신원·로그아웃)"
```

---

## Task 4: 루트 레이아웃 배치 + 문서 메타데이터

**Files:**
- Modify: `FE/app/layout.tsx`

- [ ] **Step 1: `layout.tsx`를 아래 내용으로 교체**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Attaca",
  description: "음악인 커뮤니티 — 연주회 소개, 구인, 연주자들의 소통",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Header />
        {children}
      </body>
    </html>
  );
}
```

`lang`을 `en`에서 `ko`로 바꾼 것도 포함한다. 화면 전체가 한국어인데 `en`으로 선언돼 있어 스크린리더가 잘못 읽는다.

- [ ] **Step 2: 빌드와 전체 테스트 확인**

```bash
cd FE && npx next build && npx vitest run
```

Expected: 빌드 성공, 테스트 **301 passed** (기준선 285 + Task 2의 7개 + Task 3의 9개).

- [ ] **Step 3: 커밋**

```bash
git add FE/app/layout.tsx
git commit -m "feat: 루트 레이아웃에 헤더 배치 + 문서 제목·lang 정정"
```

---

## Task 5: 홈을 피드로 전환하고 대시보드 제거

**Files:**
- Modify: `FE/app/page.tsx`
- Modify: `FE/app/(auth)/login/LoginForm.tsx:20`
- Modify: `FE/app/api/bff/oauth/kakao/callback/route.ts:29`
- Modify: `FE/app/admin/verified-performers/page.tsx:66`
- Delete: `FE/app/dashboard/page.tsx` (디렉터리째)
- Test: `FE/__tests__/kakao-callback.test.ts` (기존 갱신)
- Test: `FE/__tests__/admin-verified-performers-page.test.tsx` (기존 갱신)

- [ ] **Step 1: 기존 테스트를 새 기대값으로 고쳐 실패시키기**

`FE/__tests__/kakao-callback.test.ts` — `/dashboard`를 `/feed`로 바꾼다.

```ts
  it('state 통과 + BE 성공 → 인증 쿠키 설정 후 /feed', async () => {
```

같은 파일의 단언도 함께 바꾼다.

```ts
    expect(locationOf(res)).toBe('/feed');
```

`FE/__tests__/admin-verified-performers-page.test.tsx` — 비ADMIN 이동 대상을 바꾼다.

```ts
    await waitFor(() => expect(push).toHaveBeenCalledWith('/feed'));
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd FE && npx vitest run __tests__/kakao-callback.test.ts __tests__/admin-verified-performers-page.test.tsx
```

Expected: FAIL 2건 — `expected '/dashboard' to be '/feed'` 형태.

- [ ] **Step 3: 이동 대상 4곳을 `/feed`로 변경**

`FE/app/page.tsx` 전체:

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/feed');
}
```

`FE/app/(auth)/login/LoginForm.tsx:20` — `if (res.ok) router.push('/dashboard');` 를 다음으로:

```tsx
    if (res.ok) router.push('/feed');
```

`FE/app/api/bff/oauth/kakao/callback/route.ts:29` — `return redirect('/dashboard');` 를 다음으로:

```ts
  return redirect('/feed');
```

`FE/app/admin/verified-performers/page.tsx:66` — 비ADMIN 게이트를 다음으로:

```tsx
      if (me.role !== 'ADMIN') { router.push('/feed'); return; }
```

- [ ] **Step 4: 대시보드 삭제**

```bash
rm -rf FE/app/dashboard
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd FE && npx vitest run
```

Expected: 전체 통과. `/dashboard` 참조가 남아 있으면 여기서 드러난다.

- [ ] **Step 6: 잔여 참조가 없는지 확인**

```bash
cd FE && grep -rn "dashboard" app components lib middleware.ts __tests__ || echo "잔여 참조 없음"
```

Expected: `잔여 참조 없음` (프로필의 대시보드 버튼은 Task 7에서 제거하므로, 이 시점에는 `app/profile/page.tsx:107` 한 건이 남아 있어도 정상이다. 그 외 참조는 없어야 한다.)

- [ ] **Step 7: 커밋**

```bash
git add -A FE/app FE/__tests__
git commit -m "refactor: 홈을 /feed로 전환하고 대시보드 페이지 제거"
```

---

## Task 6: 미들웨어 보호 경로 수정 + 회귀 테스트

`/recruitments`가 matcher에서 빠져 있다. 2026-08-12 세 브랜치 병합 중 충돌 해소 과정에서 유실된 것으로 보인다. 같은 사고를 막는 테스트를 함께 넣는다.

**Files:**
- Modify: `FE/middleware.ts:22-26`
- Test: `FE/__tests__/middleware.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/middleware.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// middleware.ts가 next/server를 import하므로 목으로 대체한다.
// 이 테스트는 config.matcher만 검증하며 미들웨어 본문은 실행하지 않는다.
vi.mock('next/server', () => ({
  NextResponse: { redirect: vi.fn(), next: vi.fn() },
}));

import { config } from '@/middleware';

/** 인증이 필요한 모든 도메인 화면. 새 화면이 생기면 여기에도 추가한다. */
const PROTECTED_ROUTES = [
  '/profile',
  '/feed',
  '/performances',
  '/recruitments',
  '/verified-performer',
  '/admin',
  '/chat',
];

describe('middleware matcher', () => {
  it('보호 대상 화면을 하나도 빠뜨리지 않는다', () => {
    for (const route of PROTECTED_ROUTES) {
      expect(config.matcher).toContain(`${route}/:path*`);
    }
  });

  it('제거된 /dashboard는 포함하지 않는다', () => {
    expect(config.matcher.some((m) => m.startsWith('/dashboard'))).toBe(false);
  });

  it('보호 대상 외의 경로를 실수로 넣지 않는다', () => {
    expect(config.matcher).toHaveLength(PROTECTED_ROUTES.length);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd FE && npx vitest run __tests__/middleware.test.ts
```

Expected: FAIL — `/recruitments/:path*` 미포함, `/dashboard` 포함, 길이 불일치.

- [ ] **Step 3: matcher 수정**

`FE/middleware.ts`의 `config`를 다음으로 교체한다.

```ts
export const config = {
  matcher: [
    '/profile/:path*', '/feed/:path*', '/performances/:path*', '/recruitments/:path*',
    '/verified-performer/:path*', '/admin/:path*', '/chat/:path*',
  ],
};
```

Next는 matcher를 빌드 시점에 정적으로 읽으므로 **배열 리터럴을 계산식으로 바꾸지 말 것.**

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd FE && npx vitest run __tests__/middleware.test.ts
```

Expected: PASS (3 test)

- [ ] **Step 5: 커밋**

```bash
git add FE/middleware.ts FE/__tests__/middleware.test.ts
git commit -m "fix: 미들웨어 보호 경로에서 누락된 /recruitments 복구 + 회귀 테스트"
```

---

## Task 7: 프로필에 신원 표시와 내 지원 현황 링크

**Files:**
- Modify: `FE/app/profile/page.tsx`
- Test: `FE/__tests__/profile-page.test.tsx` (기존에 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`FE/__tests__/profile-page.test.tsx`의 `beforeEach` 안 `getBff.mockImplementation`에 신원 응답을 추가한다.

```ts
    if (path === '/api/bff/me/identity') return { ok: true, data: { id: 1, nickname: '스모크1', role: 'USER', verified: true }, message: null };
```

그리고 `describe('ProfilePage', ...)` 안에 테스트 3개를 추가한다.

```ts
  it('닉네임과 인증 뱃지를 보여준다', async () => {
    render(<ProfilePage />);
    expect(await screen.findByText('스모크1')).toBeInTheDocument();
    expect(screen.getByText('인증')).toBeInTheDocument();
  });

  it('인증되지 않은 회원에게는 뱃지를 보여주지 않는다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path === '/api/bff/me') return { ok: true, data: { instruments: [], bio: null, profileImageUrl: null }, message: null };
      if (path === '/api/bff/profile-options') return { ok: true, data: { instruments: [] }, message: null };
      if (path === '/api/bff/me/identity') return { ok: true, data: { id: 1, nickname: '스모크2', role: 'USER', verified: false }, message: null };
      return { ok: false, message: 'x' };
    });
    render(<ProfilePage />);
    await screen.findByText('스모크2');
    expect(screen.queryByText('인증')).not.toBeInTheDocument();
  });

  it('내 지원 현황으로 가는 링크가 있다', async () => {
    render(<ProfilePage />);
    const link = await screen.findByRole('link', { name: '내 지원 현황' });
    expect(link).toHaveAttribute('href', '/recruitments/applications/me');
  });
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd FE && npx vitest run __tests__/profile-page.test.tsx
```

Expected: FAIL 3건 — 닉네임·뱃지·링크를 찾지 못한다.

- [ ] **Step 3: 프로필 페이지 수정**

`FE/app/profile/page.tsx` 상단 import에 두 줄을 추가한다.

```tsx
import Link from 'next/link';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import type { Me } from '@/lib/feed/types';
```

`ProfilePage` 안 상태에 신원을 추가한다.

```tsx
  const [me, setMe] = useState<Me | null>(null);
```

기존 `useEffect`의 `Promise.all`에 신원 조회를 추가한다(기존 두 건과 함께 한 번에 받는다).

```tsx
  useEffect(() => {
    Promise.all([
      getBff('/api/bff/me'),
      getBff('/api/bff/profile-options'),
      getBff('/api/bff/me/identity'),
    ]).then(([profileRes, optionRes, identityRes]) => {
      if (!profileRes.ok) { router.push('/login'); return; }
      setProfile(profileRes.data as Profile);
      if (optionRes.ok) setOptions((optionRes.data as { instruments: Option[] }).instruments);
      if (identityRes.ok) setMe(identityRes.data as Me);
    });
  }, [router]);
```

제목 아래(사진 영역 위)에 신원 줄을 추가한다. `<h1>` 다음에 넣는다.

```tsx
      {me && (
        <p className="mb-4 text-sm">
          <AuthorBadge author={{ id: me.id, nickname: me.nickname, verified: me.verified }} />
        </p>
      )}
```

조회 모드의 버튼 줄(`app/profile/page.tsx:105-109`)을 다음으로 교체한다. 대시보드 버튼을 빼고 내 지원 현황을 넣는다.

```tsx
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={startEdit} className="rounded bg-brand px-4 py-2 text-on-brand">수정</button>
            <Link href="/recruitments/applications/me" className="rounded border border-line px-4 py-2 text-center">내 지원 현황</Link>
            <button onClick={() => router.push('/verified-performer')} className="rounded border border-line px-4 py-2 text-center">인증 연주자</button>
          </div>
```

`Author` 타입은 `FE/lib/feed/types.ts:1`에 `{ id: number; nickname: string; verified: boolean }`으로 정의돼 있어 `Me`의 해당 필드와 그대로 맞는다. 별도 변환이 필요 없다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd FE && npx vitest run __tests__/profile-page.test.tsx
```

Expected: PASS (기존 + 3건)

- [ ] **Step 5: 커밋**

```bash
git add FE/app/profile/page.tsx FE/__tests__/profile-page.test.tsx
git commit -m "feat: 프로필에 닉네임·인증뱃지 표시 + 내 지원 현황 링크"
```

---

## Task 8: 색 치환 — 인증 화면

여기서부터 Task 14까지는 **위 「치환 규칙」 표를 그대로** 적용하는 기계적 작업이다. 새 테스트는 만들지 않는다. 각 태스크의 검증은 (1) 기존 테스트 통과 (2) 해당 파일에 하드코딩 색이 남지 않았는지 grep 확인이다.

**Files:**
- Create: `FE/scripts/check-color-tokens.mjs` (Task 8~14 공통 검사 도구)
- Modify: `FE/app/(auth)/login/LoginForm.tsx` (색 4, bare border 2)
- Modify: `FE/app/(auth)/signup/page.tsx` (색 3, bare border 4)

- [ ] **Step 0: 전환 검사 스크립트 작성**

grep으로는 두 가지를 정확히 가려낼 수 없다 — `border border-line`은 올바른 최종 형태인데 "색 없는 border"로 잡히고, 카카오 버튼의 `text-black`은 정당하게 남는다. 조건부 className(템플릿 리터럴) 안의 색도 놓친다. Task 9~14가 모두 이 스크립트를 쓴다.

`FE/scripts/check-color-tokens.mjs`:

```js
// 색 토큰 전환이 끝났는지 검사한다. 인자로 경로를 주면 그 범위만 본다.
//   node scripts/check-color-tokens.mjs app/feed components/feed
//   node scripts/check-color-tokens.mjs            # 전체(app, components)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['app', 'components'];
const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white';
const HARDCODED = new RegExp(`(?:bg|text|border|ring|divide|placeholder)-(?:${PALETTE})(?:-\\d{2,3})?(?![\\w-])`, 'g');

// 카카오 브랜드 식별색. 배경이 노랑 고정이라 그 위 글자도 검정 고정이어야 한다.
const ALLOWED = [{ file: 'app/(auth)/login/LoginForm.tsx', classes: ['text-black'] }];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function allowedFor(file) {
  return ALLOWED.find((a) => file.endsWith(a.file))?.classes ?? [];
}

const problems = [];
for (const file of ROOTS.flatMap((r) => walk(r))) {
  const src = readFileSync(file, 'utf8');
  const allow = allowedFor(file);

  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(HARDCODED)) {
      if (!allow.includes(m[0])) problems.push(`${file}:${i + 1}  하드코딩 색 ${m[0]}`);
    }
  });

  // 테두리를 켜놓고(border, border-2, border-t ...) 색을 지정하지 않은 className
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const cls = (m[1] ?? m[2] ?? '').split(/\s+/);
    const drawsBorder = cls.some((c) => /^border(-[0-9]+|-[trblxy](-[0-9]+)?)?$/.test(c));
    const hasColor = cls.some((c) => /^border-(line|warn|success|danger|brand|brand-strong|current|transparent)$/.test(c));
    if (drawsBorder && !hasColor) {
      const line = src.slice(0, m.index).split('\n').length;
      problems.push(`${file}:${line}  테두리 색 미지정`);
    }
  }
}

if (problems.length) {
  console.error(`전환 미완료 ${problems.length}건:`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`색 토큰 전환 완료 (${ROOTS.join(', ')})`);
```

- [ ] **Step 1: 두 파일의 색 클래스를 치환 규칙에 따라 교체**

입력창·버튼의 색 없는 `border`는 모두 `border border-line`으로 바꾼다.

`LoginForm.tsx:43`의 카카오 버튼은 **한 글자도 건드리지 않는다.**

```tsx
        className="mt-3 block rounded bg-[#FEE500] py-2 text-center text-sm font-medium text-black">카카오 로그인</a>
```

배경이 카카오 브랜드 색으로 고정이므로 그 위 글자도 검정 고정이어야 한다. `text-black`을 `text-on-brand`로 바꾸면 라이트 모드에서 크림 글자가 노란 배경에 올라가 읽히지 않는다.

- [ ] **Step 2: 전환 검사**

```bash
cd FE && node scripts/check-color-tokens.mjs "app/(auth)"
```

Expected: `색 토큰 전환 완료 (app/(auth))`

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd FE && npx vitest run
```

Expected: 전체 통과. 색 교체로는 깨지지 않아야 정상이며, 깨진다면 클래스명에 의존하는 테스트가 새로 생겼다는 뜻이므로 원인을 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add FE/scripts/check-color-tokens.mjs "FE/app/(auth)"
git commit -m "style: 인증 화면 색 토큰 치환 + 전환 검사 스크립트 추가"
```

---

## Task 9: 색 치환 — 피드

**Files:**
- Modify: `FE/app/feed/page.tsx` (색 3, bare border 1)
- Modify: `FE/app/feed/[id]/page.tsx` (색 12, bare border 4)
- Modify: `FE/components/feed/AuthorBadge.tsx` (색 2)
- Modify: `FE/components/feed/CommentItem.tsx` (색 2)
- Modify: `FE/components/feed/ComposeForm.tsx` (색 3, bare border 1)
- Modify: `FE/components/feed/LikeButton.tsx` (색 2)
- Modify: `FE/components/feed/PostCard.tsx` (색 2, bare border 1)

- [ ] **Step 1: 치환 규칙 적용**

`AuthorBadge.tsx`의 인증 칩은 다음이 된다.

```tsx
        <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] text-on-brand">인증</span>
```

`PostCard.tsx`의 카드 컨테이너에는 `bg-surface`를 추가한다.

```tsx
      className="cursor-pointer rounded-lg border border-line bg-surface p-4"
```

`LikeButton.tsx:6`의 활성 색은 **에러가 아니라 좋아요 표시**다. `text-danger`로 바꾸면 하트가 에러색과 같아져 상태색 체계가 흐려진다. 다음으로 바꾼다.

```tsx
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm ${liked ? 'text-brand-strong' : 'text-ink-muted'}`}
```

- [ ] **Step 2: 전환 검사**

```bash
cd FE && node scripts/check-color-tokens.mjs app/feed components/feed
```

Expected: `색 토큰 전환 완료 (app/feed, components/feed)`

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd FE && npx vitest run
```

Expected: 전체 통과.

- [ ] **Step 4: 커밋**

```bash
git add FE/app/feed FE/components/feed
git commit -m "style: 피드 화면 색 토큰 치환"
```

---

## Task 10: 색 치환 — 공연

**Files:**
- Modify: `FE/app/performances/page.tsx` (색 9)
- Modify: `FE/app/performances/new/page.tsx` (색 5)
- Modify: `FE/app/performances/[id]/page.tsx` (색 17, bare border 1)
- Modify: `FE/app/performances/[id]/edit/page.tsx` (색 4, bare border 1)
- Modify: `FE/components/performance/PerformanceCard.tsx` (색 4, bare border 1)
- Modify: `FE/components/performance/PerformanceForm.tsx` (색 10, bare border 7)

- [ ] **Step 1: 치환 규칙 적용**

목록의 scope 탭은 선택 `bg-black text-white` → `bg-brand text-on-brand`, 미선택 `bg-gray-100 text-gray-700` → `bg-surface-2 text-ink-muted`가 된다.

`PerformanceCard.tsx`의 카드 컨테이너에 `bg-surface`를 추가한다.

`app/performances/[id]/page.tsx:52`의 포스터 업로드 실패 배너는 다음이 된다.

```tsx
        <p className="mb-4 rounded border border-warn bg-surface-2 px-3 py-2 text-sm text-warn">
```

- [ ] **Step 2: 전환 검사**

```bash
cd FE && node scripts/check-color-tokens.mjs app/performances components/performance
```

Expected: `색 토큰 전환 완료 (app/performances, components/performance)`

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd FE && npx vitest run
```

Expected: 전체 통과.

- [ ] **Step 4: 커밋**

```bash
git add FE/app/performances FE/components/performance
git commit -m "style: 공연 화면 색 토큰 치환"
```

---

## Task 11: 색 치환 — 구인

**Files:**
- Modify: `FE/app/recruitments/page.tsx` (색 10, bare border 1)
- Modify: `FE/app/recruitments/new/page.tsx` (색 2)
- Modify: `FE/app/recruitments/[id]/page.tsx` (색 16)
- Modify: `FE/app/recruitments/[id]/edit/page.tsx` (색 2)
- Modify: `FE/app/recruitments/applications/me/page.tsx` (색 3)
- Modify: `FE/components/recruitment/ApplicantList.tsx` (색 5, bare border 2)
- Modify: `FE/components/recruitment/ApplicationCard.tsx` (색 3, bare border 2)
- Modify: `FE/components/recruitment/ApplyPanel.tsx` (색 8, bare border 4)
- Modify: `FE/components/recruitment/InstrumentPicker.tsx` (색 4)
- Modify: `FE/components/recruitment/PostingCard.tsx` (색 4, bare border 1)
- Modify: `FE/components/recruitment/PostingForm.tsx` (색 10, bare border 6)

- [ ] **Step 1: 치환 규칙 적용**

`InstrumentPicker.tsx`의 선택 칩은 `bg-brand text-on-brand`, 미선택 칩은 `bg-surface-2 text-ink-muted`가 된다. 프로필 화면의 악기 칩과 같은 규칙이다.

`PostingCard.tsx`·`ApplicationCard.tsx`의 카드 컨테이너에 `bg-surface`를 추가한다.

`ApplyPanel.tsx:17`의 "지원 완료" 표시는 다음이 된다. 프로젝트에서 `success` 토큰을 쓰는 유일한 자리다.

```tsx
    return <p className="rounded border border-success bg-surface-2 px-3 py-2 text-sm text-success">지원 완료</p>;
```

- [ ] **Step 2: 전환 검사**

```bash
cd FE && node scripts/check-color-tokens.mjs app/recruitments components/recruitment
```

Expected: `색 토큰 전환 완료 (app/recruitments, components/recruitment)`

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd FE && npx vitest run
```

Expected: 전체 통과.

- [ ] **Step 4: 커밋**

```bash
git add FE/app/recruitments FE/components/recruitment
git commit -m "style: 구인 화면 색 토큰 치환"
```

---

## Task 12: 색 치환 — 인증 연주자

**Files:**
- Modify: `FE/app/verified-performer/page.tsx` (색 2)
- Modify: `FE/components/verification/ApplyForm.tsx` (색 5, bare border 1)
- Modify: `FE/components/verification/ApplicationReviewItem.tsx` (색 9, bare border 6)
- Modify: `FE/components/verification/EvidenceUrlsInput.tsx` (bare border 3)
- Modify: `FE/components/verification/GrantForm.tsx` (색 4, bare border 3)
- Modify: `FE/components/verification/MyStatusCard.tsx` (색 5, bare border 1)

- [ ] **Step 1: 치환 규칙 적용**

이 그룹에는 상태색(amber/green)이 **하나도 없다.** 전수 조사로 확인했다 — `MyStatusCard.tsx`는 `text-gray-500/700`과 `text-indigo-600`만 쓴다. 승인/거절/철회 상태를 색이 아니라 문구로 구분하고 있으므로, 치환 규칙대로 `text-ink-muted`·`text-brand-strong`으로만 바꾸고 새 상태색을 임의로 도입하지 않는다.

`EvidenceUrlsInput.tsx`는 색 클래스가 없고 색 없는 `border`만 3곳 있다. `border border-line`으로만 바꾼다.

- [ ] **Step 2: 전환 검사**

```bash
cd FE && node scripts/check-color-tokens.mjs app/verified-performer components/verification
```

Expected: `색 토큰 전환 완료 (app/verified-performer, components/verification)`

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd FE && npx vitest run
```

Expected: 전체 통과.

- [ ] **Step 4: 커밋**

```bash
git add FE/app/verified-performer FE/components/verification
git commit -m "style: 인증 연주자 화면 색 토큰 치환"
```

---

## Task 13: 색 치환 — 채팅

**Files:**
- Modify: `FE/app/chat/page.tsx` (색 5)
- Modify: `FE/app/chat/[id]/page.tsx` (색 4)
- Modify: `FE/components/chat/MessageBubble.tsx` (색 6)
- Modify: `FE/components/chat/MessageComposer.tsx` (색 3, bare border 1)
- Modify: `FE/components/chat/NewChatForm.tsx` (색 4, bare border 2)
- Modify: `FE/components/chat/RoomListItem.tsx` (색 3, bare border 1)

- [ ] **Step 1: 치환 규칙 적용**

`MessageBubble.tsx`가 핵심이다. 내 말풍선은 `bg-brand text-on-brand`, 상대 말풍선은 `bg-surface-2 text-ink`가 된다. 두 말풍선이 같은 색이 되지 않도록 확인한다.

`app/chat/[id]/page.tsx:94`의 연결 끊김 배너는 다음이 된다.

```tsx
      {connError && <p className="mb-2 rounded bg-surface-2 px-3 py-1 text-xs text-warn">실시간 연결이 끊겼습니다. 재연결 중…</p>}
```

`RoomListItem.tsx`의 안읽은 배지는 `bg-brand text-on-brand`가 된다.

- [ ] **Step 2: 전환 검사**

```bash
cd FE && node scripts/check-color-tokens.mjs app/chat components/chat
```

Expected: `색 토큰 전환 완료 (app/chat, components/chat)`

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd FE && npx vitest run
```

Expected: 전체 통과.

- [ ] **Step 4: 커밋**

```bash
git add FE/app/chat FE/components/chat
git commit -m "style: 채팅 화면 색 토큰 치환"
```

---

## Task 14: 색 치환 — 어드민·프로필 마무리

**Files:**
- Modify: `FE/app/admin/verified-performers/page.tsx` (색 9)
- Modify: `FE/app/profile/page.tsx` (색 19, bare border 5 — Task 7에서 일부만 손댔다)

- [ ] **Step 1: 치환 규칙 적용**

프로필의 악기 칩(`bg-indigo-100 text-indigo-800`)은 `bg-brand text-on-brand`가 된다. 어드민의 status 탭은 공연 목록의 scope 탭과 같은 규칙이다.

- [ ] **Step 2: 앱 전체 전환 검사**

Task 8에서 만든 스크립트를 인자 없이 실행하면 `app`·`components` 전체를 본다.

```bash
cd FE && node scripts/check-color-tokens.mjs
```

Expected: `색 토큰 전환 완료 (app, components)`

미완료 항목이 나오면 해당 파일을 치환 규칙에 따라 고치고 다시 실행한다. 조건부 className(템플릿 리터럴) 안의 색도 이 검사에 걸린다.

- [ ] **Step 3: package.json에 검사 스크립트 등록**

`FE/package.json`의 `scripts`에 다음을 추가해, 앞으로 색을 되돌리는 변경이 들어오면 바로 잡히게 한다.

```json
    "check:colors": "node scripts/check-color-tokens.mjs"
```

```bash
cd FE && npm run check:colors
```

Expected: `색 토큰 전환 완료 (app, components)`


- [ ] **Step 4: 전체 테스트와 빌드 확인**

```bash
cd FE && npx vitest run && npx eslint app components lib && npx next build
```

Expected: 테스트 전체 통과, lint 에러 없음, 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add FE/app/admin FE/app/profile FE/package.json
git commit -m "style: 어드민·프로필 색 토큰 치환 및 전면 전환 완료"
```

---

## Task 15: 라이트/다크 실화면 검증

**자동 테스트로 검증되지 않는 유일한 부분이며, 생략하지 않는다.** 2026-08-18 채팅 결함이 "테스트는 전부 통과하는데 화면에서는 동작하지 않는" 유형이었다.

- [ ] **Step 1: BE·FE 기동**

```bash
docker compose up -d
```

BE(별도 셸):

```bash
export JAVA_HOME=/Users/predevho/Library/Java/JavaVirtualMachines/graalvm-jdk-21.0.7/Contents/Home
cd BE && ./gradlew bootRun "--args=--spring.datasource.password=attaca-local --server.port=8081 --storage.local.base-url=http://localhost:8081/files"
```

FE(별도 셸):

```bash
cd FE && npm run dev -- -p 3001
```

- [ ] **Step 2: 라이트 모드로 8개 화면 확인**

OS 설정을 라이트로 두고 아래를 순서대로 연다. 각 화면에서 **헤더가 보이는지, 활성 링크가 표시되는지, 글자가 배경에 묻히지 않는지** 본다.

`/feed` · `/feed/[id]` · `/performances` · `/recruitments` · `/recruitments/[id]` · `/chat/[id]` · `/profile` · `/admin/verified-performers`

- [ ] **Step 3: 다크 모드로 같은 8개 화면 확인**

OS 설정을 다크로 바꾸고 같은 경로를 다시 연다. **헤더가 밝은 표지 + 검정 글자로 반전되는지** 확인한다. 반전되지 않으면 `--header`/`--on-header`가 미디어쿼리 안에 들어갔는지 본다.

- [ ] **Step 4: 헤더 노출 규칙 확인**

- `/login`·`/signup`에서 헤더가 **보이지 않아야** 한다.
- 로그아웃 후 `/login`으로 이동하고, 다시 로그인하면 헤더가 다시 나타나야 한다.
- ADMIN 계정에서만 "어드민" 링크가 보여야 한다.

- [ ] **Step 5: 좁은 화면 확인**

브라우저 폭을 375px로 줄여 헤더가 두 줄로 접히는지, 링크가 잘리지 않는지 확인한다.

- [ ] **Step 6: 발견한 문제를 기록**

색이 어긋난 곳, 대비가 부족한 곳, 카드 배경이 빠진 곳을 목록으로 정리한다. 사소한 것은 그 자리에서 고치고, 판단이 필요한 것은 보고한다.

- [ ] **Step 7: 수정 사항이 있으면 커밋**

```bash
git add -A FE
git commit -m "fix: 실화면 검증에서 발견한 색 적용 누락 수정"
```

---

## Task 16: 파비콘 교체

**Files:**
- Modify: `FE/app/favicon.ico` (또는 `FE/app/icon.svg` 신규)

- [ ] **Step 1: 브랜드 색 기반 아이콘 생성**

`FE/app/icon.svg`를 만든다. Next App Router는 `icon.svg`가 있으면 이를 우선 사용한다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#3d5a80"/>
  <text x="32" y="45" font-family="Georgia, serif" font-size="40" font-weight="700"
        text-anchor="middle" fill="#f5f0e6">A</text>
</svg>
```

- [ ] **Step 2: 기본 파비콘 제거**

```bash
rm FE/app/favicon.ico
```

- [ ] **Step 3: 빌드 확인 후 브라우저 탭에서 아이콘과 제목 확인**

```bash
cd FE && npx next build
```

Expected: 성공. 개발 서버에서 탭에 `Attaca`와 새 아이콘이 보인다.

- [ ] **Step 4: 커밋**

```bash
git add -A FE/app
git commit -m "feat: 브랜드 색 기반 파비콘 교체"
```

---

## 완료 후

- [ ] `docs/CONTEXT.md`에 색 토큰 체계와 헤더 구조를 반영한다.
- [ ] `docs/TODO-DONE.md`에 완료 기록, `docs/TODO-BACKLOG.md`에서 해소된 항목(전역 내비게이션 부재, 프로필 닉네임·뱃지 미표시)을 정리한다.
- [ ] `docs/AI-ACTION-LOGS.md`에 작업 로그를 남긴다.
- [ ] 노션 TODO 보드에 반영한다.
- [ ] 다크모드 전환으로 해소되지 않은 a11y 항목(카드 키보드 도달, 접근명 부여)은 BACKLOG에 남겨 둔다 — 이번 범위가 아니다.
