# 구인(RECRUITMENT) FE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구인 도메인 프론트엔드 전체(공고 CRUD/목록/마감 + 지원 플로우)를 공연 FE와 동일한 3계층 BFF 패턴으로 구현한다.

**Architecture:** 클라이언트 컴포넌트(`getBff/postBff…`) → same-origin BFF 라우트(`proxyAuthed`) → Spring BE(`/api/recruitments/**`). 목록은 `useInfiniteList` + Spring offset→cursor 변환으로 무한스크롤. 지원 여부는 낙관적 제출 + 409 피드백. 악기 선택은 신규 공용 `InstrumentPicker`로 추출.

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript / Tailwind / Vitest(jsdom + node env).

---

## BE 계약 확정 (구현 착수 전 확인 완료)

- `RecruitmentPostingResponse` = `{ id, author:{id,nickname,verified}, title, description, instruments: string[](enum명), recruitCount: number|null, location: string|null, fee: string|null, deadline: string|null, status:'OPEN'|'CLOSED', closed: boolean(파생), createdAt, updatedAt }`. **`closed`가 서버 파생값이므로 FE는 이 값을 그대로 쓴다**(클라이언트 재계산 불필요).
- `RecruitmentApplicationResponse` = `{ id, postingId, applicant:{id,nickname,verified}, message, status:'PENDING'|'ACCEPTED'|'REJECTED'|'WITHDRAWN', createdAt, updatedAt }`. **공고 제목 없음** → 내 지원 카드는 `postingId`로 링크만 건다.
- 목록 `GET /api/recruitments?scope=OPEN|CLOSED|ALL&instrument=<enum>&page=&size=` (scope 기본 OPEN, instrument 선택, `Page<T>` 반환).
- 등록/수정 요청 `RecruitmentPostingRequest` = `{ title(필수,≤100), description(≤2000), instruments(1개이상), recruitCount(있으면≥1), location(≤200), fee(≤200), deadline(nullable) }`.
- 지원 요청 `ApplyRecruitmentRequest` = `{ message(필수,≤1000) }`.
- 애플리케이션 액션: `POST /api/recruitments/{id}/applications`(지원), `GET /api/recruitments/{id}/applications`(작성자, Page), `GET /api/recruitments/applications/me`(Page), `POST /api/recruitments/applications/{aid}/accept|reject|withdraw`.
- 에러코드: 404-08/404-09/409-07(마감)/409-08(중복지원)/409-09(본인공고)/409-10(상태전이). BFF가 `message`를 그대로 전달하므로 FE는 `r.message`를 노출한다.

## 파일 구조

**생성:**
- `FE/lib/recruitment/types.ts` — 타입 정의
- `FE/lib/recruitment/logic.ts` — 순수 변환/검증/포맷
- `FE/app/api/bff/recruitments/route.ts` — 목록 GET / 등록 POST
- `FE/app/api/bff/recruitments/[id]/route.ts` — 상세 GET / 수정 PUT / 삭제 DELETE
- `FE/app/api/bff/recruitments/[id]/close/route.ts` — 마감 POST
- `FE/app/api/bff/recruitments/[id]/applications/route.ts` — 지원자 목록 GET / 지원 POST
- `FE/app/api/bff/recruitments/applications/me/route.ts` — 내 지원 GET
- `FE/app/api/bff/recruitments/applications/[aid]/accept/route.ts` — 수락 POST
- `FE/app/api/bff/recruitments/applications/[aid]/reject/route.ts` — 거절 POST
- `FE/app/api/bff/recruitments/applications/[aid]/withdraw/route.ts` — 철회 POST
- `FE/components/recruitment/InstrumentPicker.tsx` — 공용 악기 다중선택(프레젠테이셔널)
- `FE/components/recruitment/PostingForm.tsx` — 등록/수정 공용 폼
- `FE/components/recruitment/PostingCard.tsx` — 목록 카드
- `FE/components/recruitment/ApplyPanel.tsx` — 인라인 펼 토글 지원 폼
- `FE/components/recruitment/ApplicantList.tsx` — 작성자용 지원자 목록 + 수락/거절
- `FE/components/recruitment/ApplicationCard.tsx` — 내 지원 카드 + 철회
- `FE/app/recruitments/page.tsx` — 목록(scope 탭 + 악기 필터)
- `FE/app/recruitments/new/page.tsx` — 등록
- `FE/app/recruitments/[id]/page.tsx` — 상세(역할별 분기)
- `FE/app/recruitments/[id]/edit/page.tsx` — 수정
- `FE/app/recruitments/applications/me/page.tsx` — 내 지원 현황
- 각 대응 테스트 파일 `FE/__tests__/*.test.ts(x)`

**수정:** 없음(기존 파일 변경 없이 신규 추가만. 프로필 페이지의 InstrumentPicker 리팩터는 범위 밖).

## 재사용(기존 파일)

- `@/lib/feed/useInfiniteList` — `useInfiniteList<T extends {id:number}>(fetchPage)` → `{ items, setItems, isLoading, error, hasMore, sentinelRef }`
- `@/lib/feed/logic` — `mergeCursorPage`, `shouldLoadMore`, `canEdit(me,authorId)`, `canDelete(me,authorId)`
- `@/lib/feed/types` — `Author`, `Me`, `CursorPage`
- `@/lib/api` — `getBff/postBff/putBff/deleteBff`
- `@/lib/server/bffProxy` — `proxyAuthed(path, init?)`
- `@/components/feed/AuthorBadge` — `<AuthorBadge author={...} />`
- `/api/bff/me/identity` — 신원 프로브(기존 라우트), `/api/bff/profile-options` — 악기 옵션(`{ instruments: {code,label}[] }`)

---

## Task 1: 브랜치 + 타입 + 순수 로직

**Files:**
- Create: `FE/lib/recruitment/types.ts`, `FE/lib/recruitment/logic.ts`
- Test: `FE/__tests__/recruitment-logic.test.ts`

- [ ] **Step 1: 작업 브랜치 생성**

```bash
cd /Users/predevho/Desktop/Attaca && git checkout -b feature/recruitment-fe
```

- [ ] **Step 2: 타입 파일 작성** — `FE/lib/recruitment/types.ts`

```ts
import type { Author } from '@/lib/feed/types';

export type RecruitmentScope = 'OPEN' | 'CLOSED' | 'ALL';
export type RecruitmentStatus = 'OPEN' | 'CLOSED';
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export type Posting = {
  id: number;
  author: Author;
  title: string;
  description: string | null;
  instruments: string[]; // 악기 enum명
  recruitCount: number | null;
  location: string | null;
  fee: string | null;
  deadline: string | null; // null=상시모집
  status: RecruitmentStatus;
  closed: boolean; // BE 파생 마감판정
  createdAt: string;
  updatedAt: string;
};

/** 등록/수정 폼 값(모두 문자열/배열). toPostingRequest로 BE 요청으로 변환. */
export type PostingFormValues = {
  title: string;
  description: string;
  instruments: string[];
  recruitCount: string; // 숫자 입력을 문자열로 보관, '' = 미지정
  location: string;
  fee: string;
  deadline: string; // datetime-local, '' = 상시모집
};

export type Application = {
  id: number;
  postingId: number;
  applicant: Author;
  message: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
};

/** Spring Page 응답 중 FE가 쓰는 필드만. */
export type SpringPage<T> = { content: T[]; number: number; totalPages: number; last: boolean };

export type InstrumentOption = { code: string; label: string };
```

- [ ] **Step 3: 로직 테스트 작성(실패)** — `FE/__tests__/recruitment-logic.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  toCursorPage, validatePosting, formatDeadline, applicationStatusLabel, toPostingRequest, toFormValues,
} from '@/lib/recruitment/logic';
import type { PostingFormValues, Posting } from '@/lib/recruitment/types';

const base: PostingFormValues = {
  title: '피아노 반주자 구합니다', description: '', instruments: ['PIANO'],
  recruitCount: '2', location: '서울', fee: '협의', deadline: '',
};

describe('toCursorPage', () => {
  it('마지막 아니면 nextCursor=number+1', () =>
    expect(toCursorPage({ content: [{ id: 1 } as never], number: 0, totalPages: 2, last: false }))
      .toEqual({ items: [{ id: 1 }], nextCursor: 1 }));
  it('마지막이면 null', () =>
    expect(toCursorPage({ content: [], number: 1, totalPages: 2, last: true }))
      .toEqual({ items: [], nextCursor: null }));
});

describe('validatePosting', () => {
  it('유효하면 null', () => expect(validatePosting(base)).toBeNull());
  it('제목 없으면 에러', () => expect(validatePosting({ ...base, title: '  ' })).toMatch(/제목/));
  it('악기 0개면 에러', () => expect(validatePosting({ ...base, instruments: [] })).toMatch(/파트/));
  it('제목 100자 초과 에러', () => expect(validatePosting({ ...base, title: 'a'.repeat(101) })).toMatch(/100자/));
  it('모집 인원 0이면 에러', () => expect(validatePosting({ ...base, recruitCount: '0' })).toMatch(/인원/));
  it('모집 인원 빈 값은 허용(선택)', () => expect(validatePosting({ ...base, recruitCount: '' })).toBeNull());
});

describe('formatDeadline', () => {
  it('null이면 상시모집', () => expect(formatDeadline(null)).toBe('상시모집'));
  it('값 있으면 YYYY.MM.DD', () => expect(formatDeadline('2026-09-01T19:30:00')).toBe('2026.09.01'));
});

describe('applicationStatusLabel', () => {
  it('PENDING→대기 중', () => expect(applicationStatusLabel('PENDING')).toBe('대기 중'));
  it('ACCEPTED→수락됨', () => expect(applicationStatusLabel('ACCEPTED')).toBe('수락됨'));
});

describe('toPostingRequest', () => {
  it('빈 값은 null, 인원은 숫자, deadline 빈 값은 null', () => {
    expect(toPostingRequest({ ...base, description: '', location: '', fee: '', recruitCount: '', deadline: '' }))
      .toEqual({ title: base.title, description: null, instruments: ['PIANO'], recruitCount: null, location: null, fee: null, deadline: null });
  });
  it('deadline 값은 그대로 전달', () =>
    expect(toPostingRequest({ ...base, deadline: '2026-09-01T19:30' }).deadline).toBe('2026-09-01T19:30'));
});

describe('toFormValues', () => {
  it('Posting을 폼 값으로(널→빈문자열, deadline 16자 슬라이스)', () => {
    const p = { title: 'T', description: null, instruments: ['VIOLIN'], recruitCount: null,
      location: null, fee: null, deadline: '2026-09-01T19:30:00' } as Posting;
    expect(toFormValues(p)).toEqual({ title: 'T', description: '', instruments: ['VIOLIN'],
      recruitCount: '', location: '', fee: '', deadline: '2026-09-01T19:30' });
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `cd FE && npx vitest run __tests__/recruitment-logic.test.ts`
Expected: FAIL (`@/lib/recruitment/logic` 없음)

- [ ] **Step 5: 로직 구현** — `FE/lib/recruitment/logic.ts`

```ts
import type { CursorPage } from '@/lib/feed/types';
import type { Application, ApplicationStatus, Posting, PostingFormValues, SpringPage } from '@/lib/recruitment/types';

/** Spring Page(오프셋)를 커서 페이지 계약으로 변환 → useInfiniteList 재사용. cursor=페이지 번호. */
export function toCursorPage<T>(page: SpringPage<T>): CursorPage<T> {
  return { items: page.content, nextCursor: page.last ? null : page.number + 1 };
}

/** 클라이언트 폼 검증. 첫 에러 메시지 또는 null. BE RecruitmentPostingRequest 규칙과 일치. */
export function validatePosting(v: PostingFormValues): string | null {
  if (!v.title.trim()) return '제목을 입력해 주세요.';
  if (v.title.length > 100) return '제목은 100자를 넘을 수 없습니다.';
  if (v.instruments.length === 0) return '모집 파트를 하나 이상 선택해 주세요.';
  if (v.description.length > 2000) return '설명은 2000자를 넘을 수 없습니다.';
  if (v.location.length > 200) return '활동 지역/장소는 200자를 넘을 수 없습니다.';
  if (v.fee.length > 200) return '보수 안내는 200자를 넘을 수 없습니다.';
  if (v.recruitCount.trim() !== '') {
    const n = Number(v.recruitCount);
    if (!Number.isInteger(n) || n < 1) return '모집 인원은 1명 이상이어야 합니다.';
  }
  return null;
}

/** 폼 값 → BE 요청 본문. 빈 문자열은 null, 인원은 숫자 또는 null, deadline 빈 값은 null(상시모집). */
export function toPostingRequest(v: PostingFormValues) {
  return {
    title: v.title,
    description: v.description.trim() === '' ? null : v.description,
    instruments: v.instruments,
    recruitCount: v.recruitCount.trim() === '' ? null : Number(v.recruitCount),
    location: v.location.trim() === '' ? null : v.location,
    fee: v.fee.trim() === '' ? null : v.fee,
    deadline: v.deadline === '' ? null : v.deadline,
  };
}

/** Posting → 폼 값(수정 페이지 초기값). null은 빈 문자열, deadline은 datetime-local용 16자. */
export function toFormValues(p: Posting): PostingFormValues {
  return {
    title: p.title,
    description: p.description ?? '',
    instruments: p.instruments,
    recruitCount: p.recruitCount == null ? '' : String(p.recruitCount),
    location: p.location ?? '',
    fee: p.fee ?? '',
    deadline: p.deadline ? p.deadline.slice(0, 16) : '',
  };
}

/** 마감일 표시. null=상시모집, 값이면 "YYYY.MM.DD"(타임존 없음, 문자열 파싱). */
export function formatDeadline(iso: string | null): string {
  if (!iso) return '상시모집';
  const [d] = iso.split('T');
  const [y, m, day] = d.split('-');
  return `${y}.${m}.${day}`;
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case 'PENDING': return '대기 중';
    case 'ACCEPTED': return '수락됨';
    case 'REJECTED': return '거절됨';
    case 'WITHDRAWN': return '철회됨';
  }
}
```

- [ ] **Step 6: 통과 확인**

Run: `cd FE && npx vitest run __tests__/recruitment-logic.test.ts`
Expected: PASS (전 케이스)

- [ ] **Step 7: 커밋**

```bash
git add FE/lib/recruitment FE/__tests__/recruitment-logic.test.ts
git commit -m "feat: 구인 FE 타입·순수 로직(검증/변환/포맷) + 테스트"
```

---

## Task 2: BFF 공고 라우트 (목록/등록/상세/수정/삭제/마감)

**Files:**
- Create: `FE/app/api/bff/recruitments/route.ts`, `FE/app/api/bff/recruitments/[id]/route.ts`, `FE/app/api/bff/recruitments/[id]/close/route.ts`
- Test: `FE/__tests__/bff-recruitments.test.ts`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/bff-recruitments.test.ts`

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

describe('BFF 구인 공고 라우트', () => {
  it('GET 목록은 scope/instrument/page 쿼리를 BE로 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/recruitments/route');
    const res = await GET(new Request('http://x/api/bff/recruitments?scope=CLOSED&instrument=PIANO&page=1'));
    expect(res.status).toBe(200);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/recruitments');
    expect(url).toContain('scope=CLOSED');
    expect(url).toContain('instrument=PIANO');
    expect(url).toContain('page=1');
  });

  it('POST 등록은 본문을 BE로 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { id: 1 }, error: null }));
    vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/recruitments/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: '구인' }) }));
    expect(res.status).toBe(200);
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('GET/PUT/DELETE 단건은 BE 단건 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const mod = await import('@/app/api/bff/recruitments/[id]/route');
    await mod.GET(new Request('http://x'), { params: Promise.resolve({ id: '7' }) });
    await mod.PUT(new Request('http://x', { method: 'PUT', body: '{}' }), { params: Promise.resolve({ id: '7' }) });
    await mod.DELETE(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ id: '7' }) });
    for (const c of f.mock.calls) expect(String(c[0])).toContain('/api/recruitments/7');
    expect((f.mock.calls[2][1] as RequestInit).method).toBe('DELETE');
  });

  it('POST close는 BE 마감 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/recruitments/[id]/close/route');
    await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: '7' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/recruitments/7/close');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/bff-recruitments.test.ts`
Expected: FAIL (라우트 모듈 없음)

- [ ] **Step 3: 목록/등록 라우트** — `FE/app/api/bff/recruitments/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?scope=&instrument=&page=&size=
  return proxyAuthed('/api/recruitments' + search);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAuthed('/api/recruitments', { method: 'POST', body });
}
```

- [ ] **Step 4: 단건 라우트** — `FE/app/api/bff/recruitments/[id]/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/recruitments/${id}`);
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/recruitments/${id}`, { method: 'PUT', body });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/recruitments/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 5: 마감 라우트** — `FE/app/api/bff/recruitments/[id]/close/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/recruitments/${id}/close`, { method: 'POST' });
}
```

- [ ] **Step 6: 통과 확인**

Run: `cd FE && npx vitest run __tests__/bff-recruitments.test.ts`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add FE/app/api/bff/recruitments/route.ts FE/app/api/bff/recruitments/[id] FE/__tests__/bff-recruitments.test.ts
git commit -m "feat: 구인 공고 BFF 라우트(목록/등록/상세/수정/삭제/마감)"
```

---

## Task 3: BFF 지원 라우트 (지원/지원자목록/내지원/수락/거절/철회)

**Files:**
- Create: `FE/app/api/bff/recruitments/[id]/applications/route.ts`, `FE/app/api/bff/recruitments/applications/me/route.ts`, `FE/app/api/bff/recruitments/applications/[aid]/accept/route.ts`, `.../reject/route.ts`, `.../withdraw/route.ts`
- Test: `FE/__tests__/bff-recruitment-applications.test.ts`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/bff-recruitment-applications.test.ts`

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

describe('BFF 구인 지원 라우트', () => {
  it('POST 지원은 공고별 applications 경로에 본문 전달', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/recruitments/[id]/applications/route');
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ message: '지원합니다' }) }), { params: Promise.resolve({ id: '7' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/recruitments/7/applications');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('GET 지원자 목록은 page 쿼리 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/recruitments/[id]/applications/route');
    await GET(new Request('http://x/api/bff/recruitments/7/applications?page=1'), { params: Promise.resolve({ id: '7' }) });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/recruitments/7/applications');
    expect(url).toContain('page=1');
  });

  it('GET 내 지원은 BE applications/me 경로', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/recruitments/applications/me/route');
    await GET(new Request('http://x/api/bff/recruitments/applications/me?page=0'));
    expect(String(f.mock.calls[0][0])).toContain('/api/recruitments/applications/me');
  });

  it('accept/reject/withdraw는 각 BE 경로에 POST', async () => {
    for (const action of ['accept', 'reject', 'withdraw'] as const) {
      const f = okFetch(); vi.stubGlobal('fetch', f);
      const { POST } = await import(`@/app/api/bff/recruitments/applications/[aid]/${action}/route`);
      await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ aid: '3' }) });
      expect(String(f.mock.calls[0][0])).toContain(`/api/recruitments/applications/3/${action}`);
      expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
      vi.unstubAllGlobals();
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/bff-recruitment-applications.test.ts`
Expected: FAIL

- [ ] **Step 3: 지원/지원자목록 라우트** — `FE/app/api/bff/recruitments/[id]/applications/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const search = new URL(request.url).search; // ?page=&size=
  return proxyAuthed(`/api/recruitments/${id}/applications` + search);
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/recruitments/${id}/applications`, { method: 'POST', body });
}
```

- [ ] **Step 4: 내 지원 라우트** — `FE/app/api/bff/recruitments/applications/me/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?page=&size=
  return proxyAuthed('/api/recruitments/applications/me' + search);
}
```

- [ ] **Step 5: 수락/거절/철회 라우트 3개** — 각 `FE/app/api/bff/recruitments/applications/[aid]/{accept,reject,withdraw}/route.ts`

accept — `.../accept/route.ts`:

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ aid: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { aid } = await params;
  return proxyAuthed(`/api/recruitments/applications/${aid}/accept`, { method: 'POST' });
}
```

reject — `.../reject/route.ts` (위와 동일, 경로 끝만 `/reject`):

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ aid: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { aid } = await params;
  return proxyAuthed(`/api/recruitments/applications/${aid}/reject`, { method: 'POST' });
}
```

withdraw — `.../withdraw/route.ts` (경로 끝만 `/withdraw`):

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ aid: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { aid } = await params;
  return proxyAuthed(`/api/recruitments/applications/${aid}/withdraw`, { method: 'POST' });
}
```

- [ ] **Step 6: 통과 확인**

Run: `cd FE && npx vitest run __tests__/bff-recruitment-applications.test.ts`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add FE/app/api/bff/recruitments FE/__tests__/bff-recruitment-applications.test.ts
git commit -m "feat: 구인 지원 BFF 라우트(지원/지원자목록/내지원/수락·거절·철회)"
```

---

## Task 4: InstrumentPicker 공용 컴포넌트

작성자 검증 게이팅 없는 프레젠테이셔널 컴포넌트. max 규칙은 넣지 않는다(호출자가 강제). 프로필 페이지 리팩터는 범위 밖.

**Files:**
- Create: `FE/components/recruitment/InstrumentPicker.tsx`
- Test: `FE/__tests__/instrument-picker.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/instrument-picker.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstrumentPicker } from '@/components/recruitment/InstrumentPicker';

const options = [{ code: 'PIANO', label: '피아노' }, { code: 'VIOLIN', label: '바이올린' }];

describe('InstrumentPicker', () => {
  it('옵션 라벨을 모두 렌더', () => {
    render(<InstrumentPicker options={options} selected={[]} onToggle={() => {}} />);
    expect(screen.getByText('피아노')).toBeInTheDocument();
    expect(screen.getByText('바이올린')).toBeInTheDocument();
  });

  it('클릭 시 해당 code로 onToggle 호출', () => {
    const onToggle = vi.fn();
    render(<InstrumentPicker options={options} selected={[]} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('피아노'));
    expect(onToggle).toHaveBeenCalledWith('PIANO');
  });

  it('선택된 항목은 aria-pressed=true', () => {
    render(<InstrumentPicker options={options} selected={['VIOLIN']} onToggle={() => {}} />);
    expect(screen.getByText('바이올린').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('피아노').getAttribute('aria-pressed')).toBe('false');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/instrument-picker.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/components/recruitment/InstrumentPicker.tsx`

```tsx
import type { InstrumentOption } from '@/lib/recruitment/types';

export function InstrumentPicker({
  options, selected, onToggle,
}: {
  options: InstrumentOption[];
  selected: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.code);
        return (
          <button key={o.code} type="button" aria-pressed={on} onClick={() => onToggle(o.code)}
            className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/instrument-picker.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/recruitment/InstrumentPicker.tsx FE/__tests__/instrument-picker.test.tsx
git commit -m "feat: 구인 악기 다중선택 공용 InstrumentPicker + 테스트"
```

---

## Task 5: PostingForm (등록/수정 공용 폼)

`instruments` 옵션은 상위(페이지)가 `/api/bff/profile-options`에서 받아 props로 내려준다. 폼은 옵션을 스스로 로드하지 않는다(테스트 단순화 + 재사용).

**Files:**
- Create: `FE/components/recruitment/PostingForm.tsx`
- Test: `FE/__tests__/posting-form.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/posting-form.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostingForm } from '@/components/recruitment/PostingForm';

const options = [{ code: 'PIANO', label: '피아노' }];

describe('PostingForm', () => {
  it('제목/악기 누락 시 onSubmit 미호출 + 에러', () => {
    const onSubmit = vi.fn();
    render(<PostingForm options={options} submitting={false} submitLabel="등록" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/제목/)).toBeInTheDocument();
  });

  it('유효 입력이면 폼 값과 함께 onSubmit', () => {
    const onSubmit = vi.fn();
    render(<PostingForm options={options} submitting={false} submitLabel="등록" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '반주자 구함' } });
    fireEvent.click(screen.getByText('피아노')); // 악기 선택
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: '반주자 구함', instruments: ['PIANO'] }));
  });

  it('initial 값으로 필드를 채운다', () => {
    render(<PostingForm options={options} submitting={false} submitLabel="저장"
      initial={{ title: '기존제목', instruments: ['PIANO'] }} onSubmit={() => {}} />);
    expect((screen.getByLabelText('제목') as HTMLInputElement).value).toBe('기존제목');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/posting-form.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/components/recruitment/PostingForm.tsx`

```tsx
'use client';

import { useState } from 'react';
import { validatePosting } from '@/lib/recruitment/logic';
import { InstrumentPicker } from '@/components/recruitment/InstrumentPicker';
import type { InstrumentOption, PostingFormValues } from '@/lib/recruitment/types';

const EMPTY: PostingFormValues = {
  title: '', description: '', instruments: [], recruitCount: '', location: '', fee: '', deadline: '',
};

export function PostingForm({
  options, initial, submitting, submitLabel, onSubmit,
}: {
  options: InstrumentOption[];
  initial?: Partial<PostingFormValues>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (v: PostingFormValues) => void;
}) {
  const [v, setV] = useState<PostingFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);

  function field<K extends keyof PostingFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((cur) => ({ ...cur, [key]: e.target.value }));
  }

  function toggleInstrument(code: string) {
    setV((cur) => ({
      ...cur,
      instruments: cur.instruments.includes(code)
        ? cur.instruments.filter((c) => c !== code)
        : [...cur.instruments, code],
    }));
  }

  function submit() {
    const err = validatePosting(v);
    if (err) { setError(err); return; }
    setError(null);
    onSubmit(v);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">제목</span>
        <input aria-label="제목" value={v.title} maxLength={100} onChange={field('title')}
          className="rounded border px-3 py-2" />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">모집 파트</span>
        <InstrumentPicker options={options} selected={v.instruments} onToggle={toggleInstrument} />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">모집 인원</span>
        <input aria-label="모집 인원" type="number" min={1} value={v.recruitCount} onChange={field('recruitCount')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">활동 지역/장소</span>
        <input aria-label="활동 지역" value={v.location} maxLength={200} onChange={field('location')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">보수 안내</span>
        <input aria-label="보수 안내" value={v.fee} maxLength={200} onChange={field('fee')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">마감일 (비우면 상시모집)</span>
        <input aria-label="마감일" type="datetime-local" value={v.deadline} onChange={field('deadline')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">설명</span>
        <textarea aria-label="설명" value={v.description} maxLength={2000} onChange={field('description')}
          className="h-32 rounded border px-3 py-2" />
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

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/posting-form.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/recruitment/PostingForm.tsx FE/__tests__/posting-form.test.tsx
git commit -m "feat: 구인 공고 등록/수정 공용 PostingForm + 테스트"
```

---

## Task 6: PostingCard (목록 카드)

**Files:**
- Create: `FE/components/recruitment/PostingCard.tsx`
- Test: `FE/__tests__/posting-card.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/posting-card.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostingCard } from '@/components/recruitment/PostingCard';
import type { Posting } from '@/lib/recruitment/types';

const posting: Posting = {
  id: 1, author: { id: 9, nickname: '홍길동', verified: true }, title: '피아노 반주자',
  description: null, instruments: ['PIANO'], recruitCount: 2, location: '서울', fee: '협의',
  deadline: null, status: 'OPEN', closed: false, createdAt: '2026-08-01T00:00', updatedAt: '2026-08-01T00:00',
};

describe('PostingCard', () => {
  it('제목/지역/상시모집 표시', () => {
    render(<PostingCard posting={posting} onOpen={() => {}} />);
    expect(screen.getByText('피아노 반주자')).toBeInTheDocument();
    expect(screen.getByText(/상시모집/)).toBeInTheDocument();
  });

  it('마감된 공고는 마감 뱃지', () => {
    render(<PostingCard posting={{ ...posting, closed: true }} onOpen={() => {}} />);
    expect(screen.getByText('마감')).toBeInTheDocument();
  });

  it('클릭 시 onOpen', () => {
    const onOpen = vi.fn();
    render(<PostingCard posting={posting} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('피아노 반주자'));
    expect(onOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/posting-card.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/components/recruitment/PostingCard.tsx`

```tsx
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { formatDeadline } from '@/lib/recruitment/logic';
import type { Posting } from '@/lib/recruitment/types';

export function PostingCard({ posting, onOpen }: { posting: Posting; onOpen: () => void }) {
  return (
    <article onClick={onOpen} className="cursor-pointer rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate font-semibold">{posting.title}</h3>
        {posting.closed && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">마감</span>}
      </div>
      <div className="mt-1 text-sm text-gray-600"><AuthorBadge author={posting.author} /></div>
      <p className="mt-1 text-sm text-gray-500">
        {posting.instruments.join(', ')}
        {posting.location ? ` · ${posting.location}` : ''}
        {` · 마감 ${formatDeadline(posting.deadline)}`}
      </p>
    </article>
  );
}
```

> 참고: 악기는 enum명(예: PIANO) 그대로 표시한다. 라벨(피아노) 변환이 필요하면 후속 개선(카드에 옵션 맵 전달)으로 남긴다 — 이번 범위에서는 목록 성능·단순성 우선.

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/posting-card.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/recruitment/PostingCard.tsx FE/__tests__/posting-card.test.tsx
git commit -m "feat: 구인 목록 카드 PostingCard + 테스트"
```

---

## Task 7: 목록 페이지 `/recruitments` (scope 탭 + 악기 필터)

**Files:**
- Create: `FE/app/recruitments/page.tsx`
- Test: `FE/__tests__/recruitments-page.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/recruitments-page.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p) }));

import RecruitmentsPage from '@/app/recruitments/page';

const page = { content: [{ id: 1, author: { id: 9, nickname: 'A', verified: false }, title: '공고1',
  description: null, instruments: ['PIANO'], recruitCount: 1, location: '서울', fee: null,
  deadline: null, status: 'OPEN', closed: false, createdAt: '', updatedAt: '' }], number: 0, totalPages: 1, last: true };

beforeEach(() => {
  push.mockReset(); getBff.mockReset();
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'A', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/profile-options')) return Promise.resolve({ ok: true, data: { instruments: [{ code: 'PIANO', label: '피아노' }] } });
    if (p.startsWith('/api/bff/recruitments')) return Promise.resolve({ ok: true, data: page });
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('RecruitmentsPage', () => {
  it('로그인 회원이면 등록 버튼 노출 + 목록 렌더', async () => {
    render(<RecruitmentsPage />);
    expect(await screen.findByText('공고1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '공고 등록' })).toBeInTheDocument();
  });

  it('카드 클릭 시 상세로 push', async () => {
    render(<RecruitmentsPage />);
    fireEvent.click(await screen.findByText('공고1'));
    expect(push).toHaveBeenCalledWith('/recruitments/1');
  });

  it('악기 필터 선택 시 instrument 쿼리로 재조회', async () => {
    render(<RecruitmentsPage />);
    await screen.findByText('공고1');
    fireEvent.change(screen.getByLabelText('악기 필터'), { target: { value: 'PIANO' } });
    await waitFor(() => expect(getBff.mock.calls.some((c) => String(c[0]).includes('instrument=PIANO'))).toBe(true));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/app/recruitments/page.tsx`

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toCursorPage } from '@/lib/recruitment/logic';
import { PostingCard } from '@/components/recruitment/PostingCard';
import type { CursorPage } from '@/lib/feed/types';
import type { InstrumentOption, Posting, RecruitmentScope, SpringPage } from '@/lib/recruitment/types';

const TABS: { key: RecruitmentScope; label: string }[] = [
  { key: 'OPEN', label: '모집중' },
  { key: 'CLOSED', label: '마감' },
  { key: 'ALL', label: '전체' },
];

function ScopeList({ scope, instrument }: { scope: RecruitmentScope; instrument: string }) {
  const router = useRouter();
  const fetchPage = useCallback(async (cursor: number | null): Promise<CursorPage<Posting> | null> => {
    const pageNum = cursor ?? 0;
    const q = `/api/bff/recruitments?scope=${scope}&page=${pageNum}` + (instrument ? `&instrument=${instrument}` : '');
    const r = await getBff<SpringPage<Posting>>(q);
    return r.ok ? toCursorPage(r.data as SpringPage<Posting>) : null;
  }, [scope, instrument]);

  const { items, isLoading, error, hasMore, sentinelRef } = useInfiniteList<Posting>(fetchPage);

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-4">
        {items.map((p) => (
          <PostingCard key={p.id} posting={p} onOpen={() => router.push(`/recruitments/${p.id}`)} />
        ))}
      </div>
      {isLoading && <p className="py-4 text-center text-sm text-gray-400">불러오는 중...</p>}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {!hasMore && items.length === 0 && !isLoading && (
        <p className="py-8 text-center text-sm text-gray-400">등록된 공고가 없습니다.</p>
      )}
    </>
  );
}

export default function RecruitmentsPage() {
  const router = useRouter();
  const [scope, setScope] = useState<RecruitmentScope>('OPEN');
  const [instrument, setInstrument] = useState('');
  const [options, setOptions] = useState<InstrumentOption[]>([]);
  const [canRegister, setCanRegister] = useState(false);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => {
      if (r.ok) setCanRegister(true); // 로그인 회원 누구나(게이팅 없음)
      else router.push('/login');
    });
    getBff('/api/bff/profile-options').then((r) => {
      if (r.ok) setOptions((r.data as { instruments: InstrumentOption[] }).instruments);
    });
  }, [router]);

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">구인</h1>
        {canRegister && (
          <button type="button" onClick={() => router.push('/recruitments/new')}
            className="rounded bg-black px-3 py-1.5 text-sm text-white">공고 등록</button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setScope(t.key)}
            className={`rounded-full px-3 py-1 text-sm ${scope === t.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>
            {t.label}
          </button>
        ))}
        <select aria-label="악기 필터" value={instrument} onChange={(e) => setInstrument(e.target.value)}
          className="ml-auto rounded border px-2 py-1 text-sm">
          <option value="">전체 파트</option>
          {options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select>
      </div>

      <ScopeList key={`${scope}:${instrument}`} scope={scope} instrument={instrument} />

      <div className="mt-6 text-center">
        <button type="button" onClick={() => router.push('/recruitments/applications/me')}
          className="text-sm text-gray-500 underline">내 지원 현황</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-page.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/app/recruitments/page.tsx FE/__tests__/recruitments-page.test.tsx
git commit -m "feat: 구인 목록 페이지(scope 탭 + 악기 필터 + 무한스크롤)"
```

---

## Task 8: 등록 페이지 `/recruitments/new`

**Files:**
- Create: `FE/app/recruitments/new/page.tsx`
- Test: `FE/__tests__/recruitments-new-page.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/recruitments-new-page.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (p: string, b: unknown) => postBff(p, b) }));

import NewRecruitmentPage from '@/app/recruitments/new/page';

beforeEach(() => {
  push.mockReset(); getBff.mockReset(); postBff.mockReset();
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'A', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/profile-options')) return Promise.resolve({ ok: true, data: { instruments: [{ code: 'PIANO', label: '피아노' }] } });
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('NewRecruitmentPage', () => {
  it('등록 성공 시 상세로 이동', async () => {
    postBff.mockResolvedValue({ ok: true, data: { id: 42 } });
    render(<NewRecruitmentPage />);
    fireEvent.change(await screen.findByLabelText('제목'), { target: { value: '반주자 구함' } });
    fireEvent.click(screen.getByText('피아노'));
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/recruitments/42'));
  });

  it('등록 실패 시 에러 노출', async () => {
    postBff.mockResolvedValue({ ok: false, message: '등록 실패' });
    render(<NewRecruitmentPage />);
    fireEvent.change(await screen.findByLabelText('제목'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('피아노'));
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(await screen.findByText('등록 실패')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-new-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/app/recruitments/new/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { toPostingRequest } from '@/lib/recruitment/logic';
import { PostingForm } from '@/components/recruitment/PostingForm';
import type { InstrumentOption, Posting, PostingFormValues } from '@/lib/recruitment/types';

export default function NewRecruitmentPage() {
  const router = useRouter();
  const [options, setOptions] = useState<InstrumentOption[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setReady(true); else router.push('/login'); });
    getBff('/api/bff/profile-options').then((r) => {
      if (r.ok) setOptions((r.data as { instruments: InstrumentOption[] }).instruments);
    });
  }, [router]);

  async function submit(v: PostingFormValues) {
    setSubmitting(true);
    setError(null);
    const r = await postBff<Posting>('/api/bff/recruitments', toPostingRequest(v));
    setSubmitting(false);
    if (r.ok && r.data) router.push(`/recruitments/${r.data.id}`);
    else setError(r.message ?? '등록에 실패했습니다.');
  }

  if (!ready) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">공고 등록</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <PostingForm options={options} submitting={submitting} submitLabel="등록" onSubmit={submit} />
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-new-page.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/app/recruitments/new FE/__tests__/recruitments-new-page.test.tsx
git commit -m "feat: 구인 공고 등록 페이지"
```

---

## Task 9: 수정 페이지 `/recruitments/[id]/edit`

**Files:**
- Create: `FE/app/recruitments/[id]/edit/page.tsx`
- Test: `FE/__tests__/recruitments-edit-page.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/recruitments-edit-page.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: '7' }) }));
const getBff = vi.fn(); const putBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), putBff: (p: string, b: unknown) => putBff(p, b) }));

import EditRecruitmentPage from '@/app/recruitments/[id]/edit/page';

const posting = { id: 7, author: { id: 9, nickname: 'A', verified: false }, title: '기존공고',
  description: null, instruments: ['PIANO'], recruitCount: 1, location: '서울', fee: null,
  deadline: null, status: 'OPEN', closed: false, createdAt: '', updatedAt: '' };

beforeEach(() => {
  push.mockReset(); getBff.mockReset(); putBff.mockReset();
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'A', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/profile-options')) return Promise.resolve({ ok: true, data: { instruments: [{ code: 'PIANO', label: '피아노' }] } });
    if (p === '/api/bff/recruitments/7') return Promise.resolve({ ok: true, data: posting });
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('EditRecruitmentPage', () => {
  it('기존 값 채우고 저장 시 PUT 후 상세로', async () => {
    putBff.mockResolvedValue({ ok: true, data: posting });
    render(<EditRecruitmentPage />);
    expect((await screen.findByLabelText('제목') as HTMLInputElement).value).toBe('기존공고');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(putBff).toHaveBeenCalledWith('/api/bff/recruitments/7', expect.objectContaining({ title: '기존공고' })));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/recruitments/7'));
  });

  it('작성자가 아니면 상세로 되돌림', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 999, nickname: 'B', role: 'USER', verified: false } });
      if (p.startsWith('/api/bff/profile-options')) return Promise.resolve({ ok: true, data: { instruments: [] } });
      if (p === '/api/bff/recruitments/7') return Promise.resolve({ ok: true, data: posting });
      return Promise.resolve({ ok: false, message: 'x' });
    });
    render(<EditRecruitmentPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/recruitments/7'));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-edit-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/app/recruitments/[id]/edit/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, putBff } from '@/lib/api';
import { canEdit } from '@/lib/feed/logic';
import { toFormValues, toPostingRequest } from '@/lib/recruitment/logic';
import { PostingForm } from '@/components/recruitment/PostingForm';
import type { Me } from '@/lib/feed/types';
import type { InstrumentOption, Posting, PostingFormValues } from '@/lib/recruitment/types';

export default function EditRecruitmentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [posting, setPosting] = useState<Posting | null>(null);
  const [options, setOptions] = useState<InstrumentOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
    getBff('/api/bff/profile-options').then((r) => {
      if (r.ok) setOptions((r.data as { instruments: InstrumentOption[] }).instruments);
    });
    getBff<Posting>(`/api/bff/recruitments/${id}`).then((r) => {
      if (r.ok) setPosting(r.data as Posting); else router.push('/recruitments');
    });
  }, [id, router]);

  // 신원+공고 모두 로드된 뒤 작성자 아니면 상세로 되돌림.
  useEffect(() => {
    if (me && posting && !canEdit(me, posting.author.id)) router.push(`/recruitments/${posting.id}`);
  }, [me, posting, router]);

  async function submit(v: PostingFormValues) {
    if (!posting) return;
    setSubmitting(true);
    setError(null);
    const r = await putBff<Posting>(`/api/bff/recruitments/${posting.id}`, toPostingRequest(v));
    setSubmitting(false);
    if (r.ok) router.push(`/recruitments/${posting.id}`);
    else setError(r.message ?? '수정에 실패했습니다.');
  }

  if (!posting) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">공고 수정</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <PostingForm options={options} initial={toFormValues(posting)} submitting={submitting} submitLabel="저장" onSubmit={submit} />
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-edit-page.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/app/recruitments/[id]/edit FE/__tests__/recruitments-edit-page.test.tsx
git commit -m "feat: 구인 공고 수정 페이지"
```

---

## Task 10: ApplyPanel (인라인 펼 토글 지원 폼)

**Files:**
- Create: `FE/components/recruitment/ApplyPanel.tsx`
- Test: `FE/__tests__/apply-panel.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/apply-panel.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplyPanel } from '@/components/recruitment/ApplyPanel';

describe('ApplyPanel', () => {
  it('처음엔 지원하기 버튼만, 클릭 시 메시지 입력 펼침', () => {
    render(<ApplyPanel submitting={false} applied={false} onApply={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '지원하기' }));
    expect(screen.getByLabelText('지원 메시지')).toBeInTheDocument();
  });

  it('메시지 입력 후 제출 시 onApply(message)', () => {
    const onApply = vi.fn();
    render(<ApplyPanel submitting={false} applied={false} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: '지원하기' }));
    fireEvent.change(screen.getByLabelText('지원 메시지'), { target: { value: '함께하고 싶어요' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(onApply).toHaveBeenCalledWith('함께하고 싶어요');
  });

  it('빈 메시지는 제출 막고 에러', () => {
    const onApply = vi.fn();
    render(<ApplyPanel submitting={false} applied={false} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: '지원하기' }));
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/메시지/)).toBeInTheDocument();
  });

  it('applied=true면 지원 완료 표시', () => {
    render(<ApplyPanel submitting={false} applied={true} onApply={() => {}} />);
    expect(screen.getByText('지원 완료')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/apply-panel.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/components/recruitment/ApplyPanel.tsx`

```tsx
'use client';

import { useState } from 'react';

export function ApplyPanel({
  submitting, applied, onApply,
}: {
  submitting: boolean;
  applied: boolean;
  onApply: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (applied) {
    return <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">지원 완료</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="rounded bg-black px-4 py-2 text-sm text-white">지원하기</button>
    );
  }

  function submit() {
    if (!message.trim()) { setError('지원 메시지를 입력해 주세요.'); return; }
    if (message.length > 1000) { setError('지원 메시지는 1000자를 넘을 수 없습니다.'); return; }
    setError(null);
    onApply(message);
  }

  return (
    <div className="flex flex-col gap-2 rounded border p-3">
      <textarea aria-label="지원 메시지" value={message} maxLength={1000}
        onChange={(e) => setMessage(e.target.value)} placeholder="지원 메시지를 입력하세요"
        className="h-24 rounded border px-3 py-2 text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={submitting}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40">
          {submitting ? '처리 중...' : '제출'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }}
          className="rounded border px-4 py-2 text-sm">취소</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/apply-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/recruitment/ApplyPanel.tsx FE/__tests__/apply-panel.test.tsx
git commit -m "feat: 인라인 펼 토글 지원 폼 ApplyPanel + 테스트"
```

---

## Task 11: ApplicantList (작성자용 지원자 목록 + 수락/거절)

**Files:**
- Create: `FE/components/recruitment/ApplicantList.tsx`
- Test: `FE/__tests__/applicant-list.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/applicant-list.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicantList } from '@/components/recruitment/ApplicantList';
import type { Application } from '@/lib/recruitment/types';

const apps: Application[] = [
  { id: 1, postingId: 7, applicant: { id: 2, nickname: '지원자1', verified: false }, message: '잘 부탁드립니다', status: 'PENDING', createdAt: '', updatedAt: '' },
  { id: 2, postingId: 7, applicant: { id: 3, nickname: '지원자2', verified: true }, message: '경력 5년', status: 'ACCEPTED', createdAt: '', updatedAt: '' },
];

describe('ApplicantList', () => {
  it('지원자와 메시지·상태 표시', () => {
    render(<ApplicantList applications={apps} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText('지원자1')).toBeInTheDocument();
    expect(screen.getByText('잘 부탁드립니다')).toBeInTheDocument();
    expect(screen.getByText('수락됨')).toBeInTheDocument();
  });

  it('PENDING만 수락/거절 버튼', () => {
    render(<ApplicantList applications={apps} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getAllByRole('button', { name: '수락' })).toHaveLength(1);
  });

  it('수락 클릭 시 해당 지원 id로 onAccept', () => {
    const onAccept = vi.fn();
    render(<ApplicantList applications={apps} onAccept={onAccept} onReject={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '수락' }));
    expect(onAccept).toHaveBeenCalledWith(1);
  });

  it('지원자 없으면 안내', () => {
    render(<ApplicantList applications={[]} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText('아직 지원자가 없습니다.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/applicant-list.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/components/recruitment/ApplicantList.tsx`

```tsx
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { applicationStatusLabel } from '@/lib/recruitment/logic';
import type { Application } from '@/lib/recruitment/types';

export function ApplicantList({
  applications, onAccept, onReject,
}: {
  applications: Application[];
  onAccept: (applicationId: number) => void;
  onReject: (applicationId: number) => void;
}) {
  if (applications.length === 0) {
    return <p className="py-4 text-sm text-gray-400">아직 지원자가 없습니다.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {applications.map((a) => (
        <li key={a.id} className="rounded border p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm"><AuthorBadge author={a.applicant} /></div>
            <span className="text-xs text-gray-500">{applicationStatusLabel(a.status)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{a.message}</p>
          {a.status === 'PENDING' && (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => onAccept(a.id)}
                className="rounded bg-black px-3 py-1 text-xs text-white">수락</button>
              <button type="button" onClick={() => onReject(a.id)}
                className="rounded border px-3 py-1 text-xs">거절</button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/applicant-list.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/recruitment/ApplicantList.tsx FE/__tests__/applicant-list.test.tsx
git commit -m "feat: 작성자용 지원자 목록 ApplicantList(수락/거절) + 테스트"
```

---

## Task 12: 상세 페이지 `/recruitments/[id]` (역할별 분기 통합)

역할 분기: **작성자** → ApplicantList(지원자 첫 페이지 로드) + 수정/마감/삭제. **비작성자+미마감** → ApplyPanel. 지원은 낙관적 제출 + 409 메시지 노출, 성공 시 `applied=true`.

> 참고: 지원자 목록은 첫 페이지(최대 20명)만 로드한다. 20명 초과 페이지네이션은 이번 범위 밖(후속 백로그).

**Files:**
- Create: `FE/app/recruitments/[id]/page.tsx`
- Test: `FE/__tests__/recruitments-detail-page.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/recruitments-detail-page.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: '7' }) }));
const getBff = vi.fn(); const postBff = vi.fn(); const deleteBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (p: string) => getBff(p),
  postBff: (p: string, b?: unknown) => postBff(p, b),
  deleteBff: (p: string) => deleteBff(p),
}));

import RecruitmentDetailPage from '@/app/recruitments/[id]/page';

const posting = { id: 7, author: { id: 9, nickname: '작성자', verified: false }, title: '피아노 반주자',
  description: '설명', instruments: ['PIANO'], recruitCount: 2, location: '서울', fee: '협의',
  deadline: null, status: 'OPEN', closed: false, createdAt: '', updatedAt: '' };

function mockGet(meId: number, extra: (p: string) => unknown = () => ({ ok: false, message: 'x' })) {
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: meId, nickname: 'X', role: 'USER', verified: false } });
    if (p === '/api/bff/recruitments/7') return Promise.resolve({ ok: true, data: posting });
    return Promise.resolve(extra(p));
  });
}

beforeEach(() => { push.mockReset(); getBff.mockReset(); postBff.mockReset(); deleteBff.mockReset(); });

describe('RecruitmentDetailPage', () => {
  it('비작성자+미마감이면 지원하기 노출, 지원 성공 시 지원 완료', async () => {
    mockGet(2);
    postBff.mockResolvedValue({ ok: true, data: { id: 100 } });
    render(<RecruitmentDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: '지원하기' }));
    fireEvent.change(screen.getByLabelText('지원 메시지'), { target: { value: '지원합니다' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(await screen.findByText('지원 완료')).toBeInTheDocument();
    expect(postBff).toHaveBeenCalledWith('/api/bff/recruitments/7/applications', { message: '지원합니다' });
  });

  it('중복지원(409) 시 BE 메시지 노출', async () => {
    mockGet(2);
    postBff.mockResolvedValue({ ok: false, message: '이미 지원한 공고입니다.' });
    render(<RecruitmentDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: '지원하기' }));
    fireEvent.change(screen.getByLabelText('지원 메시지'), { target: { value: 'ㅁ' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(await screen.findByText('이미 지원한 공고입니다.')).toBeInTheDocument();
  });

  it('작성자면 지원자 목록 + 수정/마감/삭제 노출', async () => {
    mockGet(9, (p) => {
      if (p.startsWith('/api/bff/recruitments/7/applications')) {
        return { ok: true, data: { content: [{ id: 1, postingId: 7, applicant: { id: 2, nickname: '지원자1', verified: false }, message: 'hi', status: 'PENDING', createdAt: '', updatedAt: '' }], number: 0, totalPages: 1, last: true } };
      }
      return { ok: false, message: 'x' };
    });
    render(<RecruitmentDetailPage />);
    expect(await screen.findByText('지원자1')).toBeInTheDocument();
    expect(screen.getByText('수정')).toBeInTheDocument();
    expect(screen.getByText('마감')).toBeInTheDocument();
    expect(screen.getByText('삭제')).toBeInTheDocument();
  });

  it('마감된 공고는 지원하기 대신 마감 안내', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: 'X', role: 'USER', verified: false } });
      if (p === '/api/bff/recruitments/7') return Promise.resolve({ ok: true, data: { ...posting, closed: true, status: 'CLOSED' } });
      return Promise.resolve({ ok: false, message: 'x' });
    });
    render(<RecruitmentDetailPage />);
    expect(await screen.findByText('마감된 공고입니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지원하기' })).not.toBeInTheDocument();
  });

  it('없는 공고면 안내', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: 'X', role: 'USER', verified: false } });
      return Promise.resolve({ ok: false, message: 'not found' });
    });
    render(<RecruitmentDetailPage />);
    expect(await screen.findByText('삭제되었거나 없는 공고입니다.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-detail-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/app/recruitments/[id]/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBff, postBff, deleteBff } from '@/lib/api';
import { canEdit, canDelete } from '@/lib/feed/logic';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { ApplyPanel } from '@/components/recruitment/ApplyPanel';
import { ApplicantList } from '@/components/recruitment/ApplicantList';
import { formatDeadline } from '@/lib/recruitment/logic';
import type { Me } from '@/lib/feed/types';
import type { Application, Posting, SpringPage } from '@/lib/recruitment/types';

export default function RecruitmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [posting, setPosting] = useState<Posting | null>(null);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [applied, setApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (r.ok) setMe(r.data as Me); else router.push('/login'); });
  }, [router]);

  useEffect(() => {
    getBff<Posting>(`/api/bff/recruitments/${id}`).then((r) => {
      if (r.ok) setPosting(r.data as Posting); else setNotFound(true);
    });
  }, [id]);

  const isAuthor = me != null && posting != null && me.id === posting.author.id;

  // 작성자면 지원자 첫 페이지 로드.
  useEffect(() => {
    if (isAuthor && posting) {
      getBff<SpringPage<Application>>(`/api/bff/recruitments/${posting.id}/applications?page=0`).then((r) => {
        if (r.ok) setApplicants((r.data as SpringPage<Application>).content);
      });
    }
  }, [isAuthor, posting]);

  async function apply(message: string) {
    if (!posting) return;
    setSubmitting(true);
    setError(null);
    const r = await postBff(`/api/bff/recruitments/${posting.id}/applications`, { message });
    setSubmitting(false);
    if (r.ok) setApplied(true);
    else setError(r.message ?? '지원에 실패했습니다.');
  }

  async function decide(applicationId: number, action: 'accept' | 'reject') {
    const r = await postBff(`/api/bff/recruitments/applications/${applicationId}/${action}`);
    if (r.ok) {
      setApplicants((cur) => cur.map((a) =>
        a.id === applicationId ? { ...a, status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' } : a));
    } else setError(r.message ?? '처리에 실패했습니다.');
  }

  async function close() {
    if (!posting) return;
    const r = await postBff(`/api/bff/recruitments/${posting.id}/close`);
    if (r.ok) setPosting({ ...posting, status: 'CLOSED', closed: true });
    else setError(r.message ?? '마감에 실패했습니다.');
  }

  async function remove() {
    if (!posting) return;
    const r = await deleteBff(`/api/bff/recruitments/${posting.id}`);
    if (r.ok) router.push('/recruitments');
    else setError(r.message ?? '삭제에 실패했습니다.');
  }

  if (notFound) {
    return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-500">삭제되었거나 없는 공고입니다.</main>;
  }
  if (!posting) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <button type="button" onClick={() => router.push('/recruitments')} className="mb-4 text-sm text-gray-500">← 구인</button>

      <div className="mb-3 flex items-start justify-between">
        <h1 className="text-2xl font-bold">{posting.title}</h1>
        <div className="flex gap-2">
          {canEdit(me, posting.author.id) && (
            <button type="button" onClick={() => router.push(`/recruitments/${posting.id}/edit`)} className="text-xs text-gray-400">수정</button>
          )}
          {isAuthor && !posting.closed && (
            <button type="button" onClick={close} className="text-xs text-gray-400">마감</button>
          )}
          {canDelete(me, posting.author.id) && (
            <button type="button" onClick={remove} className="text-xs text-gray-400">삭제</button>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600"><AuthorBadge author={posting.author} /></div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <dl className="mb-6 flex flex-col gap-2 text-sm">
        <div><dt className="text-gray-500">모집 파트</dt><dd>{posting.instruments.join(', ')}</dd></div>
        {posting.recruitCount != null && <div><dt className="text-gray-500">모집 인원</dt><dd>{posting.recruitCount}명</dd></div>}
        {posting.location && <div><dt className="text-gray-500">활동 지역</dt><dd>{posting.location}</dd></div>}
        {posting.fee && <div><dt className="text-gray-500">보수</dt><dd>{posting.fee}</dd></div>}
        <div><dt className="text-gray-500">마감</dt><dd>{formatDeadline(posting.deadline)}</dd></div>
        {posting.description && <div><dt className="text-gray-500">설명</dt><dd className="whitespace-pre-wrap">{posting.description}</dd></div>}
      </dl>

      {isAuthor ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-500">지원자</h2>
          <ApplicantList applications={applicants} onAccept={(aid) => decide(aid, 'accept')} onReject={(aid) => decide(aid, 'reject')} />
        </section>
      ) : posting.closed ? (
        <p className="text-sm text-gray-500">마감된 공고입니다.</p>
      ) : (
        <ApplyPanel submitting={submitting} applied={applied} onApply={apply} />
      )}
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-detail-page.test.tsx`
Expected: PASS (5 케이스)

- [ ] **Step 5: 커밋**

```bash
git add FE/app/recruitments/[id]/page.tsx FE/__tests__/recruitments-detail-page.test.tsx
git commit -m "feat: 구인 공고 상세 페이지(역할별 분기: 지원/지원자관리/수정·마감·삭제)"
```

---

## Task 13: ApplicationCard (내 지원 카드 + 철회)

**Files:**
- Create: `FE/components/recruitment/ApplicationCard.tsx`
- Test: `FE/__tests__/application-card.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/application-card.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicationCard } from '@/components/recruitment/ApplicationCard';
import type { Application } from '@/lib/recruitment/types';

const pending: Application = { id: 1, postingId: 7, applicant: { id: 2, nickname: '나', verified: false },
  message: '지원합니다', status: 'PENDING', createdAt: '', updatedAt: '' };

describe('ApplicationCard', () => {
  it('상태·메시지 표시 + 공고 링크', () => {
    render(<ApplicationCard application={pending} onWithdraw={() => {}} onOpen={() => {}} />);
    expect(screen.getByText('대기 중')).toBeInTheDocument();
    expect(screen.getByText('지원합니다')).toBeInTheDocument();
  });

  it('PENDING이면 철회 버튼, 클릭 시 onWithdraw(id)', () => {
    const onWithdraw = vi.fn();
    render(<ApplicationCard application={pending} onWithdraw={onWithdraw} onOpen={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '철회' }));
    expect(onWithdraw).toHaveBeenCalledWith(1);
  });

  it('ACCEPTED면 철회 버튼 없음', () => {
    render(<ApplicationCard application={{ ...pending, status: 'ACCEPTED' }} onWithdraw={() => {}} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: '철회' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/application-card.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/components/recruitment/ApplicationCard.tsx`

```tsx
import { applicationStatusLabel } from '@/lib/recruitment/logic';
import type { Application } from '@/lib/recruitment/types';

export function ApplicationCard({
  application, onWithdraw, onOpen,
}: {
  application: Application;
  onWithdraw: (applicationId: number) => void;
  onOpen: () => void;
}) {
  return (
    <article className="rounded border p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onOpen} className="text-sm text-indigo-600 underline">
          공고 #{application.postingId} 보기
        </button>
        <span className="text-xs text-gray-500">{applicationStatusLabel(application.status)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{application.message}</p>
      {application.status === 'PENDING' && (
        <button type="button" onClick={() => onWithdraw(application.id)}
          className="mt-2 rounded border px-3 py-1 text-xs">철회</button>
      )}
    </article>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/application-card.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/recruitment/ApplicationCard.tsx FE/__tests__/application-card.test.tsx
git commit -m "feat: 내 지원 카드 ApplicationCard(철회) + 테스트"
```

---

## Task 14: 내 지원 현황 페이지 `/recruitments/applications/me`

**Files:**
- Create: `FE/app/recruitments/applications/me/page.tsx`
- Test: `FE/__tests__/recruitments-my-applications-page.test.tsx`

- [ ] **Step 1: 테스트 작성(실패)** — `FE/__tests__/recruitments-my-applications-page.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (p: string, b?: unknown) => postBff(p, b) }));

import MyApplicationsPage from '@/app/recruitments/applications/me/page';

const page = { content: [{ id: 1, postingId: 7, applicant: { id: 2, nickname: '나', verified: false },
  message: '지원합니다', status: 'PENDING', createdAt: '', updatedAt: '' }], number: 0, totalPages: 1, last: true };

beforeEach(() => {
  push.mockReset(); getBff.mockReset(); postBff.mockReset();
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: '나', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/recruitments/applications/me')) return Promise.resolve({ ok: true, data: page });
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('MyApplicationsPage', () => {
  it('내 지원 목록 렌더', async () => {
    render(<MyApplicationsPage />);
    expect(await screen.findByText('지원합니다')).toBeInTheDocument();
  });

  it('철회 성공 시 상태가 철회됨으로', async () => {
    postBff.mockResolvedValue({ ok: true, data: null });
    render(<MyApplicationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '철회' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/recruitments/applications/1/withdraw'));
    expect(await screen.findByText('철회됨')).toBeInTheDocument();
  });

  it('공고 링크 클릭 시 상세로 push', async () => {
    render(<MyApplicationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /공고 #7/ }));
    expect(push).toHaveBeenCalledWith('/recruitments/7');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-my-applications-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현** — `FE/app/recruitments/applications/me/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { ApplicationCard } from '@/components/recruitment/ApplicationCard';
import type { Application, SpringPage } from '@/lib/recruitment/types';

export default function MyApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (!r.ok) router.push('/login'); });
    getBff<SpringPage<Application>>('/api/bff/recruitments/applications/me?page=0').then((r) => {
      if (r.ok) setApplications((r.data as SpringPage<Application>).content);
      setLoaded(true);
    });
  }, [router]);

  async function withdraw(applicationId: number) {
    const r = await postBff(`/api/bff/recruitments/applications/${applicationId}/withdraw`);
    if (r.ok) {
      setApplications((cur) => cur.map((a) => (a.id === applicationId ? { ...a, status: 'WITHDRAWN' } : a)));
    } else setError(r.message ?? '철회에 실패했습니다.');
  }

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <button type="button" onClick={() => router.push('/recruitments')} className="mb-4 text-sm text-gray-500">← 구인</button>
      <h1 className="mb-4 text-2xl font-bold">내 지원 현황</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-4">
        {applications.map((a) => (
          <ApplicationCard key={a.id} application={a}
            onWithdraw={withdraw} onOpen={() => router.push(`/recruitments/${a.postingId}`)} />
        ))}
      </div>
      {loaded && applications.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">지원한 공고가 없습니다.</p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd FE && npx vitest run __tests__/recruitments-my-applications-page.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/app/recruitments/applications FE/__tests__/recruitments-my-applications-page.test.tsx
git commit -m "feat: 내 지원 현황 페이지(철회)"
```

---

## Task 15: 전체 회귀 + 린트 + 빌드 + 문서 반영

**Files:**
- Modify: `docs/CONTEXT.md`, `docs/TODO-DOING.md`, `docs/TODO-DONE.md`, `docs/TODO-BACKLOG.md`, `docs/AI-ACTION-LOGS.md`

- [ ] **Step 1: 전체 테스트**

Run: `cd FE && npx vitest run`
Expected: 전체 PASS(기존 + 신규 구인 테스트). 실패 시 해당 태스크로 돌아가 수정.

- [ ] **Step 2: 린트**

Run: `cd FE && npm run lint`
Expected: 통과. (공연 FE 회고 교훈: 단일 파일 lint의 맹점 — 반드시 전체 lint. 내부 이동은 `<a>`가 아니라 `next/link` `<Link>`나 `router.push`로 — 이 계획은 전부 `router.push` 사용.)

- [ ] **Step 3: 빌드**

Run: `cd FE && npm run build`
Expected: 성공. eslint 에러(예: `<a>` 내부 링크)로 실패하면 수정.

- [ ] **Step 4: 문서 반영**

- `docs/CONTEXT.md`: "현재 상태"의 FE 목록에 구인(RECRUITMENT) 추가, "다음은 FE 화면"을 (인증연주자/채팅)으로 갱신. 구인 FE 요약 1줄 추가(라우팅·낙관적 지원·InstrumentPicker 공용·BFF 8라우트).
- `docs/TODO-DONE.md`: 구인 FE 완료 항목 추가(TDD 15태스크, 브랜치 `feature/recruitment-fe`).
- `docs/TODO-DOING.md`: 비우기(없음 유지).
- `docs/TODO-BACKLOG.md`: "FE 화면" 섹션에서 구인 항목 체크(`[x]`), 상세 페이지 지원자 목록 20명 페이지네이션 후속·PostingCard 악기 라벨 변환 후속을 Minor 백로그로 추가.
- `docs/AI-ACTION-LOGS.md`: 작업 로그 1줄 추가.

- [ ] **Step 5: 문서 커밋**

```bash
git add docs
git commit -m "docs: 구인 FE 구현 완료 반영(상태/TODO/로그)"
```

- [ ] **Step 6: 완료 보고**

`superpowers:finishing-a-development-branch` 스킬로 병합/PR 옵션을 사용자에게 제시(공연·피드 FE와 동일하게 main 병합 대기 방식이 기본).

---

## Self-Review 결과

**1. Spec coverage:** spec의 라우팅(5페이지)·BFF(8라우트)·컴포넌트(6개)·데이터 계층(types/logic)·권한/에러 규칙·테스트(계층별) 모두 Task 1~14에 대응. 결정 4건(전체통째/상세중심+내지원별도/인라인펼토글/공연패턴) 반영. 열린 결정 2건(낙관적 지원 사전판정 = Task 12, InstrumentPicker 공용 추출 = Task 4) 반영.

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TBD/이후구현" 없음. reject/withdraw 라우트는 코드 전체를 반복(태스크를 순서 없이 읽어도 되도록).

**3. Type consistency:** `toCursorPage`(제네릭), `toPostingRequest`/`toFormValues`/`validatePosting`/`formatDeadline`/`applicationStatusLabel` 시그니처가 logic 정의(Task 1)와 사용처(Task 5·7·8·9·11·12·13·14)에서 일치. `Posting.closed`(BE 파생) 사용 일관. `Application`은 `applicant`/`postingId` 필드로 통일(내 지원 카드는 공고 제목 없음 → postingId 링크). BFF 라우트 `params` 키: 공고=`id`, 지원 액션=`aid`로 일관.

**해결한 갭:** 내 지원 응답에 공고 제목이 없다는 BE 제약 → ApplicationCard는 `공고 #{postingId} 보기` 링크로 처리(Task 13). 지원자 목록 20명 캡은 상세 페이지 주석 + 후속 백로그로 명시(silent cap 금지).
