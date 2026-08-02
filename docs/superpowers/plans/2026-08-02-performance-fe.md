# 공연(PERFORMANCE) FE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BE PERFORMANCE 도메인(완료) 위에 목록/등록/상세/수정/포스터 FE 화면을 붙인다. 피드 FE가 만든 자산(무한스크롤 훅·권한·프록시·신원·AuthorBadge)을 재사용한다.

**Architecture:** BFF 3계층 + Vitest TDD. 오프셋 페이징(Spring Page)을 `toCursorPage` 순수 변환으로 감싸 기존 `useInfiniteList`를 그대로 재사용한다. 등록은 텍스트 생성 → 포스터 업로드 2단계(포스터 실패는 안내만).

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript / Tailwind / Vitest + Testing Library.

## Global Constraints

- 토큰은 httpOnly 쿠키. UI는 same-origin BFF만 호출. 신규 BFF 라우트는 `proxyAuthed`(status||502) 사용.
- Next.js 16 동적 라우트 params는 Promise: `const { id } = await params`.
- BFF 라우트 테스트: `// @vitest-environment node`, `vi.mock('next/headers')`, `vi.stubGlobal('fetch', ...)`, 동적 ctx `{ params: Promise.resolve({ id }) }`.
- 페이지/컴포넌트 테스트: jsdom + Testing Library. `next/navigation`(useRouter/useParams/useSearchParams) 목, `@/lib/api` 목.
- 커밋 전 `npx eslint <파일>`로 에러 0 확인(특히 hook 규칙). `npm run build`는 eslint 에러 시 실패.
- BE `PerformanceRequest` 검증: title 필수·≤100 / venue 필수·≤200 / performedAt 필수(LocalDateTime) / description·program ≤2000 / ticketInfo ≤200 / ticketUrl ≤500. 위반은 BE 400-01.
- BE 목록 응답은 Spring `Page`: `{ content, number, totalPages, last, ... }`. FE는 `content/number/last`만 소비.
- `PerformanceResponse.organizer`는 `MemberDisplay` → `{id, nickname, verified}`로 직렬화(2026-08-02 author.id 정합 반영). `organizer.id` 신뢰.
- 에러코드: 404-07(PERFORMANCE_NOT_FOUND) / 403-02(NOT_VERIFIED_PERFORMER) / 403-01(FORBIDDEN).
- 커밋 메시지 한글. 작업 디렉터리 FE(모든 명령 `cd FE`).

---

## File Structure

- Create: `FE/lib/performance/types.ts` — 도메인 타입 (Task 1)
- Create: `FE/lib/performance/logic.ts` — 순수 함수(toCursorPage/validatePerformance/formatDateTime) (Task 1)
- Create: `FE/app/api/bff/performances/route.ts` (GET/POST) (Task 2)
- Create: `FE/app/api/bff/performances/[id]/route.ts` (GET/PUT/DELETE) (Task 2)
- Create: `FE/app/api/bff/performances/[id]/poster/route.ts` (PUT multipart) (Task 2)
- Modify: `FE/middleware.ts` — `/performances/:path*` (Task 2)
- Create: `FE/components/performance/PerformanceForm.tsx` (Task 3)
- Create: `FE/components/performance/PerformanceCard.tsx` (Task 3)
- Create: `FE/app/performances/page.tsx` (목록) (Task 4)
- Create: `FE/app/performances/new/page.tsx` (등록) (Task 5)
- Create: `FE/app/performances/[id]/page.tsx` (상세) (Task 6)
- Create: `FE/app/performances/[id]/edit/page.tsx` (수정) (Task 7)
- Reuse (no change): `FE/lib/feed/useInfiniteList.ts`, `FE/lib/feed/logic.ts`(canEdit/canDelete), `FE/lib/feed/types.ts`(Author/CursorPage), `FE/lib/server/bffProxy.ts`, `FE/components/feed/AuthorBadge.tsx`, `FE/lib/api.ts`(getBff/postBff/putBff/deleteBff/putBffForm).

---

## Task 1: 타입 + 순수 로직

**Files:**
- Create: `FE/lib/performance/types.ts`
- Create: `FE/lib/performance/logic.ts`
- Test: `FE/__tests__/performance-logic.test.ts`

**Interfaces:**
- Produces:
  - `PerformanceScope = 'UPCOMING'|'PAST'|'ALL'`
  - `Performance` (id, organizer:Author, title, description|null, performedAt, venue, program|null, ticketInfo|null, ticketUrl|null, posterImageUrl|null, createdAt, updatedAt)
  - `PerformanceFormValues` (7 string fields)
  - `SpringPage<T> = { content:T[]; number:number; totalPages:number; last:boolean }`
  - `toCursorPage(page:SpringPage<Performance>):CursorPage<Performance>`
  - `validatePerformance(v:PerformanceFormValues):string|null`
  - `formatDateTime(iso:string):string`

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/performance-logic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toCursorPage, validatePerformance, formatDateTime } from '@/lib/performance/logic';
import type { PerformanceFormValues } from '@/lib/performance/types';

const base: PerformanceFormValues = {
  title: '공연', description: '', performedAt: '2026-09-01T19:30', venue: '홀', program: '', ticketInfo: '', ticketUrl: '',
};

describe('toCursorPage', () => {
  it('마지막 페이지가 아니면 nextCursor=number+1', () => {
    expect(toCursorPage({ content: [{ id: 1 } as never], number: 0, totalPages: 3, last: false }))
      .toEqual({ items: [{ id: 1 }], nextCursor: 1 });
  });
  it('마지막 페이지면 nextCursor=null', () => {
    expect(toCursorPage({ content: [], number: 2, totalPages: 3, last: true }))
      .toEqual({ items: [], nextCursor: null });
  });
});

describe('validatePerformance', () => {
  it('유효하면 null', () => expect(validatePerformance(base)).toBeNull());
  it('공연명 없으면 에러', () => expect(validatePerformance({ ...base, title: '  ' })).toMatch(/공연명/));
  it('장소 없으면 에러', () => expect(validatePerformance({ ...base, venue: '' })).toMatch(/장소/));
  it('일시 없으면 에러', () => expect(validatePerformance({ ...base, performedAt: '' })).toMatch(/일시/));
  it('공연명 100자 초과 에러', () => expect(validatePerformance({ ...base, title: 'a'.repeat(101) })).toMatch(/100자/));
  it('링크 500자 초과 에러', () => expect(validatePerformance({ ...base, ticketUrl: 'a'.repeat(501) })).toMatch(/500자/));
});

describe('formatDateTime', () => {
  it('ISO LocalDateTime을 YYYY.MM.DD HH:mm로', () => {
    expect(formatDateTime('2026-09-01T19:30:00')).toBe('2026.09.01 19:30');
  });
  it('초 없는 값도 처리', () => expect(formatDateTime('2026-09-01T19:30')).toBe('2026.09.01 19:30'));
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/performance-logic.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 타입 작성**

`FE/lib/performance/types.ts`:

```ts
import type { Author } from '@/lib/feed/types';

export type PerformanceScope = 'UPCOMING' | 'PAST' | 'ALL';

export type Performance = {
  id: number;
  organizer: Author;
  title: string;
  description: string | null;
  performedAt: string;
  venue: string;
  program: string | null;
  ticketInfo: string | null;
  ticketUrl: string | null;
  posterImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 등록/수정 폼 값(모두 문자열, BE PerformanceRequest로 그대로 전송). */
export type PerformanceFormValues = {
  title: string;
  description: string;
  performedAt: string;
  venue: string;
  program: string;
  ticketInfo: string;
  ticketUrl: string;
};

/** Spring Page 응답 중 FE가 쓰는 필드만. */
export type SpringPage<T> = { content: T[]; number: number; totalPages: number; last: boolean };
```

- [ ] **Step 4: 로직 작성**

`FE/lib/performance/logic.ts`:

```ts
import type { CursorPage } from '@/lib/feed/types';
import type { Performance, PerformanceFormValues, SpringPage } from '@/lib/performance/types';

/** Spring Page(오프셋)를 커서 페이지 계약으로 변환 → useInfiniteList 재사용. cursor=페이지 번호. */
export function toCursorPage(page: SpringPage<Performance>): CursorPage<Performance> {
  return { items: page.content, nextCursor: page.last ? null : page.number + 1 };
}

/** 클라이언트 측 폼 검증. 첫 에러 메시지 또는 null. BE PerformanceRequest 규칙과 일치. */
export function validatePerformance(v: PerformanceFormValues): string | null {
  if (!v.title.trim()) return '공연명을 입력해 주세요.';
  if (v.title.length > 100) return '공연명은 100자를 넘을 수 없습니다.';
  if (!v.performedAt) return '공연 일시를 입력해 주세요.';
  if (!v.venue.trim()) return '장소를 입력해 주세요.';
  if (v.venue.length > 200) return '장소는 200자를 넘을 수 없습니다.';
  if (v.description.length > 2000) return '소개는 2000자를 넘을 수 없습니다.';
  if (v.program.length > 2000) return '프로그램은 2000자를 넘을 수 없습니다.';
  if (v.ticketInfo.length > 200) return '관람료 안내는 200자를 넘을 수 없습니다.';
  if (v.ticketUrl.length > 500) return '링크는 500자를 넘을 수 없습니다.';
  return null;
}

/** ISO LocalDateTime("2026-09-01T19:30[:ss]")을 "YYYY.MM.DD HH:mm"로. 타임존 없음(문자열 파싱). */
export function formatDateTime(iso: string): string {
  const [d, t = ''] = iso.split('T');
  const [y, m, day] = d.split('-');
  const [hh = '00', mm = '00'] = t.split(':');
  return `${y}.${m}.${day} ${hh}:${mm}`;
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd FE && npx vitest run __tests__/performance-logic.test.ts`
Expected: PASS (전부)

- [ ] **Step 6: 커밋**

```bash
git add FE/lib/performance FE/__tests__/performance-logic.test.ts
git commit -m "feat: 공연 FE 타입·순수 로직(오프셋→커서 변환/폼 검증/일시 포맷)"
```

---

## Task 2: BFF 라우트 + 미들웨어

**Files:**
- Create: `FE/app/api/bff/performances/route.ts`
- Create: `FE/app/api/bff/performances/[id]/route.ts`
- Create: `FE/app/api/bff/performances/[id]/poster/route.ts`
- Modify: `FE/middleware.ts`
- Test: `FE/__tests__/bff-performances.test.ts`

**Interfaces:**
- Consumes: `proxyAuthed` (기존).
- Produces:
  - `GET /api/bff/performances?scope=&page=&size=` → BE `/api/performances` (쿼리 전달)
  - `POST /api/bff/performances` → BE 등록
  - `GET/PUT/DELETE /api/bff/performances/[id]` → BE 단건/수정/삭제
  - `PUT /api/bff/performances/[id]/poster` (멀티파트, file 파트 없으면 400)
  - `/performances/:path*` 인증 보호

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/bff-performances.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const jar: Record<string, string> = { access_token: 'A' };
const cookieStore = {
  set: vi.fn((n: string, v: string) => { jar[n] = v; }),
  delete: vi.fn((n: string) => { delete jar[n]; }),
  get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
};
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

function beJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const okFetch = () => vi.fn(async () => beJson({ success: true, data: null, error: null }));

describe('BFF 공연 라우트', () => {
  it('GET 목록은 scope/page 쿼리를 BE로 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/performances/route');
    const res = await GET(new Request('http://x/api/bff/performances?scope=PAST&page=2&size=20'));
    expect(res.status).toBe(200);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/performances');
    expect(url).toContain('scope=PAST');
    expect(url).toContain('page=2');
  });

  it('POST 등록은 본문을 BE로 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { id: 1 }, error: null }));
    vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/performances/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: '공연' }) }));
    expect(res.status).toBe(200);
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('PUT 단건 수정은 BE 단건 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { PUT } = await import('@/app/api/bff/performances/[id]/route');
    await PUT(new Request('http://x', { method: 'PUT', body: '{}' }), { params: Promise.resolve({ id: '7' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/performances/7');
  });

  it('DELETE 단건은 BE 단건 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { DELETE } = await import('@/app/api/bff/performances/[id]/route');
    await DELETE(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ id: '7' }) });
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
    expect(String(f.mock.calls[0][0])).toContain('/api/performances/7');
  });

  it('포스터 PUT은 file 파트가 있으면 FormData로 BE 포스터 경로에 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { id: 7, posterImageUrl: 'http://x/p.png' }, error: null }));
    vi.stubGlobal('fetch', f);
    const { PUT } = await import('@/app/api/bff/performances/[id]/poster/route');
    const fd = new FormData();
    fd.append('file', new Blob(['img'], { type: 'image/png' }), 'p.png');
    const res = await PUT(new Request('http://x', { method: 'PUT', body: fd }), { params: Promise.resolve({ id: '7' }) });
    expect(res.status).toBe(200);
    expect(String(f.mock.calls[0][0])).toContain('/api/performances/7/poster');
    expect((f.mock.calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
  });

  it('포스터 PUT은 file 파트 없으면 400', async () => {
    const { PUT } = await import('@/app/api/bff/performances/[id]/poster/route');
    const res = await PUT(new Request('http://x', { method: 'PUT', body: new FormData() }), { params: Promise.resolve({ id: '7' }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/bff-performances.test.ts`
Expected: FAIL (라우트 없음)

- [ ] **Step 3: 목록/등록 라우트**

`FE/app/api/bff/performances/route.ts`:

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?scope=&page=&size=
  return proxyAuthed('/api/performances' + search);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAuthed('/api/performances', { method: 'POST', body });
}
```

- [ ] **Step 4: 단건/수정/삭제 라우트**

`FE/app/api/bff/performances/[id]/route.ts`:

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/performances/${id}`);
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/performances/${id}`, { method: 'PUT', body });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/performances/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 5: 포스터 라우트**

`FE/app/api/bff/performances/[id]/poster/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const incoming = await request.formData();
  const file = incoming.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, message: '이미지 파일이 필요합니다.' }, { status: 400 });
  }
  const forward = new FormData();
  forward.append('file', file, (file as File).name ?? 'upload');
  return proxyAuthed(`/api/performances/${id}/poster`, { method: 'PUT', body: forward });
}
```

- [ ] **Step 6: 미들웨어 matcher**

`FE/middleware.ts`의 마지막 줄을 교체:

```ts
export const config = { matcher: ['/dashboard/:path*', '/profile/:path*', '/feed/:path*', '/performances/:path*'] };
```

- [ ] **Step 7: 통과 확인 + 회귀**

Run: `cd FE && npx vitest run __tests__/bff-performances.test.ts && npm run test`
Expected: 신규 6건 PASS + 전체 회귀 PASS

- [ ] **Step 8: 커밋**

```bash
git add FE/app/api/bff/performances FE/middleware.ts FE/__tests__/bff-performances.test.ts
git commit -m "feat: BFF 공연 라우트(목록/등록/단건/수정/삭제/포스터) + /performances 인증 보호"
```

---

## Task 3: PerformanceForm / PerformanceCard 컴포넌트

**Files:**
- Create: `FE/components/performance/PerformanceForm.tsx`
- Create: `FE/components/performance/PerformanceCard.tsx`
- Test: `FE/__tests__/performance-components.test.tsx`

**Interfaces:**
- Consumes: `validatePerformance`/`formatDateTime` (Task 1), `AuthorBadge` (기존), types (Task 1).
- Produces:
  - `PerformanceForm({ initial, submitting, submitLabel, onSubmit }: { initial?: Partial<PerformanceFormValues>; submitting: boolean; submitLabel: string; onSubmit: (v: PerformanceFormValues) => void })` — 7필드 controlled 폼, 제출 전 `validatePerformance`로 검증(실패 시 인라인 에러, onSubmit 미호출).
  - `PerformanceCard({ performance, onOpen }: { performance: Performance; onOpen: () => void })` — 포스터 썸네일/제목/주최자/일시·장소, 카드 클릭 onOpen.

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/performance-components.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerformanceForm } from '@/components/performance/PerformanceForm';
import { PerformanceCard } from '@/components/performance/PerformanceCard';
import type { Performance } from '@/lib/performance/types';

describe('PerformanceForm', () => {
  it('필수 누락이면 onSubmit 미호출하고 에러 표시', () => {
    const onSubmit = vi.fn();
    render(<PerformanceForm submitting={false} submitLabel="등록" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/공연명/)).toBeInTheDocument();
  });

  it('유효 입력이면 값과 함께 onSubmit 호출', () => {
    const onSubmit = vi.fn();
    render(<PerformanceForm submitting={false} submitLabel="등록" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('공연명'), { target: { value: '가을 리사이틀' } });
    fireEvent.change(screen.getByLabelText('공연 일시'), { target: { value: '2026-09-01T19:30' } });
    fireEvent.change(screen.getByLabelText('장소'), { target: { value: '예술의전당' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: '가을 리사이틀', performedAt: '2026-09-01T19:30', venue: '예술의전당',
    }));
  });

  it('초기값을 채운다', () => {
    render(<PerformanceForm initial={{ title: '기존공연' }} submitting={false} submitLabel="저장" onSubmit={vi.fn()} />);
    expect((screen.getByLabelText('공연명') as HTMLInputElement).value).toBe('기존공연');
  });
});

describe('PerformanceCard', () => {
  const perf: Performance = {
    id: 1, organizer: { id: 5, nickname: '연주자', verified: true }, title: '가을 리사이틀',
    description: null, performedAt: '2026-09-01T19:30:00', venue: '예술의전당', program: null,
    ticketInfo: null, ticketUrl: null, posterImageUrl: null, createdAt: 'x', updatedAt: 'x',
  };
  it('제목/주최자/일시·장소를 보여주고 클릭 시 onOpen', () => {
    const onOpen = vi.fn();
    render(<PerformanceCard performance={perf} onOpen={onOpen} />);
    expect(screen.getByText('가을 리사이틀')).toBeInTheDocument();
    expect(screen.getByText('연주자')).toBeInTheDocument();
    expect(screen.getByText(/2026\.09\.01 19:30/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('가을 리사이틀'));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/performance-components.test.tsx`
Expected: FAIL

- [ ] **Step 3: PerformanceForm 작성**

`FE/components/performance/PerformanceForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { validatePerformance } from '@/lib/performance/logic';
import type { PerformanceFormValues } from '@/lib/performance/types';

const EMPTY: PerformanceFormValues = {
  title: '', description: '', performedAt: '', venue: '', program: '', ticketInfo: '', ticketUrl: '',
};

export function PerformanceForm({
  initial, submitting, submitLabel, onSubmit,
}: {
  initial?: Partial<PerformanceFormValues>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (v: PerformanceFormValues) => void;
}) {
  const [v, setV] = useState<PerformanceFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);

  function field<K extends keyof PerformanceFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((cur) => ({ ...cur, [key]: e.target.value }));
  }

  function submit() {
    const err = validatePerformance(v);
    if (err) { setError(err); return; }
    setError(null);
    onSubmit(v);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">공연명</span>
        <input aria-label="공연명" value={v.title} maxLength={100} onChange={field('title')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">공연 일시</span>
        <input aria-label="공연 일시" type="datetime-local" value={v.performedAt} onChange={field('performedAt')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">장소</span>
        <input aria-label="장소" value={v.venue} maxLength={200} onChange={field('venue')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">소개</span>
        <textarea aria-label="소개" value={v.description} maxLength={2000} onChange={field('description')}
          className="h-24 rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">프로그램</span>
        <textarea aria-label="프로그램" value={v.program} maxLength={2000} onChange={field('program')}
          className="h-24 rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">관람료 안내</span>
        <input aria-label="관람료 안내" value={v.ticketInfo} maxLength={200} onChange={field('ticketInfo')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">티켓 링크</span>
        <input aria-label="티켓 링크" value={v.ticketUrl} maxLength={500} onChange={field('ticketUrl')}
          className="rounded border px-3 py-2" />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={submit} disabled={submitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-40">
        {submitting ? '처리 중...' : submitLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: PerformanceCard 작성**

`FE/components/performance/PerformanceCard.tsx`:

```tsx
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { formatDateTime } from '@/lib/performance/logic';
import type { Performance } from '@/lib/performance/types';

export function PerformanceCard({ performance, onOpen }: { performance: Performance; onOpen: () => void }) {
  return (
    <article onClick={onOpen} className="flex cursor-pointer gap-4 rounded-lg border p-4">
      {performance.posterImageUrl
        ? <img src={performance.posterImageUrl} alt="" className="h-24 w-16 flex-shrink-0 rounded object-cover" />
        : <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center rounded bg-gray-200 text-center text-[10px] text-gray-500">포스터 없음</div>}
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{performance.title}</h3>
        <div className="mt-1 text-sm text-gray-600"><AuthorBadge author={performance.organizer} /></div>
        <p className="mt-1 text-sm text-gray-500">{formatDateTime(performance.performedAt)} · {performance.venue}</p>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: 통과 확인 + lint**

Run: `cd FE && npx vitest run __tests__/performance-components.test.tsx && npx eslint components/performance/`
Expected: PASS + eslint 0 errors

- [ ] **Step 6: 커밋**

```bash
git add FE/components/performance FE/__tests__/performance-components.test.tsx
git commit -m "feat: 공연 PerformanceForm/PerformanceCard 컴포넌트"
```

---

## Task 4: 목록 페이지 /performances

**Files:**
- Create: `FE/app/performances/page.tsx`
- Test: `FE/__tests__/performances-page.test.tsx`

**Interfaces:**
- Consumes: `useInfiniteList` (기존), `toCursorPage` (Task 1), `PerformanceCard` (Task 3), `getBff` (기존), `Me` (기존 feed types).
- 동작: scope 탭(UPCOMING/PAST/ALL), 각 scope별 무한스크롤(scope로 리마운트), 카드 클릭→상세, 신원 조회해 `canRegister`면 "공연 등록" 버튼(→ /performances/new).

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/performances-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const getBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (...a: unknown[]) => getBff(...a) }));

import PerformancesPage from '@/app/performances/page';

function page(items: unknown[], last = true, number = 0) {
  return { ok: true, data: { content: items, number, totalPages: 1, last }, message: null };
}
function perf(id: number, title: string) {
  return { id, organizer: { id: 5, nickname: '주최', verified: true }, title, description: null,
    performedAt: '2026-09-01T19:30:00', venue: '홀', program: null, ticketInfo: null, ticketUrl: null,
    posterImageUrl: null, createdAt: 'x', updatedAt: 'x' };
}

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null };
    if (path.startsWith('/api/bff/performances')) return page([perf(1, '공연A'), perf(2, '공연B')]);
    return { ok: false, message: 'x' };
  });
});

describe('PerformancesPage', () => {
  it('공연 목록을 보여준다', async () => {
    render(<PerformancesPage />);
    expect(await screen.findByText('공연A')).toBeInTheDocument();
    expect(screen.getByText('공연B')).toBeInTheDocument();
  });

  it('인증 연주자면 공연 등록 버튼을 보여준다', async () => {
    render(<PerformancesPage />);
    expect(await screen.findByRole('button', { name: '공연 등록' })).toBeInTheDocument();
  });

  it('비자격이면 공연 등록 버튼이 없다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: false }, message: null };
      if (path.startsWith('/api/bff/performances')) return page([perf(1, '공연A')]);
      return { ok: false, message: 'x' };
    });
    render(<PerformancesPage />);
    await screen.findByText('공연A');
    expect(screen.queryByRole('button', { name: '공연 등록' })).not.toBeInTheDocument();
  });

  it('카드를 클릭하면 상세로 이동', async () => {
    render(<PerformancesPage />);
    fireEvent.click(await screen.findByText('공연A'));
    expect(push).toHaveBeenCalledWith('/performances/1');
  });

  it('scope 탭을 바꾸면 해당 scope로 다시 조회', async () => {
    render(<PerformancesPage />);
    await screen.findByText('공연A');
    fireEvent.click(screen.getByRole('button', { name: '지난' }));
    await waitFor(() => {
      const called = getBff.mock.calls.map((c) => String(c[0]));
      expect(called.some((u) => u.includes('scope=PAST'))).toBe(true);
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/performances-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: 목록 페이지 작성**

`FE/app/performances/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toCursorPage } from '@/lib/performance/logic';
import { PerformanceCard } from '@/components/performance/PerformanceCard';
import type { CursorPage, Me } from '@/lib/feed/types';
import type { Performance, PerformanceScope, SpringPage } from '@/lib/performance/types';

const TABS: { key: PerformanceScope; label: string }[] = [
  { key: 'UPCOMING', label: '다가오는' },
  { key: 'PAST', label: '지난' },
  { key: 'ALL', label: '전체' },
];

function ScopeList({ scope }: { scope: PerformanceScope }) {
  const router = useRouter();
  const fetchPage = useCallback(async (cursor: number | null): Promise<CursorPage<Performance> | null> => {
    const pageNum = cursor ?? 0;
    const r = await getBff<SpringPage<Performance>>(`/api/bff/performances?scope=${scope}&page=${pageNum}`);
    return r.ok ? toCursorPage(r.data as SpringPage<Performance>) : null;
  }, [scope]);

  const { items, isLoading, error, hasMore, sentinelRef } = useInfiniteList<Performance>(fetchPage);

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-4">
        {items.map((p) => (
          <PerformanceCard key={p.id} performance={p} onOpen={() => router.push(`/performances/${p.id}`)} />
        ))}
      </div>
      {isLoading && <p className="py-4 text-center text-sm text-gray-400">불러오는 중...</p>}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {!hasMore && items.length === 0 && !isLoading && (
        <p className="py-8 text-center text-sm text-gray-400">등록된 공연이 없습니다.</p>
      )}
    </>
  );
}

export default function PerformancesPage() {
  const router = useRouter();
  const [scope, setScope] = useState<PerformanceScope>('UPCOMING');
  const [canRegister, setCanRegister] = useState(false);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => {
      if (r.ok) {
        const me = r.data as Me;
        setCanRegister(me.verified || me.role === 'ADMIN');
      } else router.push('/login');
    });
  }, [router]);

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">공연</h1>
        {canRegister && (
          <button type="button" onClick={() => router.push('/performances/new')}
            className="rounded bg-black px-3 py-1.5 text-sm text-white">공연 등록</button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setScope(t.key)}
            className={`rounded-full px-3 py-1 text-sm ${scope === t.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <ScopeList key={scope} scope={scope} />
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인 + lint**

Run: `cd FE && npx vitest run __tests__/performances-page.test.tsx && npx eslint app/performances/page.tsx`
Expected: PASS + eslint 0 errors

- [ ] **Step 5: 커밋**

```bash
git add FE/app/performances/page.tsx FE/__tests__/performances-page.test.tsx
git commit -m "feat: 공연 목록 페이지 /performances(scope 탭·무한스크롤·등록 게이팅)"
```

---

## Task 5: 등록 페이지 /performances/new

**Files:**
- Create: `FE/app/performances/new/page.tsx`
- Test: `FE/__tests__/performances-new-page.test.tsx`

**Interfaces:**
- Consumes: `PerformanceForm` (Task 3), `getBff`/`postBff`/`putBffForm` (기존), `Me`/`Performance` types.
- 동작: 신원 조회 → 비자격이면 안내(폼 미표시). 폼 제출: POST 생성 → 포스터 선택했으면 PUT poster → 상세로. 포스터 실패면 `?posterFailed=1`.

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/performances-new-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const getBff = vi.fn();
const postBff = vi.fn();
const putBffForm = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  postBff: (...a: unknown[]) => postBff(...a),
  putBffForm: (...a: unknown[]) => putBffForm(...a),
}));

import NewPerformancePage from '@/app/performances/new/page';

function fillValid() {
  fireEvent.change(screen.getByLabelText('공연명'), { target: { value: '가을 리사이틀' } });
  fireEvent.change(screen.getByLabelText('공연 일시'), { target: { value: '2026-09-01T19:30' } });
  fireEvent.change(screen.getByLabelText('장소'), { target: { value: '예술의전당' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockResolvedValue({ ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null });
});

describe('NewPerformancePage', () => {
  it('비자격이면 안내를 보여주고 폼을 감춘다', async () => {
    getBff.mockResolvedValue({ ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: false }, message: null });
    render(<NewPerformancePage />);
    expect(await screen.findByText(/인증 연주자만/)).toBeInTheDocument();
    expect(screen.queryByLabelText('공연명')).not.toBeInTheDocument();
  });

  it('포스터 없이 등록하면 생성 후 상세로 이동', async () => {
    postBff.mockResolvedValue({ ok: true, data: { id: 42 }, message: null });
    render(<NewPerformancePage />);
    await screen.findByLabelText('공연명');
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/performances', expect.objectContaining({ title: '가을 리사이틀' })));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/performances/42'));
    expect(putBffForm).not.toHaveBeenCalled();
  });

  it('포스터를 골랐고 업로드 실패하면 posterFailed로 상세 이동', async () => {
    postBff.mockResolvedValue({ ok: true, data: { id: 42 }, message: null });
    putBffForm.mockResolvedValue({ ok: false, message: 'x' });
    render(<NewPerformancePage />);
    await screen.findByLabelText('공연명');
    fillValid();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(putBffForm).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/performances/42?posterFailed=1'));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/performances-new-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: 등록 페이지 작성**

`FE/app/performances/new/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff, putBffForm } from '@/lib/api';
import { PerformanceForm } from '@/components/performance/PerformanceForm';
import type { Me } from '@/lib/feed/types';
import type { Performance, PerformanceFormValues } from '@/lib/performance/types';

export default function NewPerformancePage() {
  const router = useRouter();
  const [canRegister, setCanRegister] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poster, setPoster] = useState<File | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => {
      if (r.ok) {
        const me = r.data as Me;
        setCanRegister(me.verified || me.role === 'ADMIN');
      } else router.push('/login');
    });
  }, [router]);

  async function submit(values: PerformanceFormValues) {
    setSubmitting(true);
    setError(null);
    const created = await postBff<Performance>('/api/bff/performances', values);
    if (!created.ok) { setSubmitting(false); setError(created.message ?? '등록에 실패했습니다.'); return; }
    const id = (created.data as Performance).id;

    if (poster) {
      const fd = new FormData();
      fd.append('file', poster);
      const up = await putBffForm(`/api/bff/performances/${id}/poster`, fd);
      if (!up.ok) { router.push(`/performances/${id}?posterFailed=1`); return; }
    }
    router.push(`/performances/${id}`);
  }

  if (canRegister === null) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;
  if (!canRegister) {
    return (
      <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-500">
        인증 연주자만 공연을 등록할 수 있습니다.
        <div className="mt-4"><a href="/performances" className="text-indigo-600">공연 목록으로</a></div>
      </main>
    );
  }

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">공연 등록</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="mb-4 flex flex-col gap-1 text-sm">
        <span className="text-gray-500">포스터 (선택)</span>
        <input type="file" accept="image/*" onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
      </div>
      <PerformanceForm submitting={submitting} submitLabel="등록" onSubmit={submit} />
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인 + lint**

Run: `cd FE && npx vitest run __tests__/performances-new-page.test.tsx && npx eslint app/performances/new/page.tsx`
Expected: PASS + eslint 0 errors

- [ ] **Step 5: 커밋**

```bash
git add FE/app/performances/new/page.tsx FE/__tests__/performances-new-page.test.tsx
git commit -m "feat: 공연 등록 페이지 /performances/new(2단계 마법사·자격 게이팅)"
```

---

## Task 6: 상세 페이지 /performances/[id]

**Files:**
- Create: `FE/app/performances/[id]/page.tsx`
- Test: `FE/__tests__/performances-detail-page.test.tsx`

**Interfaces:**
- Consumes: `useParams`/`useRouter`/`useSearchParams`, `getBff`/`deleteBff` (기존), `canEdit`/`canDelete` (feed logic), `AuthorBadge`, `formatDateTime` (Task 1), `Me`/`Performance` types.
- 동작: 신원+단건 로드(404→안내), 주최자면 수정/삭제 노출, 삭제→목록, `?posterFailed=1`이면 배너.

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/performances-detail-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
let searchParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: '1' }),
  useSearchParams: () => searchParams,
}));

const getBff = vi.fn();
const deleteBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  deleteBff: (...a: unknown[]) => deleteBff(...a),
}));

import PerformanceDetailPage from '@/app/performances/[id]/page';

const perf = {
  id: 1, organizer: { id: 5, nickname: '주최자', verified: true }, title: '가을 리사이틀',
  description: '설명', performedAt: '2026-09-01T19:30:00', venue: '예술의전당', program: '프로그램',
  ticketInfo: '전석 3만원', ticketUrl: 'http://t', posterImageUrl: null, createdAt: 'x', updatedAt: 'x',
};

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams('');
  getBff.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null };
    if (path === '/api/bff/performances/1') return { ok: true, data: perf, message: null };
    return { ok: false, message: 'x' };
  });
});

describe('PerformanceDetailPage', () => {
  it('공연 정보를 보여준다', async () => {
    render(<PerformanceDetailPage />);
    expect(await screen.findByText('가을 리사이틀')).toBeInTheDocument();
    expect(screen.getByText('예술의전당')).toBeInTheDocument();
    expect(screen.getByText(/2026\.09\.01 19:30/)).toBeInTheDocument();
  });

  it('주최자 본인이면 수정/삭제 버튼을 보여준다', async () => {
    render(<PerformanceDetailPage />);
    expect(await screen.findByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('주최자가 아니면 수정/삭제가 없다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 9, nickname: '남', role: 'USER', verified: false }, message: null };
      if (path === '/api/bff/performances/1') return { ok: true, data: perf, message: null };
      return { ok: false, message: 'x' };
    });
    render(<PerformanceDetailPage />);
    await screen.findByText('가을 리사이틀');
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
  });

  it('없는 공연이면 안내를 보여준다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null };
      if (path === '/api/bff/performances/1') return { ok: false, message: '없음' };
      return { ok: false, message: 'x' };
    });
    render(<PerformanceDetailPage />);
    expect(await screen.findByText(/삭제되었거나 없는 공연/)).toBeInTheDocument();
  });

  it('posterFailed 쿼리면 배너를 보여준다', async () => {
    searchParams = new URLSearchParams('posterFailed=1');
    render(<PerformanceDetailPage />);
    expect(await screen.findByText(/포스터 업로드에 실패/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/performances-detail-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: 상세 페이지 작성**

`FE/app/performances/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getBff, deleteBff } from '@/lib/api';
import { canEdit, canDelete } from '@/lib/feed/logic';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { formatDateTime } from '@/lib/performance/logic';
import type { Me } from '@/lib/feed/types';
import type { Performance } from '@/lib/performance/types';

export default function PerformanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id;
  const posterFailed = search.get('posterFailed') === '1';

  const [me, setMe] = useState<Me | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
  }, [router]);

  useEffect(() => {
    getBff<Performance>(`/api/bff/performances/${id}`).then((r) => {
      if (r.ok) setPerformance(r.data as Performance);
      else setNotFound(true);
    });
  }, [id]);

  async function remove() {
    if (!performance) return;
    const r = await deleteBff(`/api/bff/performances/${performance.id}`);
    if (r.ok) router.push('/performances');
    else setError(r.message ?? '삭제에 실패했습니다.');
  }

  if (notFound) {
    return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-500">삭제되었거나 없는 공연입니다.</main>;
  }
  if (!performance) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <button type="button" onClick={() => router.push('/performances')} className="mb-4 text-sm text-gray-500">← 공연</button>

      {posterFailed && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          공연은 등록됐지만 포스터 업로드에 실패했습니다. 수정에서 다시 시도해 주세요.
        </p>
      )}

      {performance.posterImageUrl && (
        <img src={performance.posterImageUrl} alt="" className="mb-4 max-h-96 w-full rounded object-contain" />
      )}

      <div className="mb-3 flex items-start justify-between">
        <h1 className="text-2xl font-bold">{performance.title}</h1>
        <div className="flex gap-2">
          {canEdit(me, performance.organizer.id) && (
            <button type="button" onClick={() => router.push(`/performances/${performance.id}/edit`)} className="text-xs text-gray-400">수정</button>
          )}
          {canDelete(me, performance.organizer.id) && (
            <button type="button" onClick={remove} className="text-xs text-gray-400">삭제</button>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600"><AuthorBadge author={performance.organizer} /></div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <dl className="flex flex-col gap-2 text-sm">
        <div><dt className="text-gray-500">일시</dt><dd>{formatDateTime(performance.performedAt)}</dd></div>
        <div><dt className="text-gray-500">장소</dt><dd>{performance.venue}</dd></div>
        {performance.description && <div><dt className="text-gray-500">소개</dt><dd className="whitespace-pre-wrap">{performance.description}</dd></div>}
        {performance.program && <div><dt className="text-gray-500">프로그램</dt><dd className="whitespace-pre-wrap">{performance.program}</dd></div>}
        {performance.ticketInfo && <div><dt className="text-gray-500">관람료</dt><dd>{performance.ticketInfo}</dd></div>}
        {performance.ticketUrl && <div><dt className="text-gray-500">티켓</dt><dd><a href={performance.ticketUrl} className="text-indigo-600" target="_blank" rel="noreferrer">예매 링크</a></dd></div>}
      </dl>
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인 + lint**

Run: `cd FE && npx vitest run __tests__/performances-detail-page.test.tsx && npx eslint "app/performances/[id]/page.tsx"`
Expected: PASS + eslint 0 errors

- [ ] **Step 5: 커밋**

```bash
git add "FE/app/performances/[id]/page.tsx" FE/__tests__/performances-detail-page.test.tsx
git commit -m "feat: 공연 상세 페이지 /performances/[id](정보·주최자 수정/삭제·404·포스터실패 배너)"
```

---

## Task 7: 수정 페이지 /performances/[id]/edit

**Files:**
- Create: `FE/app/performances/[id]/edit/page.tsx`
- Test: `FE/__tests__/performances-edit-page.test.tsx`

**Interfaces:**
- Consumes: `useParams`/`useRouter`, `getBff`/`putBff`/`putBffForm` (기존), `canEdit` (feed logic), `PerformanceForm` (Task 3), `Me`/`Performance`/`PerformanceFormValues` types.
- 동작: 단건+신원 로드 → `canEdit` 아니면 상세로 되돌림. 폼 저장 = PUT → 상세로. 포스터 파일 선택 즉시 PUT poster(업로드).

- [ ] **Step 1: 실패하는 테스트 작성**

`FE/__tests__/performances-edit-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: '1' }) }));

const getBff = vi.fn();
const putBff = vi.fn();
const putBffForm = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  putBff: (...a: unknown[]) => putBff(...a),
  putBffForm: (...a: unknown[]) => putBffForm(...a),
}));

import EditPerformancePage from '@/app/performances/[id]/edit/page';

const perf = {
  id: 1, organizer: { id: 5, nickname: '주최자', verified: true }, title: '가을 리사이틀',
  description: '설명', performedAt: '2026-09-01T19:30:00', venue: '예술의전당', program: '',
  ticketInfo: '', ticketUrl: '', posterImageUrl: null, createdAt: 'x', updatedAt: 'x',
};

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null };
    if (path === '/api/bff/performances/1') return { ok: true, data: perf, message: null };
    return { ok: false, message: 'x' };
  });
});

describe('EditPerformancePage', () => {
  it('기존 값을 채우고 저장하면 PUT 후 상세로', async () => {
    putBff.mockResolvedValue({ ok: true, data: { ...perf, title: '수정됨' }, message: null });
    render(<EditPerformancePage />);
    expect((await screen.findByLabelText('공연명') as HTMLInputElement).value).toBe('가을 리사이틀');
    fireEvent.change(screen.getByLabelText('공연명'), { target: { value: '수정됨' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(putBff).toHaveBeenCalledWith('/api/bff/performances/1', expect.objectContaining({ title: '수정됨' })));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/performances/1'));
  });

  it('주최자가 아니면 상세로 돌려보낸다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 9, nickname: '남', role: 'USER', verified: false }, message: null };
      if (path === '/api/bff/performances/1') return { ok: true, data: perf, message: null };
      return { ok: false, message: 'x' };
    });
    render(<EditPerformancePage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/performances/1'));
  });

  it('포스터 파일 선택 시 즉시 업로드', async () => {
    putBffForm.mockResolvedValue({ ok: true, data: { ...perf, posterImageUrl: 'http://x/p.png' }, message: null });
    render(<EditPerformancePage />);
    await screen.findByLabelText('공연명');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } });
    await waitFor(() => expect(putBffForm).toHaveBeenCalledWith('/api/bff/performances/1/poster', expect.any(FormData)));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/performances-edit-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: 수정 페이지 작성**

`FE/app/performances/[id]/edit/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, putBff, putBffForm } from '@/lib/api';
import { canEdit } from '@/lib/feed/logic';
import { PerformanceForm } from '@/components/performance/PerformanceForm';
import type { Me } from '@/lib/feed/types';
import type { Performance, PerformanceFormValues } from '@/lib/performance/types';

function toFormValues(p: Performance): PerformanceFormValues {
  return {
    title: p.title, description: p.description ?? '', performedAt: p.performedAt.slice(0, 16),
    venue: p.venue, program: p.program ?? '', ticketInfo: p.ticketInfo ?? '', ticketUrl: p.ticketUrl ?? '',
  };
}

export default function EditPerformancePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
  }, [router]);

  useEffect(() => {
    getBff<Performance>(`/api/bff/performances/${id}`).then((r) => {
      if (r.ok) setPerformance(r.data as Performance);
      else router.push(`/performances/${id}`);
    });
  }, [id, router]);

  // 주최자 아니면 상세로 (신원+공연 둘 다 준비된 뒤 판정)
  useEffect(() => {
    if (me && performance && !canEdit(me, performance.organizer.id)) {
      router.push(`/performances/${performance.id}`);
    }
  }, [me, performance, router]);

  async function save(values: PerformanceFormValues) {
    setSubmitting(true);
    setError(null);
    const r = await putBff<Performance>(`/api/bff/performances/${id}`, values);
    setSubmitting(false);
    if (r.ok) router.push(`/performances/${id}`);
    else setError(r.message ?? '저장에 실패했습니다.');
  }

  async function onPoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const r = await putBffForm<Performance>(`/api/bff/performances/${id}/poster`, fd);
    setUploading(false);
    if (r.ok) setPerformance(r.data as Performance);
    else setError(r.message ?? '포스터 업로드에 실패했습니다.');
  }

  if (!performance || !me) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">공연 수정</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex items-center gap-4">
        {performance.posterImageUrl
          ? <img src={performance.posterImageUrl} alt="" className="h-24 w-16 rounded object-cover" />
          : <div className="flex h-24 w-16 items-center justify-center rounded bg-gray-200 text-[10px] text-gray-500">포스터 없음</div>}
        <label className="cursor-pointer rounded border px-3 py-1.5 text-sm">
          {uploading ? '업로드 중...' : '포스터 변경'}
          <input type="file" accept="image/*" className="hidden" onChange={onPoster} disabled={uploading} />
        </label>
      </div>

      <PerformanceForm initial={toFormValues(performance)} submitting={submitting} submitLabel="저장" onSubmit={save} />
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인 + lint**

Run: `cd FE && npx vitest run __tests__/performances-edit-page.test.tsx && npx eslint "app/performances/[id]/edit/page.tsx"`
Expected: PASS + eslint 0 errors

- [ ] **Step 5: 커밋**

```bash
git add "FE/app/performances/[id]/edit/page.tsx" FE/__tests__/performances-edit-page.test.tsx
git commit -m "feat: 공연 수정 페이지 /performances/[id]/edit(폼 PUT·포스터 즉시 업로드·주최자 가드)"
```

---

## Task 8: 전체 회귀 + 문서 반영

**Files:**
- Modify: `docs/CONTEXT.md`, `docs/TODO-DONE.md`, `docs/AI-ACTION-LOGS.md`

- [ ] **Step 1: FE 전체 테스트**

Run: `cd FE && npm run test`
Expected: 전체 PASS(기존 + 신규 6개 파일: performance-logic, bff-performances, performance-components, performances-page, performances-new-page, performances-detail-page, performances-edit-page).

- [ ] **Step 2: FE 빌드**

Run: `cd FE && npm run build`
Expected: 빌드 성공(eslint 에러 0). 실패 시 해당 오류 수정 후 재실행.

- [ ] **Step 3: 문서 반영**

각 문서를 Read 후 형식 맞춰 Edit:
- `docs/TODO-DONE.md`: 상단에 추가
  `* [x] (2026-08-02) FE 공연(PERFORMANCE) 화면 구현 (TDD, 서브에이전트 주도) — 목록(scope 탭·무한스크롤)/등록(2단계 마법사·자격 게이팅)/상세/수정/포스터. useInfiniteList 오프셋 재사용, proxyAuthed·AuthorBadge·canEdit/canDelete 재사용. 브랜치 feature/performance-fe.`
  하위 불릿: `범위 밖: 관심/북마크, 피드 카드 노출, 곡목 구조화, 좌석/예매, 공개 조회, 태그/장르 필터.`
- `docs/CONTEXT.md`: 현재 상태의 "다음은 FE 화면" 목록에서 공연 제거(인증연주자/구인/채팅만 남김). FE 공연 화면 완료를 한 줄 반영.
- `docs/AI-ACTION-LOGS.md`: 끝에 2026-08-02 공연 FE 구현 로그 1줄 추가(오프셋→커서 재사용, 2단계 포스터, 자격 게이팅).

- [ ] **Step 4: 문서 커밋**

```bash
git add docs/CONTEXT.md docs/TODO-DONE.md docs/AI-ACTION-LOGS.md
git commit -m "docs: 공연 FE 구현 완료 반영(상태/TODO/로그)"
```

- [ ] **Step 5: 마무리 안내**

`superpowers:finishing-a-development-branch`로 브랜치 통합 옵션 제시.

---

## Self-Review (작성자 확인 완료)

**Spec 커버리지:** §1 라우팅→Task 4·5·6·7, §2 오프셋 재사용→Task 1(toCursorPage)·4, §3 2단계 마법사/폼→Task 3·5·7, §4 게이팅→Task 4·5·6·7(canRegister·canEdit·canDelete), §5 BFF→Task 2, §6 타입→Task 1, §7 테스트→각 Task. 누락 없음.

**타입 일관성:** `Performance`/`PerformanceFormValues`/`SpringPage`/`PerformanceScope`(Task 1)를 이후 전 태스크가 동일 사용. `toCursorPage`(Task 1)→Task 4. `Author`/`CursorPage`/`Me`/`canEdit`/`canDelete`는 피드 자산 재사용(시그니처 불변). `proxyAuthed`(기존)→Task 2. 포스터 라우트는 프로필 이미지 BFF 패턴 동일.

**플레이스홀더:** 없음(모든 스텝 실제 코드/명령/기대출력 포함).
