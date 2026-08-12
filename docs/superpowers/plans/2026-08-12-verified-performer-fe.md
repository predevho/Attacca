# 인증 연주자(VERIFIED-PERFORMER) FE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증 연주자 도메인 프론트엔드 전체(회원 신청/내 상태 + 어드민 심사/직접지정)를 기존 3계층 BFF 패턴으로 구현한다.

**Architecture:** 클라이언트(`getBff/postBff`) → same-origin BFF(`proxyAuthed`) → Spring BE(`/api/verified-performers/**`, `/api/admin/verified-performers/**`). 회원 페이지는 `GET /applications/me` 결과로 상태 분기, 어드민 페이지는 `useInfiniteList` + status 필터. 거절/철회 사유는 인라인 펼 토글로 수집.

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript / Tailwind / Vitest(jsdom + node env).

---

## BE 계약 (확인 완료)

- 회원: `POST /api/verified-performers/applications`(`{statement(필수≤1000), evidenceUrls(≤10)}`) / `GET /api/verified-performers/applications/me`(없으면 data null).
- 어드민: `GET /api/admin/verified-performers/applications?status=PENDING&page=&size=`(`Page`) / `POST .../applications/{id}/approve`(body `{reason}` **선택**, 없으면 무body) / `POST .../{id}/reject`·`.../{id}/revoke`(body `{reason(필수≤500)}`) / `POST .../grant`(`{memberId(필수), reason(선택)}`).
- `ApplicationResponse` = `{ id, memberId, statement, evidenceUrls: string[], status: 'PENDING'|'APPROVED'|'REJECTED'|'REVOKED', decisionReason: string|null, decidedBy: number|null, decidedAt: string|null, createdAt }`.
- 활성 신청(PENDING/APPROVED) 유일 → 재신청 409. 에러코드 404-04/409-04/409-05/409-06. BFF가 message 그대로 전달.
- **제약**: 응답에 memberId(Long)만 있고 닉네임 없음 → 어드민 목록은 "회원 #{memberId}" 표시.

## 파일 구조

**생성:**
- `FE/lib/verification/types.ts`, `FE/lib/verification/logic.ts`
- `FE/app/api/bff/verified-performers/applications/route.ts` — POST 신청
- `FE/app/api/bff/verified-performers/applications/me/route.ts` — GET 내 상태
- `FE/app/api/bff/admin/verified-performers/applications/route.ts` — GET 목록
- `FE/app/api/bff/admin/verified-performers/applications/[id]/approve/route.ts` — POST
- `FE/app/api/bff/admin/verified-performers/applications/[id]/reject/route.ts` — POST
- `FE/app/api/bff/admin/verified-performers/applications/[id]/revoke/route.ts` — POST
- `FE/app/api/bff/admin/verified-performers/grant/route.ts` — POST
- `FE/components/verification/EvidenceUrlsInput.tsx`
- `FE/components/verification/ApplyForm.tsx`
- `FE/components/verification/MyStatusCard.tsx`
- `FE/components/verification/ApplicationReviewItem.tsx`
- `FE/components/verification/GrantForm.tsx`
- `FE/app/verified-performer/page.tsx` — 회원 페이지
- `FE/app/admin/verified-performers/page.tsx` — 어드민 페이지
- 각 대응 테스트 `FE/__tests__/*.test.ts(x)`

**수정:** `FE/app/profile/page.tsx` — 뷰 모드에 "인증 연주자" 진입 링크 1개 추가.

## 재사용(기존 파일)

- `@/lib/feed/useInfiniteList` — `useInfiniteList<T extends {id:number}>(fetchPage)` → `{items, isLoading, error, hasMore, sentinelRef}`
- `@/lib/feed/types` — `Me = { id, nickname, role:'USER'|'ADMIN', verified }`, `CursorPage<T>`
- `@/lib/api` — `getBff/postBff`
- `@/lib/server/bffProxy` — `proxyAuthed(path, init?)`
- `/api/bff/me/identity` — 신원 프로브(기존)

---

## Task 1: 브랜치 + 타입 + 순수 로직

**Files:**
- Create: `FE/lib/verification/types.ts`, `FE/lib/verification/logic.ts`
- Test: `FE/__tests__/verification-logic.test.ts`

- [ ] **Step 1: 작업 브랜치 생성(main에서 분기)**

```bash
cd /Users/predevho/Desktop/Attaca && git checkout main && git checkout -b feature/verified-performer-fe
```

- [ ] **Step 2: 타입 파일** — `FE/lib/verification/types.ts`

```ts
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export type Application = {
  id: number;
  memberId: number;
  statement: string;
  evidenceUrls: string[];
  status: VerificationStatus;
  decisionReason: string | null;
  decidedBy: number | null;
  decidedAt: string | null;
  createdAt: string;
};

/** 신청/재신청 폼 값. */
export type ApplyFormValues = { statement: string; evidenceUrls: string[] };

/** 어드민 직접지정 폼 값(입력은 문자열, 전송 시 변환). */
export type GrantFormValues = { memberId: string; reason: string };

/** Spring Page 응답 중 FE가 쓰는 필드만. */
export type SpringPage<T> = { content: T[]; number: number; totalPages: number; last: boolean };
```

- [ ] **Step 3: 로직 테스트(실패)** — `FE/__tests__/verification-logic.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  toCursorPage, validateApply, validateReason, validateGrant,
  statusLabel, canReapply, toApplyRequest, toGrantRequest,
} from '@/lib/verification/logic';
import type { ApplyFormValues } from '@/lib/verification/types';

const base: ApplyFormValues = { statement: '오케스트라 5년 활동했습니다', evidenceUrls: [] };

describe('toCursorPage', () => {
  it('마지막 아니면 nextCursor=number+1', () =>
    expect(toCursorPage({ content: [{ id: 1 } as never], number: 0, totalPages: 2, last: false }))
      .toEqual({ items: [{ id: 1 }], nextCursor: 1 }));
  it('마지막이면 null', () =>
    expect(toCursorPage({ content: [], number: 1, totalPages: 2, last: true }))
      .toEqual({ items: [], nextCursor: null }));
});

describe('validateApply', () => {
  it('유효하면 null', () => expect(validateApply(base)).toBeNull());
  it('사유 없으면 에러', () => expect(validateApply({ ...base, statement: '  ' })).toMatch(/사유/));
  it('사유 1000자 초과 에러', () => expect(validateApply({ ...base, statement: 'a'.repeat(1001) })).toMatch(/1000자/));
  it('링크 11개(빈 값 제외) 초과 에러', () =>
    expect(validateApply({ ...base, evidenceUrls: Array(11).fill('http://x') })).toMatch(/10개/));
  it('빈 링크는 개수에서 제외', () =>
    expect(validateApply({ ...base, evidenceUrls: ['http://x', '', '  '] })).toBeNull());
});

describe('validateReason', () => {
  it('사유 없으면 에러', () => expect(validateReason('  ')).toMatch(/사유/));
  it('500자 초과 에러', () => expect(validateReason('a'.repeat(501))).toMatch(/500자/));
  it('유효하면 null', () => expect(validateReason('증빙 부족')).toBeNull());
});

describe('validateGrant', () => {
  it('빈 id 에러', () => expect(validateGrant({ memberId: '', reason: '' })).toMatch(/회원/));
  it('0/음수 에러', () => expect(validateGrant({ memberId: '0', reason: '' })).toMatch(/회원/));
  it('정수면 null', () => expect(validateGrant({ memberId: '5', reason: '' })).toBeNull());
});

describe('statusLabel', () => {
  it('PENDING→심사 중', () => expect(statusLabel('PENDING')).toBe('심사 중'));
  it('APPROVED→승인됨', () => expect(statusLabel('APPROVED')).toBe('승인됨'));
});

describe('canReapply', () => {
  it('REJECTED/REVOKED만 true', () => {
    expect(canReapply('REJECTED')).toBe(true);
    expect(canReapply('REVOKED')).toBe(true);
    expect(canReapply('PENDING')).toBe(false);
    expect(canReapply('APPROVED')).toBe(false);
  });
});

describe('toApplyRequest', () => {
  it('빈/공백 링크 제거 + trim', () =>
    expect(toApplyRequest({ statement: 's', evidenceUrls: [' http://a ', '', '  '] }))
      .toEqual({ statement: 's', evidenceUrls: ['http://a'] }));
});

describe('toGrantRequest', () => {
  it('memberId 숫자화, 빈 reason은 null', () =>
    expect(toGrantRequest({ memberId: '7', reason: '  ' })).toEqual({ memberId: 7, reason: null }));
  it('reason 있으면 그대로', () =>
    expect(toGrantRequest({ memberId: '7', reason: '수상 이력' })).toEqual({ memberId: 7, reason: '수상 이력' }));
});
```

- [ ] **Step 4: 실패 확인** — Run: `cd FE && npx vitest run __tests__/verification-logic.test.ts` → FAIL(모듈 없음)

- [ ] **Step 5: 로직 구현** — `FE/lib/verification/logic.ts`

```ts
import type { CursorPage } from '@/lib/feed/types';
import type { ApplyFormValues, GrantFormValues, SpringPage, VerificationStatus } from '@/lib/verification/types';

/** Spring Page(오프셋)를 커서 페이지 계약으로 변환 → useInfiniteList 재사용. */
export function toCursorPage<T>(page: SpringPage<T>): CursorPage<T> {
  return { items: page.content, nextCursor: page.last ? null : page.number + 1 };
}

/** 신청 폼 검증. 첫 에러 또는 null. BE ApplyRequest 규칙과 일치(빈 링크는 개수에서 제외). */
export function validateApply(v: ApplyFormValues): string | null {
  if (!v.statement.trim()) return '지원 사유를 입력해 주세요.';
  if (v.statement.length > 1000) return '지원 사유는 1000자를 넘을 수 없습니다.';
  const nonEmpty = v.evidenceUrls.filter((u) => u.trim() !== '');
  if (nonEmpty.length > 10) return '증빙 링크는 최대 10개까지 첨부할 수 있습니다.';
  return null;
}

/** 거절/철회 사유 검증(필수·≤500). */
export function validateReason(reason: string): string | null {
  if (!reason.trim()) return '처리 사유를 입력해 주세요.';
  if (reason.length > 500) return '처리 사유는 500자를 넘을 수 없습니다.';
  return null;
}

/** 직접지정 폼 검증(회원 id 양의 정수). reason은 BE 제한 없음. */
export function validateGrant(v: GrantFormValues): string | null {
  const n = Number(v.memberId);
  if (v.memberId.trim() === '' || !Number.isInteger(n) || n < 1) return '회원 id를 입력해 주세요.';
  return null;
}

export function statusLabel(status: VerificationStatus): string {
  switch (status) {
    case 'PENDING': return '심사 중';
    case 'APPROVED': return '승인됨';
    case 'REJECTED': return '거절됨';
    case 'REVOKED': return '철회됨';
  }
}

/** 재신청 가능 여부. 활성 신청(PENDING/APPROVED)은 불가, 종료 상태만 가능. */
export function canReapply(status: VerificationStatus): boolean {
  return status === 'REJECTED' || status === 'REVOKED';
}

/** 폼 값 → 신청 요청. 빈/공백 링크 제거 + trim. */
export function toApplyRequest(v: ApplyFormValues) {
  return { statement: v.statement, evidenceUrls: v.evidenceUrls.map((u) => u.trim()).filter((u) => u !== '') };
}

/** 폼 값 → 직접지정 요청. memberId 숫자화, 빈 reason은 null. */
export function toGrantRequest(v: GrantFormValues) {
  return { memberId: Number(v.memberId), reason: v.reason.trim() === '' ? null : v.reason };
}
```

- [ ] **Step 6: 통과 확인** — Run: `cd FE && npx vitest run __tests__/verification-logic.test.ts` → PASS

- [ ] **Step 7: 커밋**

```bash
git add FE/lib/verification FE/__tests__/verification-logic.test.ts
git commit -m "feat: 인증 연주자 FE 타입·순수 로직(검증/변환/상태) + 테스트"
```

---

## Task 2: BFF 회원 라우트 (신청/내 상태)

**Files:**
- Create: `FE/app/api/bff/verified-performers/applications/route.ts`, `FE/app/api/bff/verified-performers/applications/me/route.ts`
- Test: `FE/__tests__/bff-verified-performers.test.ts`

- [ ] **Step 1: 테스트(실패)** — `FE/__tests__/bff-verified-performers.test.ts`

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

describe('BFF 인증 연주자 회원 라우트', () => {
  it('POST 신청은 본문을 BE로 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { id: 1 }, error: null }));
    vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/verified-performers/applications/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ statement: 's' }) }));
    expect(res.status).toBe(200);
    expect(String(f.mock.calls[0][0])).toContain('/api/verified-performers/applications');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('GET 내 상태는 BE me 경로', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: null, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/verified-performers/applications/me/route');
    await GET();
    expect(String(f.mock.calls[0][0])).toContain('/api/verified-performers/applications/me');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd FE && npx vitest run __tests__/bff-verified-performers.test.ts` → FAIL

- [ ] **Step 3: 신청 라우트** — `FE/app/api/bff/verified-performers/applications/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAuthed('/api/verified-performers/applications', { method: 'POST', body });
}
```

- [ ] **Step 4: 내 상태 라우트** — `FE/app/api/bff/verified-performers/applications/me/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET() {
  return proxyAuthed('/api/verified-performers/applications/me');
}
```

- [ ] **Step 5: 통과 확인** — Run: `cd FE && npx vitest run __tests__/bff-verified-performers.test.ts` → PASS

- [ ] **Step 6: 커밋**

```bash
git add FE/app/api/bff/verified-performers FE/__tests__/bff-verified-performers.test.ts
git commit -m "feat: 인증 연주자 회원 BFF 라우트(신청/내 상태)"
```

---

## Task 3: BFF 어드민 라우트 (목록/승인/거절/철회/직접지정)

**Files:**
- Create: `FE/app/api/bff/admin/verified-performers/applications/route.ts`, `.../applications/[id]/approve/route.ts`, `.../reject/route.ts`, `.../revoke/route.ts`, `.../grant/route.ts`
- Test: `FE/__tests__/bff-admin-verified-performers.test.ts`

- [ ] **Step 1: 테스트(실패)** — `FE/__tests__/bff-admin-verified-performers.test.ts`

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

describe('BFF 인증 연주자 어드민 라우트', () => {
  it('GET 목록은 status/page 쿼리 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/admin/verified-performers/applications/route');
    await GET(new Request('http://x/api/bff/admin/verified-performers/applications?status=APPROVED&page=1'));
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/admin/verified-performers/applications');
    expect(url).toContain('status=APPROVED');
    expect(url).toContain('page=1');
  });

  it('approve는 무body POST로 BE approve 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/admin/verified-performers/applications/[id]/approve/route');
    await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: '3' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/admin/verified-performers/applications/3/approve');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('reject/revoke는 본문(사유)과 함께 각 경로로 POST', async () => {
    for (const action of ['reject', 'revoke'] as const) {
      const f = okFetch(); vi.stubGlobal('fetch', f);
      const { POST } = await import(`@/app/api/bff/admin/verified-performers/applications/[id]/${action}/route`);
      await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ reason: 'r' }) }), { params: Promise.resolve({ id: '3' }) });
      expect(String(f.mock.calls[0][0])).toContain(`/api/admin/verified-performers/applications/3/${action}`);
      expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
      vi.unstubAllGlobals();
    }
  });

  it('grant는 본문과 함께 BE grant 경로로 POST', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/admin/verified-performers/grant/route');
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ memberId: 5 }) }));
    expect(String(f.mock.calls[0][0])).toContain('/api/admin/verified-performers/grant');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd FE && npx vitest run __tests__/bff-admin-verified-performers.test.ts` → FAIL

- [ ] **Step 3: 목록 라우트** — `FE/app/api/bff/admin/verified-performers/applications/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?status=&page=&size=
  return proxyAuthed('/api/admin/verified-performers/applications' + search);
}
```

- [ ] **Step 4: approve 라우트(무body)** — `FE/app/api/bff/admin/verified-performers/applications/[id]/approve/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/admin/verified-performers/applications/${id}/approve`, { method: 'POST' });
}
```

- [ ] **Step 5: reject 라우트(body)** — `FE/app/api/bff/admin/verified-performers/applications/[id]/reject/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/admin/verified-performers/applications/${id}/reject`, { method: 'POST', body });
}
```

- [ ] **Step 6: revoke 라우트(body)** — `FE/app/api/bff/admin/verified-performers/applications/[id]/revoke/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/admin/verified-performers/applications/${id}/revoke`, { method: 'POST', body });
}
```

- [ ] **Step 7: grant 라우트(body)** — `FE/app/api/bff/admin/verified-performers/grant/route.ts`

```ts
import { proxyAuthed } from '@/lib/server/bffProxy';

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAuthed('/api/admin/verified-performers/grant', { method: 'POST', body });
}
```

- [ ] **Step 8: 통과 확인** — Run: `cd FE && npx vitest run __tests__/bff-admin-verified-performers.test.ts` → PASS

- [ ] **Step 9: 커밋**

```bash
git add FE/app/api/bff/admin FE/__tests__/bff-admin-verified-performers.test.ts
git commit -m "feat: 인증 연주자 어드민 BFF 라우트(목록/승인·거절·철회/직접지정)"
```

---

## Task 4: EvidenceUrlsInput (동적 증빙 링크 입력)

controlled 컴포넌트. 부모가 `urls` 배열을 소유하고 `onChange`로 갱신. 최대 10개.

**Files:**
- Create: `FE/components/verification/EvidenceUrlsInput.tsx`
- Test: `FE/__tests__/evidence-urls-input.test.tsx`

- [ ] **Step 1: 테스트(실패)** — `FE/__tests__/evidence-urls-input.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceUrlsInput } from '@/components/verification/EvidenceUrlsInput';

describe('EvidenceUrlsInput', () => {
  it('링크 추가 클릭 시 빈 항목이 추가된다', () => {
    const onChange = vi.fn();
    render(<EvidenceUrlsInput urls={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '링크 추가' }));
    expect(onChange).toHaveBeenCalledWith(['']);
  });

  it('입력 변경 시 해당 인덱스만 갱신', () => {
    const onChange = vi.fn();
    render(<EvidenceUrlsInput urls={['a', 'b']} onChange={onChange} />);
    fireEvent.change(screen.getAllByLabelText(/증빙 링크/)[1], { target: { value: 'B' } });
    expect(onChange).toHaveBeenCalledWith(['a', 'B']);
  });

  it('삭제 클릭 시 해당 항목 제거', () => {
    const onChange = vi.fn();
    render(<EvidenceUrlsInput urls={['a', 'b']} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('10개면 링크 추가 버튼 비활성', () => {
    render(<EvidenceUrlsInput urls={Array(10).fill('x')} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '링크 추가' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd FE && npx vitest run __tests__/evidence-urls-input.test.tsx` → FAIL

- [ ] **Step 3: 구현** — `FE/components/verification/EvidenceUrlsInput.tsx`

```tsx
export function EvidenceUrlsInput({
  urls, onChange,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  function setAt(i: number, value: string) {
    onChange(urls.map((u, idx) => (idx === i ? value : u)));
  }
  function removeAt(i: number) {
    onChange(urls.filter((_, idx) => idx !== i));
  }
  function add() {
    if (urls.length >= 10) return;
    onChange([...urls, '']);
  }
  return (
    <div className="flex flex-col gap-2">
      {urls.map((u, i) => (
        <div key={i} className="flex gap-2">
          <input aria-label={`증빙 링크 ${i + 1}`} value={u} onChange={(e) => setAt(i, e.target.value)}
            placeholder="https://..." className="flex-1 rounded border px-3 py-2 text-sm" />
          <button type="button" onClick={() => removeAt(i)} className="rounded border px-3 py-1 text-xs">삭제</button>
        </div>
      ))}
      <button type="button" onClick={add} disabled={urls.length >= 10}
        className="self-start rounded border px-3 py-1 text-xs disabled:opacity-40">링크 추가</button>
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `cd FE && npx vitest run __tests__/evidence-urls-input.test.tsx` → PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/verification/EvidenceUrlsInput.tsx FE/__tests__/evidence-urls-input.test.tsx
git commit -m "feat: 인증 연주자 증빙 링크 동적 입력 EvidenceUrlsInput + 테스트"
```

---

## Task 5: ApplyForm (신청/재신청 공용 폼)

**Files:**
- Create: `FE/components/verification/ApplyForm.tsx`
- Test: `FE/__tests__/verification-apply-form.test.tsx`

- [ ] **Step 1: 테스트(실패)** — `FE/__tests__/verification-apply-form.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplyForm } from '@/components/verification/ApplyForm';

describe('ApplyForm', () => {
  it('사유 없으면 onSubmit 미호출 + 에러', () => {
    const onSubmit = vi.fn();
    render(<ApplyForm submitting={false} submitLabel="신청" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '신청' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('지원 사유를 입력해 주세요.')).toBeInTheDocument();
  });

  it('유효 입력이면 폼 값과 함께 onSubmit', () => {
    const onSubmit = vi.fn();
    render(<ApplyForm submitting={false} submitLabel="신청" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('지원 사유'), { target: { value: '5년 활동' } });
    fireEvent.click(screen.getByRole('button', { name: '신청' }));
    expect(onSubmit).toHaveBeenCalledWith({ statement: '5년 활동', evidenceUrls: [] });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd FE && npx vitest run __tests__/verification-apply-form.test.tsx` → FAIL

- [ ] **Step 3: 구현** — `FE/components/verification/ApplyForm.tsx`

```tsx
'use client';

import { useState } from 'react';
import { validateApply } from '@/lib/verification/logic';
import { EvidenceUrlsInput } from '@/components/verification/EvidenceUrlsInput';
import type { ApplyFormValues } from '@/lib/verification/types';

export function ApplyForm({
  submitting, submitLabel, onSubmit,
}: {
  submitting: boolean;
  submitLabel: string;
  onSubmit: (v: ApplyFormValues) => void;
}) {
  const [statement, setStatement] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const v: ApplyFormValues = { statement, evidenceUrls };
    const err = validateApply(v);
    if (err) { setError(err); return; }
    setError(null);
    onSubmit(v);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">지원 사유</span>
        <textarea aria-label="지원 사유" value={statement} maxLength={1000}
          onChange={(e) => setStatement(e.target.value)} className="h-32 rounded border px-3 py-2" />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">증빙 링크 (최대 10개)</span>
        <EvidenceUrlsInput urls={evidenceUrls} onChange={setEvidenceUrls} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={submit} disabled={submitting}
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-40">
        {submitting ? '처리 중...' : submitLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `cd FE && npx vitest run __tests__/verification-apply-form.test.tsx` → PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/verification/ApplyForm.tsx FE/__tests__/verification-apply-form.test.tsx
git commit -m "feat: 인증 연주자 신청 폼 ApplyForm + 테스트"
```

---

## Task 6: MyStatusCard (회원 현재 상태 표시)

**Files:**
- Create: `FE/components/verification/MyStatusCard.tsx`
- Test: `FE/__tests__/my-status-card.test.tsx`

- [ ] **Step 1: 테스트(실패)** — `FE/__tests__/my-status-card.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyStatusCard } from '@/components/verification/MyStatusCard';
import type { Application } from '@/lib/verification/types';

const app: Application = {
  id: 1, memberId: 2, statement: '5년 활동', evidenceUrls: ['http://a'],
  status: 'PENDING', decisionReason: null, decidedBy: null, decidedAt: null, createdAt: '2026-08-01T00:00',
};

describe('MyStatusCard', () => {
  it('PENDING이면 심사 중 문구', () => {
    render(<MyStatusCard application={app} />);
    expect(screen.getByText(/심사 중/)).toBeInTheDocument();
    expect(screen.getByText('5년 활동')).toBeInTheDocument();
  });

  it('APPROVED이면 승인 문구', () => {
    render(<MyStatusCard application={{ ...app, status: 'APPROVED' }} />);
    expect(screen.getByText(/승인/)).toBeInTheDocument();
  });

  it('REJECTED이면 사유 표시', () => {
    render(<MyStatusCard application={{ ...app, status: 'REJECTED', decisionReason: '증빙 부족' }} />);
    expect(screen.getByText('증빙 부족')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd FE && npx vitest run __tests__/my-status-card.test.tsx` → FAIL

- [ ] **Step 3: 구현** — `FE/components/verification/MyStatusCard.tsx`

```tsx
import { statusLabel } from '@/lib/verification/logic';
import type { Application } from '@/lib/verification/types';

const MESSAGE: Record<Application['status'], string> = {
  PENDING: '심사 중입니다. 결과를 기다려 주세요.',
  APPROVED: '인증 연주자로 승인되었습니다.',
  REJECTED: '신청이 거절되었습니다.',
  REVOKED: '인증이 철회되었습니다.',
};

export function MyStatusCard({ application }: { application: Application }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{statusLabel(application.status)}</span>
        <p className="text-sm">{MESSAGE[application.status]}</p>
      </div>
      <div className="text-sm text-gray-700">
        <span className="text-gray-500">지원 사유</span>
        <p className="whitespace-pre-wrap">{application.statement}</p>
      </div>
      {application.evidenceUrls.length > 0 && (
        <ul className="text-sm">
          {application.evidenceUrls.map((u, i) => (
            <li key={i}><a href={u} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{u}</a></li>
          ))}
        </ul>
      )}
      {application.decisionReason && (
        <div className="text-sm text-gray-700">
          <span className="text-gray-500">처리 사유</span>
          <p className="whitespace-pre-wrap">{application.decisionReason}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `cd FE && npx vitest run __tests__/my-status-card.test.tsx` → PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/verification/MyStatusCard.tsx FE/__tests__/my-status-card.test.tsx
git commit -m "feat: 인증 연주자 내 상태 카드 MyStatusCard + 테스트"
```

---

## Task 7: 회원 페이지 `/verified-performer` + 프로필 진입 링크

**Files:**
- Create: `FE/app/verified-performer/page.tsx`
- Modify: `FE/app/profile/page.tsx` (뷰 모드 버튼 줄에 링크 1개 추가)
- Test: `FE/__tests__/verified-performer-page.test.tsx`

- [ ] **Step 1: 테스트(실패)** — `FE/__tests__/verified-performer-page.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (...a: unknown[]) => postBff(...a) }));

import VerifiedPerformerPage from '@/app/verified-performer/page';

function mockMe(application: unknown) {
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: 'A', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/verified-performers/applications/me')) return Promise.resolve({ ok: true, data: application });
    return Promise.resolve({ ok: false, message: 'x' });
  });
}
const base = { id: 1, memberId: 2, statement: '5년', evidenceUrls: [], decisionReason: null, decidedBy: null, decidedAt: null, createdAt: '' };

beforeEach(() => { push.mockReset(); getBff.mockReset(); postBff.mockReset(); });

describe('VerifiedPerformerPage', () => {
  it('이력 없으면 신청 폼', async () => {
    mockMe(null);
    render(<VerifiedPerformerPage />);
    expect(await screen.findByRole('button', { name: '신청' })).toBeInTheDocument();
  });

  it('PENDING이면 심사 중 카드(폼 없음)', async () => {
    mockMe({ ...base, status: 'PENDING' });
    render(<VerifiedPerformerPage />);
    expect(await screen.findByText(/심사 중/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '신청' })).not.toBeInTheDocument();
  });

  it('REJECTED이면 사유 + 재신청 폼', async () => {
    mockMe({ ...base, status: 'REJECTED', decisionReason: '증빙 부족' });
    render(<VerifiedPerformerPage />);
    expect(await screen.findByText('증빙 부족')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '재신청' })).toBeInTheDocument();
  });

  it('신청 성공 시 상태 재조회', async () => {
    // 최초 null → 제출 후 PENDING
    let call = 0;
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: 'A', role: 'USER', verified: false } });
      if (p.startsWith('/api/bff/verified-performers/applications/me')) {
        call += 1;
        return Promise.resolve({ ok: true, data: call === 1 ? null : { ...base, status: 'PENDING' } });
      }
      return Promise.resolve({ ok: false, message: 'x' });
    });
    postBff.mockResolvedValue({ ok: true, data: { ...base, status: 'PENDING' } });
    render(<VerifiedPerformerPage />);
    fireEvent.change(await screen.findByLabelText('지원 사유'), { target: { value: '5년' } });
    fireEvent.click(screen.getByRole('button', { name: '신청' }));
    await waitFor(() => expect(screen.getByText(/심사 중/)).toBeInTheDocument());
    expect(postBff).toHaveBeenCalledWith('/api/bff/verified-performers/applications', { statement: '5년', evidenceUrls: [] });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd FE && npx vitest run __tests__/verified-performer-page.test.tsx` → FAIL

- [ ] **Step 3: 구현** — `FE/app/verified-performer/page.tsx`

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { canReapply, toApplyRequest } from '@/lib/verification/logic';
import { ApplyForm } from '@/components/verification/ApplyForm';
import { MyStatusCard } from '@/components/verification/MyStatusCard';
import type { Application, ApplyFormValues } from '@/lib/verification/types';

export default function VerifiedPerformerPage() {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const r = await getBff<Application | null>('/api/bff/verified-performers/applications/me');
    if (r.ok) setApplication((r.data as Application | null) ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => { if (!r.ok) router.push('/login'); });
    loadStatus();
  }, [router, loadStatus]);

  async function submit(v: ApplyFormValues) {
    setSubmitting(true);
    setError(null);
    const r = await postBff('/api/bff/verified-performers/applications', toApplyRequest(v));
    setSubmitting(false);
    if (r.ok) { await loadStatus(); }
    else setError(r.message ?? '신청에 실패했습니다.');
  }

  if (!loaded) return <main className="mx-auto mt-16 max-w-xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  const showForm = application === null || canReapply(application.status);

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-bold">인증 연주자</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {application && <div className="mb-4"><MyStatusCard application={application} /></div>}
      {showForm && (
        <ApplyForm submitting={submitting} submitLabel={application ? '재신청' : '신청'} onSubmit={submit} />
      )}
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `cd FE && npx vitest run __tests__/verified-performer-page.test.tsx` → PASS

- [ ] **Step 5: 프로필 진입 링크 추가** — `FE/app/profile/page.tsx` 뷰 모드의 대시보드 링크 옆에 버튼 추가.

기존:
```tsx
          <div className="mt-2 flex gap-2">
            <button onClick={startEdit} className="rounded bg-black px-4 py-2 text-white">수정</button>
            <a href="/dashboard" className="rounded border px-4 py-2 text-center">대시보드</a>
          </div>
```
변경:
```tsx
          <div className="mt-2 flex gap-2">
            <button onClick={startEdit} className="rounded bg-black px-4 py-2 text-white">수정</button>
            <a href="/dashboard" className="rounded border px-4 py-2 text-center">대시보드</a>
            <button onClick={() => router.push('/verified-performer')} className="rounded border px-4 py-2 text-center">인증 연주자</button>
          </div>
```

(`router`는 이미 `useRouter()`로 선언돼 있음 — 추가 import 불필요.)

- [ ] **Step 6: 프로필 회귀 확인** — Run: `cd FE && npx vitest run __tests__/profile-page.test.tsx` (있으면) 또는 프로필 관련 테스트. 없으면 전체에서 프로필 테스트가 통과하는지 확인. Expected: 기존 테스트 그대로 통과(버튼 추가만).

- [ ] **Step 7: 커밋**

```bash
git add FE/app/verified-performer FE/app/profile/page.tsx FE/__tests__/verified-performer-page.test.tsx
git commit -m "feat: 인증 연주자 회원 페이지(상태별 분기) + 프로필 진입 링크"
```

---

## Task 8: ApplicationReviewItem (어드민 항목: 승인/거절/철회)

승인은 즉시. 거절/철회는 인라인 사유 토글(`validateReason`). REJECTED/REVOKED는 액션 없음.

**Files:**
- Create: `FE/components/verification/ApplicationReviewItem.tsx`
- Test: `FE/__tests__/application-review-item.test.tsx`

- [ ] **Step 1: 테스트(실패)** — `FE/__tests__/application-review-item.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicationReviewItem } from '@/components/verification/ApplicationReviewItem';
import type { Application } from '@/lib/verification/types';

const pending: Application = {
  id: 1, memberId: 5, statement: '5년 활동', evidenceUrls: ['http://a'],
  status: 'PENDING', decisionReason: null, decidedBy: null, decidedAt: null, createdAt: '2026-08-01T00:00',
};

function handlers() { return { onApprove: vi.fn(), onReject: vi.fn(), onRevoke: vi.fn() }; }

describe('ApplicationReviewItem', () => {
  it('회원 id·사유 표시', () => {
    render(<ApplicationReviewItem application={pending} {...handlers()} />);
    expect(screen.getByText(/회원 #5/)).toBeInTheDocument();
    expect(screen.getByText('5년 활동')).toBeInTheDocument();
  });

  it('PENDING: 승인 클릭 시 즉시 onApprove(id)', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={pending} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    expect(h.onApprove).toHaveBeenCalledWith(1);
  });

  it('PENDING: 거절은 사유 펼침 후 제출 시 onReject(id, reason)', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={pending} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: '거절' }));
    fireEvent.change(screen.getByLabelText('처리 사유'), { target: { value: '증빙 부족' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(h.onReject).toHaveBeenCalledWith(1, '증빙 부족');
  });

  it('거절 사유 비면 제출 막고 에러', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={pending} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: '거절' }));
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(h.onReject).not.toHaveBeenCalled();
    expect(screen.getByText(/사유/)).toBeInTheDocument();
  });

  it('APPROVED: 철회만 노출, 제출 시 onRevoke(id, reason)', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={{ ...pending, status: 'APPROVED' }} {...h} />);
    expect(screen.queryByRole('button', { name: '승인' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '철회' }));
    fireEvent.change(screen.getByLabelText('처리 사유'), { target: { value: '자격 상실' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(h.onRevoke).toHaveBeenCalledWith(1, '자격 상실');
  });

  it('REJECTED: 액션 없음, 사유 표시', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={{ ...pending, status: 'REJECTED', decisionReason: '부족' }} {...h} />);
    expect(screen.queryByRole('button', { name: '승인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '거절' })).not.toBeInTheDocument();
    expect(screen.getByText('부족')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd FE && npx vitest run __tests__/application-review-item.test.tsx` → FAIL

- [ ] **Step 3: 구현** — `FE/components/verification/ApplicationReviewItem.tsx`

```tsx
'use client';

import { useState } from 'react';
import { statusLabel, validateReason } from '@/lib/verification/logic';
import type { Application } from '@/lib/verification/types';

export function ApplicationReviewItem({
  application, onApprove, onReject, onRevoke,
}: {
  application: Application;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
  onRevoke: (id: number, reason: string) => void;
}) {
  const [mode, setMode] = useState<'reject' | 'revoke' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submitReason() {
    const err = validateReason(reason);
    if (err) { setError(err); return; }
    setError(null);
    if (mode === 'reject') onReject(application.id, reason);
    else if (mode === 'revoke') onRevoke(application.id, reason);
  }

  return (
    <li className="flex flex-col gap-2 rounded border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">회원 #{application.memberId}</span>
        <span className="text-xs text-gray-500">{statusLabel(application.status)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-700">{application.statement}</p>
      {application.evidenceUrls.length > 0 && (
        <ul className="text-sm">
          {application.evidenceUrls.map((u, i) => (
            <li key={i}><a href={u} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{u}</a></li>
          ))}
        </ul>
      )}
      {application.decisionReason && (
        <p className="text-sm text-gray-500">처리 사유: {application.decisionReason}</p>
      )}

      {application.status === 'PENDING' && (
        <div className="flex gap-2">
          <button type="button" onClick={() => onApprove(application.id)}
            className="rounded bg-black px-3 py-1 text-xs text-white">승인</button>
          <button type="button" onClick={() => { setMode('reject'); setError(null); }}
            className="rounded border px-3 py-1 text-xs">거절</button>
        </div>
      )}
      {application.status === 'APPROVED' && (
        <div className="flex gap-2">
          <button type="button" onClick={() => { setMode('revoke'); setError(null); }}
            className="rounded border px-3 py-1 text-xs">철회</button>
        </div>
      )}

      {mode && (
        <div className="flex flex-col gap-2 rounded border p-2">
          <textarea aria-label="처리 사유" value={reason} maxLength={500}
            onChange={(e) => setReason(e.target.value)} placeholder="처리 사유를 입력하세요"
            className="h-20 rounded border px-3 py-2 text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={submitReason}
              className="rounded bg-black px-3 py-1 text-xs text-white">제출</button>
            <button type="button" onClick={() => { setMode(null); setError(null); }}
              className="rounded border px-3 py-1 text-xs">취소</button>
          </div>
        </div>
      )}
    </li>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `cd FE && npx vitest run __tests__/application-review-item.test.tsx` → PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/verification/ApplicationReviewItem.tsx FE/__tests__/application-review-item.test.tsx
git commit -m "feat: 인증 연주자 어드민 심사 항목 ApplicationReviewItem(승인/거절/철회) + 테스트"
```

---

## Task 9: GrantForm (어드민 직접지정)

**Files:**
- Create: `FE/components/verification/GrantForm.tsx`
- Test: `FE/__tests__/grant-form.test.tsx`

- [ ] **Step 1: 테스트(실패)** — `FE/__tests__/grant-form.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrantForm } from '@/components/verification/GrantForm';

describe('GrantForm', () => {
  it('빈 id면 onGrant 미호출 + 에러', () => {
    const onGrant = vi.fn();
    render(<GrantForm submitting={false} onGrant={onGrant} />);
    fireEvent.click(screen.getByRole('button', { name: '직접지정' }));
    expect(onGrant).not.toHaveBeenCalled();
    expect(screen.getByText(/회원/)).toBeInTheDocument();
  });

  it('유효 입력이면 onGrant(values)', () => {
    const onGrant = vi.fn();
    render(<GrantForm submitting={false} onGrant={onGrant} />);
    fireEvent.change(screen.getByLabelText('회원 id'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('사유(선택)'), { target: { value: '수상 이력' } });
    fireEvent.click(screen.getByRole('button', { name: '직접지정' }));
    expect(onGrant).toHaveBeenCalledWith({ memberId: '7', reason: '수상 이력' });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd FE && npx vitest run __tests__/grant-form.test.tsx` → FAIL

- [ ] **Step 3: 구현** — `FE/components/verification/GrantForm.tsx`

```tsx
'use client';

import { useState } from 'react';
import { validateGrant } from '@/lib/verification/logic';
import type { GrantFormValues } from '@/lib/verification/types';

export function GrantForm({
  submitting, onGrant,
}: {
  submitting: boolean;
  onGrant: (v: GrantFormValues) => void;
}) {
  const [memberId, setMemberId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const v: GrantFormValues = { memberId, reason };
    const err = validateGrant(v);
    if (err) { setError(err); return; }
    setError(null);
    onGrant(v);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <h2 className="text-sm font-medium text-gray-500">직접지정</h2>
      <div className="flex gap-2">
        <input aria-label="회원 id" type="number" min={1} value={memberId}
          onChange={(e) => setMemberId(e.target.value)} placeholder="회원 id"
          className="w-32 rounded border px-3 py-2 text-sm" />
        <input aria-label="사유(선택)" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="사유(선택)" className="flex-1 rounded border px-3 py-2 text-sm" />
        <button type="button" onClick={submit} disabled={submitting}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40">직접지정</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `cd FE && npx vitest run __tests__/grant-form.test.tsx` → PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/components/verification/GrantForm.tsx FE/__tests__/grant-form.test.tsx
git commit -m "feat: 인증 연주자 어드민 직접지정 GrantForm + 테스트"
```

---

## Task 10: 어드민 페이지 `/admin/verified-performers`

역할 게이트 + status 탭 + 무한스크롤 목록 + 승인/거절/철회 + 직접지정. 액션 성공 시 목록 재조회(refreshKey로 리스트 재마운트).

**Files:**
- Create: `FE/app/admin/verified-performers/page.tsx`
- Test: `FE/__tests__/admin-verified-performers-page.test.tsx`

- [ ] **Step 1: 테스트(실패)** — `FE/__tests__/admin-verified-performers-page.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (...a: unknown[]) => postBff(...a) }));

import AdminVerifiedPerformersPage from '@/app/admin/verified-performers/page';

const pageData = { content: [{ id: 1, memberId: 5, statement: '5년', evidenceUrls: [], status: 'PENDING',
  decisionReason: null, decidedBy: null, decidedAt: null, createdAt: '' }], number: 0, totalPages: 1, last: true };

function mockAdmin(role: 'ADMIN' | 'USER') {
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'Adm', role, verified: false } });
    if (p.startsWith('/api/bff/admin/verified-performers/applications')) return Promise.resolve({ ok: true, data: pageData });
    return Promise.resolve({ ok: false, message: 'x' });
  });
}

beforeEach(() => { push.mockReset(); getBff.mockReset(); postBff.mockReset(); });

describe('AdminVerifiedPerformersPage', () => {
  it('비어드민이면 대시보드로 리다이렉트', async () => {
    mockAdmin('USER');
    render(<AdminVerifiedPerformersPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });

  it('어드민이면 목록 렌더', async () => {
    mockAdmin('ADMIN');
    render(<AdminVerifiedPerformersPage />);
    expect(await screen.findByText(/회원 #5/)).toBeInTheDocument();
  });

  it('승인 클릭 시 approve BFF 호출', async () => {
    mockAdmin('ADMIN');
    postBff.mockResolvedValue({ ok: true, data: null });
    render(<AdminVerifiedPerformersPage />);
    fireEvent.click(await screen.findByRole('button', { name: '승인' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/admin/verified-performers/applications/1/approve'));
  });

  it('직접지정 제출 시 grant BFF 호출', async () => {
    mockAdmin('ADMIN');
    postBff.mockResolvedValue({ ok: true, data: null });
    render(<AdminVerifiedPerformersPage />);
    await screen.findByText(/회원 #5/);
    fireEvent.change(screen.getByLabelText('회원 id'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '직접지정' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/admin/verified-performers/grant', { memberId: 7, reason: null }));
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd FE && npx vitest run __tests__/admin-verified-performers-page.test.tsx` → FAIL

- [ ] **Step 3: 구현** — `FE/app/admin/verified-performers/page.tsx`

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toCursorPage, toGrantRequest } from '@/lib/verification/logic';
import { ApplicationReviewItem } from '@/components/verification/ApplicationReviewItem';
import { GrantForm } from '@/components/verification/GrantForm';
import type { CursorPage, Me } from '@/lib/feed/types';
import type { Application, GrantFormValues, SpringPage, VerificationStatus } from '@/lib/verification/types';

const TABS: { key: VerificationStatus; label: string }[] = [
  { key: 'PENDING', label: '심사 중' },
  { key: 'APPROVED', label: '승인됨' },
  { key: 'REJECTED', label: '거절됨' },
  { key: 'REVOKED', label: '철회됨' },
];

function ReviewList({
  status, refreshKey, onApprove, onReject, onRevoke,
}: {
  status: VerificationStatus;
  refreshKey: number;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
  onRevoke: (id: number, reason: string) => void;
}) {
  const fetchPage = useCallback(async (cursor: number | null): Promise<CursorPage<Application> | null> => {
    const pageNum = cursor ?? 0;
    const r = await getBff<SpringPage<Application>>(`/api/bff/admin/verified-performers/applications?status=${status}&page=${pageNum}`);
    return r.ok ? toCursorPage(r.data as SpringPage<Application>) : null;
  }, [status, refreshKey]); // refreshKey 변경 시 새 fetchPage → 재조회

  const { items, isLoading, error, hasMore, sentinelRef } = useInfiniteList<Application>(fetchPage);

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <ul className="flex flex-col gap-3">
        {items.map((a) => (
          <ApplicationReviewItem key={a.id} application={a} onApprove={onApprove} onReject={onReject} onRevoke={onRevoke} />
        ))}
      </ul>
      {isLoading && <p className="py-4 text-center text-sm text-gray-400">불러오는 중...</p>}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {!hasMore && items.length === 0 && !isLoading && (
        <p className="py-8 text-center text-sm text-gray-400">해당 상태의 신청이 없습니다.</p>
      )}
    </>
  );
}

export default function AdminVerifiedPerformersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<VerificationStatus>('PENDING');
  const [refreshKey, setRefreshKey] = useState(0);
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => {
      if (!r.ok) { router.push('/login'); return; }
      const me = r.data as Me;
      if (me.role !== 'ADMIN') { router.push('/dashboard'); return; }
      setReady(true);
    });
  }, [router]);

  async function act(path: string, body?: unknown) {
    const r = await postBff(path, body);
    if (r.ok) { setMessage(null); setRefreshKey((k) => k + 1); }
    else setMessage(r.message ?? '처리에 실패했습니다.');
  }

  const onApprove = (id: number) => act(`/api/bff/admin/verified-performers/applications/${id}/approve`);
  const onReject = (id: number, reason: string) => act(`/api/bff/admin/verified-performers/applications/${id}/reject`, { reason });
  const onRevoke = (id: number, reason: string) => act(`/api/bff/admin/verified-performers/applications/${id}/revoke`, { reason });

  async function onGrant(v: GrantFormValues) {
    setGrantSubmitting(true);
    const r = await postBff('/api/bff/admin/verified-performers/grant', toGrantRequest(v));
    setGrantSubmitting(false);
    if (r.ok) { setMessage('직접지정 완료'); setRefreshKey((k) => k + 1); }
    else setMessage(r.message ?? '직접지정에 실패했습니다.');
  }

  if (!ready) return <main className="mx-auto mt-16 max-w-3xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-3xl px-4">
      <h1 className="mb-4 text-2xl font-bold">인증 연주자 심사</h1>

      <div className="mb-4"><GrantForm submitting={grantSubmitting} onGrant={onGrant} /></div>

      {message && <p className="mb-3 text-sm text-gray-700">{message}</p>}

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setStatus(t.key)}
            className={`rounded-full px-3 py-1 text-sm ${status === t.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <ReviewList key={`${status}:${refreshKey}`} status={status} refreshKey={refreshKey}
        onApprove={onApprove} onReject={onReject} onRevoke={onRevoke} />
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `cd FE && npx vitest run __tests__/admin-verified-performers-page.test.tsx` → PASS

- [ ] **Step 5: 커밋**

```bash
git add FE/app/admin/verified-performers FE/__tests__/admin-verified-performers-page.test.tsx
git commit -m "feat: 인증 연주자 어드민 심사 페이지(게이트·status 탭·승인/거절/철회·직접지정)"
```

---

## Task 11: 전체 회귀 + 린트 + 빌드 + 문서 반영

**Files:**
- Modify: `docs/CONTEXT.md`, `docs/TODO-DONE.md`, `docs/TODO-BACKLOG.md`, `docs/AI-ACTION-LOGS.md`

- [ ] **Step 1: 전체 테스트** — Run: `cd FE && npx vitest run` → 전체 PASS. 실패 시 해당 태스크로 복귀.

- [ ] **Step 2: 린트** — Run: `cd FE && npm run lint` → 신규 verification 파일 0경고 확인. (기존 `oauthState.test.ts`·`<img>` 잔존 경고/에러는 무관.) 내부 네비게이션은 전부 `router.push`(추가한 프로필 링크 포함) 사용 확인.

- [ ] **Step 3: 빌드** — Run: `cd FE && npm run build` → 성공. `/verified-performer`·`/admin/verified-performers`·BFF 7라우트가 라우트 트리에 나오는지 확인.

- [ ] **Step 4: 문서 반영**
- `docs/CONTEXT.md`: "현재 상태" FE 목록에 인증연주자 추가, "다음은 FE 화면"을 (채팅)으로. FE 인증연주자 요약 1줄(회원 상태분기·어드민 게이트·grant·BFF 7라우트·memberId만 표시).
- `docs/TODO-DONE.md`: 인증 연주자 FE 완료 항목(TDD 11태스크, 브랜치 feature/verified-performer-fe).
- `docs/TODO-BACKLOG.md`: "FE 화면" 섹션 인증연주자 `[x]`, 후속(어드민 목록 닉네임 표시 위한 BE 표시정보 확장, evidenceUrl URL 형식 검증) 등재.
- `docs/AI-ACTION-LOGS.md`: 작업 로그 1줄.

- [ ] **Step 5: 문서 커밋**

```bash
git add docs
git commit -m "docs: 인증 연주자 FE 구현 완료 반영(상태/TODO/로그)"
```

- [ ] **Step 6: 완료 보고** — `superpowers:finishing-a-development-branch`로 병합/PR 옵션 제시(피드·공연·구인과 동일하게 브랜치 유지가 기본).

---

## Self-Review 결과

**1. Spec coverage:** spec의 라우팅(2페이지)·회원 상태분기(4상태)·어드민(게이트·status 탭·승인/거절/철회·grant)·BFF(7라우트)·데이터 계층·컴포넌트(5)·테스트 전부 Task 1~10에 대응. 결정 3건(전체 범위/인라인 사유 토글/grant 포함) 반영. 프로필 진입 링크 Task 7 반영.

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드. reject/revoke 라우트·approve 라우트 코드 전체 반복(순서 무관 독해). "TBD/이후구현" 없음.

**3. Type consistency:** `validateApply/validateReason/validateGrant/statusLabel/canReapply/toApplyRequest/toGrantRequest/toCursorPage` 시그니처가 logic 정의(Task 1)와 사용처(Task 5·6·7·8·9·10)에서 일치. `Application`/`ApplyFormValues`/`GrantFormValues`/`VerificationStatus` 필드·유니온 일관. BFF params 키: 어드민 액션=`id`. 페이지 액션 핸들러 `onApprove(id)`/`onReject(id,reason)`/`onRevoke(id,reason)`가 컴포넌트(Task 8)와 페이지(Task 10)에서 일치. approve는 무body(BFF Task 3 + 페이지 `act(path)` body 생략)로 일관.

**해결한 갭:** 어드민 목록 닉네임 부재(BE 제약) → "회원 #{memberId}" 표시로 처리(Task 8·10) + 후속 백로그. 액션 후 목록 재조회는 `refreshKey`를 `fetchPage` 의존성 + 리스트 `key`에 둬서 재마운트로 처리. 무body approve의 mock 인자 개수 문제는 페이지 테스트에서 `postBff: (...a) => postBff(...a)` rest-arg mock으로 선제 회피(구인 Task 14 교훈).
