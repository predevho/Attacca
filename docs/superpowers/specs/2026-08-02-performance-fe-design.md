# 공연(PERFORMANCE) FE 설계 스펙

> 작성일: 2026-08-02
> 대상: FE 공연 화면(목록/등록/상세/수정/포스터)
> BE PERFORMANCE 도메인은 2026-07-22 완료(main). 이 스펙은 그 위에 FE 화면을 붙인다.
> 피드(FEED) FE(2026-08-02)가 확립한 패턴을 최대한 재사용한다.

---

## 0. 설계 원칙

* **BFF 3계층 재사용**: `lib/server/*` → `app/api/bff/**` → UI. 토큰은 httpOnly 쿠키. 신규 라우트는 `proxyAuthed`(status||502) 사용.
* **피드 자산 재사용**: `useInfiniteList`/`mergeCursorPage`(무한스크롤), `AuthorBadge`, `canEdit`/`canDelete`(권한), `/api/bff/me/identity`(신원), `deleteBff` 등.
* **모바일 이식 고려**: 무한스크롤, 단일 컬럼, 터치 타겟, hover-only 지양.
* **TDD**: Vitest. 판단/변환 로직은 순수 함수로 추출해 테스트, observer·네트워크는 목.
* **범위 규율**: BE PERFORMANCE가 지원하는 기능만 붙인다.

---

## 1. 라우팅 & 화면 구조

### 1.1 `/performances` — 목록 (client)

* 상단 **scope 탭**: 다가오는(UPCOMING·기본) / 지난(PAST) / 전체(ALL).
* **"공연 등록"** 버튼: `canRegister`(= `me.verified || me.role==='ADMIN'`)일 때만 노출 → `/performances/new`.
* **무한스크롤** 카드 리스트(§2).
* `middleware.ts` matcher에 `/performances/:path*` 추가(쿠키 인증 보호).

### 1.2 `/performances/new` — 등록 (자격 게이팅)

* 진입 시 신원 조회. `canRegister` 아니면 "인증 연주자만 공연을 등록할 수 있습니다" 상태 + 목록 링크(폼 미표시).
* 텍스트 폼(§3) + 포스터 파일 선택(선택). 제출 = 생성→포스터 2단계(§3).

### 1.3 `/performances/[id]` — 상세 (client)

* 포스터 이미지(없으면 플레이스홀더), 제목, 주최자(AuthorBadge), 일시·장소·소개·프로그램·관람료·티켓링크.
* 주최자 본인이면 **수정**(→ `/performances/[id]/edit`)·**삭제** 노출; 어드민은 삭제 노출. 판정은 `canEdit(me, organizer.id)`/`canDelete(me, organizer.id)`.
* 삭제 성공 → `/performances`로 이동.
* 없거나 삭제됨(404, PERFORMANCE_NOT_FOUND) → "삭제되었거나 없는 공연입니다" 상태.
* 쿼리 `?posterFailed=1`이면 상단에 "공연은 등록됐지만 포스터 업로드에 실패했습니다. 수정에서 다시 시도해 주세요." 배너.

### 1.4 `/performances/[id]/edit` — 수정 (주최자)

* 텍스트 폼(초기값 채움) → `PUT`. 포스터 변경은 이 화면에서 **즉시 업로드**(파일 선택 즉시 `PUT /{id}/poster`, 프로필 이미지 패턴).
* 비주최자 접근 시: 수정 시도는 BE가 403으로 막고, FE는 진입 시 `canEdit`가 false면 상세로 돌려보낸다.

### 1.5 공연 카드

* 포스터 썸네일(`posterImageUrl`, 없으면 회색 플레이스홀더), 제목, 주최자(닉네임+인증뱃지), 일시(`performedAt`)·장소(`venue`).
* **카드 전체 클릭 → `/performances/[id]`.** 내부 인터랙티브 요소는 `stopPropagation`.

---

## 2. 오프셋 페이징을 커서 훅으로 재사용

BE 목록은 Spring `Page`(오프셋): `GET /api/performances?scope=&page=&size=` → `{ content:[...], number, totalPages, last, ... }`.

* 순수 변환 `toCursorPage(response)`: `{ items: response.content, nextCursor: response.last ? null : response.number + 1 }`.
* `fetchPage(cursor)`: `page = cursor ?? 0` → GET `?scope=${scope}&page=${page}` → `toCursorPage`. 첫 로드는 `cursor=null`→page 0.
* 이 `fetchPage`를 기존 `useInfiniteList`에 넣으면 무한스크롤·`mergeCursorPage`(공연 id 중복 제거)가 그대로 동작한다.
* **scope 탭 전환** = 리스트 컴포넌트를 `key={scope}`로 리마운트(훅 재초기화, 새 scope로 첫 페이지부터).

> 오프셋 특성상 로드 중 항목 추가/삭제 시 경계 항목이 밀릴 수 있으나(오프셋 페이징 일반 한계), `mergeCursorPage`의 id 중복 제거가 중복 렌더는 막는다. 허용.

---

## 3. 등록 마법사 2단계 & 폼

### 3.1 폼 필드 (BE `PerformanceRequest` 검증과 일치)

| 필드 | 필수 | 제약 | 입력 |
|---|---|---|---|
| `title` | ✅ | ≤100 | text |
| `venue` | ✅ | ≤200 | text |
| `performedAt` | ✅ | LocalDateTime | `<input type="datetime-local">` (값 `YYYY-MM-DDTHH:mm`은 Jackson이 LocalDateTime으로 파싱) |
| `description` | | ≤2000 | textarea |
| `program` | | ≤2000 | textarea |
| `ticketInfo` | | ≤200 | text |
| `ticketUrl` | | ≤500 | text(url) |

* 공용 컴포넌트 `PerformanceForm({ initial, submitting, onSubmit })` — 값을 모아 `PerformanceRequest`로 `onSubmit`. new/edit 공용. 클라이언트 측 필수/길이 검증 후 제출(BE도 400-01로 최종 검증).

### 3.2 등록 흐름 (2단계, 실패는 안내만)

`/performances/new` 제출:
1. `POST /api/bff/performances`(텍스트) → 성공 시 생성된 `PerformanceResponse`(`id`) 수신. 실패면 폼에 에러 표시(진행 중단).
2. 포스터 파일을 골랐으면 `PUT /api/bff/performances/${id}/poster`(멀티파트).
3. 이동:
   * 포스터 성공 또는 미선택 → `/performances/${id}`
   * **포스터 실패 → `/performances/${id}?posterFailed=1`** 로 이동(공연은 이미 생성됨). 안내 배너만 표시하고 진행 — 사용자는 수정에서 포스터를 다시 올릴 수 있다.

### 3.3 수정 흐름

* 텍스트: `PUT /api/bff/performances/${id}` → 성공 시 상세로.
* 포스터: 수정 화면의 파일 선택 즉시 `PUT /api/bff/performances/${id}/poster`(프로필 이미지 즉시 업로드 패턴). 이미 존재하는 공연이라 2단계 불필요.

---

## 4. 자격/권한 게이팅 (신원 재사용)

* `/api/bff/me/identity` → `me = {id, nickname, role, verified}`.
* **등록 자격** `canRegister = me.verified || me.role==='ADMIN'`: 목록의 "공연 등록" 버튼 노출·`/performances/new` 접근 제어.
* **수정** = `canEdit(me, organizer.id)`(주최자만), **삭제** = `canDelete(me, organizer.id)`(주최자·어드민) — 피드 `lib/feed/logic.ts` 재사용.
* `organizer`는 `MemberDisplay`가 `{id, nickname, verified}`로 직렬화(2026-08-02 author.id 정합 픽스 반영) → `organizer.id` 신뢰 가능.
* 게이팅은 UI 편의일 뿐, 인가는 BE 최종 판정(403-01 권한 / 403-02 NOT_VERIFIED_PERFORMER / 404-07 PERFORMANCE_NOT_FOUND).

---

## 5. BFF 라우트 (`app/api/bff/performances/**`)

모두 `proxyAuthed`(status||502). Next.js 16 동적 params는 `await params`.

| BFF 경로 | 메서드 | BE 프록시 |
|---|---|---|
| `/api/bff/performances` | GET(`?scope=&page=&size=` 전달) | `GET /api/performances` |
| `/api/bff/performances` | POST | `POST /api/performances` |
| `/api/bff/performances/[id]` | GET / PUT / DELETE | 단건 / 수정 / 삭제 |
| `/api/bff/performances/[id]/poster` | PUT(멀티파트) | `PUT /api/performances/{id}/poster` |

* 포스터 라우트는 프로필 이미지 BFF(`app/api/bff/me/profile/image/route.ts`) 패턴: 들어온 `formData`에서 `file` 파트 확인(없으면 400), 새 `FormData`로 BE에 전달. `proxyAuthed(path, {method:'PUT', body: formData})` — `beFetch`가 FormData면 content-type 미설정(멀티파트).
* GET 목록은 `new URL(request.url).search`로 scope/page/size를 그대로 전달.

---

## 6. 타입 (`lib/performance/types.ts`)

```ts
import type { Author } from '@/lib/feed/types'; // {id, nickname, verified} 재사용

export type PerformanceScope = 'UPCOMING' | 'PAST' | 'ALL';

export type Performance = {
  id: number;
  organizer: Author;
  title: string;
  description: string | null;
  performedAt: string;   // ISO LocalDateTime
  venue: string;
  program: string | null;
  ticketInfo: string | null;
  ticketUrl: string | null;
  posterImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PerformanceRequest = {
  title: string; description: string; performedAt: string; venue: string;
  program: string; ticketInfo: string; ticketUrl: string;
};

// Spring Page (필요 필드만)
export type SpringPage<T> = { content: T[]; number: number; totalPages: number; last: boolean };
```

* `toCursorPage(page: SpringPage<Performance>): CursorPage<Performance>` (순수, `lib/performance/logic.ts`).

---

## 7. 테스트 (Vitest)

* **순수 로직**: `toCursorPage`(last→nextCursor null, 아니면 number+1; content→items), 폼 검증 헬퍼(title/venue 필수, performedAt 필수, 길이 상한).
* **BFF 라우트**: 목록 GET scope/page 쿼리 전달, POST/PUT/DELETE 경로 매핑, 502 폴백, **포스터 PUT file 파트 없으면 400 / 있으면 FormData 전달**.
* **페이지**:
  * 목록: 렌더, scope 탭 전환(리마운트로 재조회), 카드 클릭 이동, "공연 등록" 버튼 자격 게이팅(자격자만).
  * new: 비자격 안내(폼 미표시), 등록 성공→상세 이동, **포스터 2단계 실패→`?posterFailed=1` 이동**.
  * 상세: 정보 렌더, 주최자면 수정/삭제 노출·비주최자면 숨김, 404 상태, `posterFailed` 배너.
  * edit: 초기값 채움, 저장→상세, 포스터 즉시 업로드.

---

## 8. 범위

### 포함
목록(무한스크롤·scope 탭) · 등록(2단계 마법사, 자격 게이팅) · 상세 · 수정 · 삭제 · 포스터 업로드(등록 시 2단계 + 수정 시 즉시).

### 범위 밖 (BE와 동일)
관심/북마크, 피드 카드 노출, 곡목 구조화, 좌석/예매, 공개(비로그인) 조회, 태그/장르 필터.

---

## 9. 참고

* BE API: `docs/DOMAIN-PERFORMANCE-STATUTE.md`, `PerformanceController`(`/api/performances`), `PerformanceRequest`/`PerformanceResponse`.
* 재사용 자산: `FE/lib/feed/useInfiniteList.ts`, `FE/lib/feed/logic.ts`(`mergeCursorPage`/`canEdit`/`canDelete`), `FE/lib/feed/types.ts`(`Author`/`CursorPage`), `FE/lib/server/bffProxy.ts`(`proxyAuthed`), `FE/components/feed/AuthorBadge.tsx`, `FE/app/api/bff/me/profile/image/route.ts`(멀티파트 BFF 선례), `FE/app/profile/page.tsx`(즉시 이미지 업로드 선례).
* BE 목록은 `Page<T>` 직렬화(PageImpl) — FE는 `content/number/totalPages/last`만 소비(BACKLOG의 공통 PageResponse DTO 전환과 무관하게 동작).
