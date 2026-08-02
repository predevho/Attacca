# 피드(FEED) FE 설계 스펙

> 작성일: 2026-08-02
> 대상: FE 피드 화면(타임라인/작성/상세/댓글/좋아요)
> BE FEED 도메인은 2026-07-17 완료(main 병합). 이 스펙은 그 위에 FE 화면을 붙인다.

---

## 0. 설계 원칙

* **BFF 3계층 재사용**: `lib/server/*`(beClient·session) → `app/api/bff/**` → UI. 토큰은 httpOnly 쿠키, UI는 토큰을 만지지 않는다. 기존 인증/프로필 화면과 동일 패턴.
* **모바일 이식 고려**: 이 프로젝트를 추후 모바일로 그대로 이식할 수 있도록 UI를 모바일-친화적으로 유지한다.
  * 무한스크롤(스크롤 기반 로드), 터치 타겟 충분히 크게, hover-only 상호작용 지양, 단일 컬럼 레이아웃.
* **TDD**: Vitest 단위 테스트. 관찰자(observer)·네트워크는 목, 판단 로직은 순수 함수로 추출해 테스트한다.
* **범위 규율**: BE FEED가 지원하는 기능만 붙인다. BE 범위 밖은 FE도 범위 밖.

---

## 0.1 BE 선행 변경 — 현재 사용자 신원 엔드포인트

FE가 "현재 사용자가 이 게시글/댓글의 작성자인가"를 판단해 수정/삭제 버튼을 노출하려면 현재 회원의 id가 필요하다. 토큰은 httpOnly라 FE가 디코드할 수 없고, 기존 `ProfileResponse`에는 id가 없다. 따라서 **신원 전용 엔드포인트를 신설**한다(프로필 응답과 분리 — 프로필 미생성 회원도 신원은 존재).

* `GET /api/members/me` (인증 필요) → `{ id, nickname, role, verified }`
  * `id`/`nickname`/`role`은 `Member` 엔티티에서, `verified`는 `VerifiedPerformerService.isVerified`(APPROVED만 true) 협력으로 파생(기존 프로필 뱃지 파생과 동일 패턴).
  * `role`은 어드민 판정에 사용(enum name `ADMIN`; 어드민은 타인 게시글/댓글 삭제 버튼 노출).
* 이 엔드포인트는 피드뿐 아니라 향후 화면(구인 "내 지원", 채팅 참여자 판정 등)에서도 재사용되는 공용 신원 소스다.
* BE 테스트(신설): 인증 시 id/nickname/role/verified 반환, 미인증 401, verified 파생(승인/미승인).
* 문서: 이 엔드포인트는 MEMBER 도메인 변경이므로 구현 시 `docs/DOMAIN-MEMBER-STATUTE.md`에 반영한다(프로젝트 규칙).

---

## 1. 라우팅 & 화면 구조

### 1.1 `/feed` — 타임라인 (client component)

* 상단 **인라인 작성 폼**(항상 노출): `textarea`(≤2000자, 카운터) + "게시" 버튼. 작성 성공 시 목록 맨 앞에 prepend.
* 게시글 **카드 리스트**(최신순).
* 하단 **sentinel**(IntersectionObserver) → 화면 진입 시 다음 커서 페이지 자동 로드. `nextCursor===null`이면 관찰 중단(끝).
* `middleware.ts` matcher에 `/feed` 추가(쿠키 기반 인증 보호, `/dashboard`·`/profile`과 동일).

### 1.2 `/feed/[id]` — 상세 (client component)

* 게시글 카드: **수정** 버튼은 `author.id === me.id`일 때만, **삭제** 버튼은 `author.id === me.id || me.role === 'ADMIN'`일 때 노출(`me`는 §0.1 신원 엔드포인트에서 조회). `role`은 enum name(`'USER'`/`'ADMIN'`)으로 직렬화된다.
* 댓글 목록(**오래된순**, 무한스크롤: 아래로 스크롤 시 다음 페이지 = 더 최신 댓글).
* 댓글 작성 폼(≤500자, 카운터).
* 게시글이 없거나 삭제됨(404) → "삭제되었거나 없는 게시글입니다" 상태.
* `middleware.ts` matcher에 `/feed/:path*` 포함.

### 1.3 게시글 카드 구성

* 작성자: 닉네임 + **인증뱃지**(`author.verified` true면 뱃지 표시).
* 본문(`whitespace-pre-wrap`), 좋아요(♥ + `likeCount`), 댓글 수(`commentCount`), 상대 시각(`createdAt`).
* **카드 전체 클릭 → `/feed/[id]` 이동.** 단 카드 내부 인터랙티브 요소(좋아요 버튼, 작성자 링크 등)는 `stopPropagation`으로 이동을 막는다.

---

## 2. BFF 라우트 (`app/api/bff/feed/**`)

기존 3계층(`beFetch` + `session.ts` reissue 1회 재시도) 그대로 사용.
**신규 라우트이므로 처음부터 `status: res.status || 502`** 로 작성한다(BACKLOG "FE 공통"의 `|| 200` 폴백 버그를 신규 코드에서 선제 회피).

| BFF 경로 | 메서드 | BE 프록시 |
|---|---|---|
| `/api/bff/feed/posts` | GET | `GET /api/feed/posts?cursor=&size=` (타임라인) |
| `/api/bff/feed/posts` | POST | `POST /api/feed/posts` (작성) |
| `/api/bff/feed/posts/[id]` | GET | `GET /api/feed/posts/{id}` (단건) |
| `/api/bff/feed/posts/[id]` | PUT | `PUT /api/feed/posts/{id}` (수정) |
| `/api/bff/feed/posts/[id]` | DELETE | `DELETE /api/feed/posts/{id}` (삭제) |
| `/api/bff/feed/posts/[id]/like` | POST/DELETE | 게시글 좋아요/취소 |
| `/api/bff/feed/posts/[id]/comments` | GET | `GET /api/feed/posts/{id}/comments?cursor=&size=` |
| `/api/bff/feed/posts/[id]/comments` | POST | `POST /api/feed/posts/{id}/comments` |
| `/api/bff/feed/comments/[id]` | DELETE | `DELETE /api/feed/comments/{id}` |
| `/api/bff/feed/comments/[id]/like` | POST/DELETE | 댓글 좋아요/취소 |
| `/api/bff/me/identity` | GET | `GET /api/members/me` (현재 사용자 신원, §0.1) |

* `cursor`/`size` 쿼리는 BFF가 그대로 BE로 전달한다.
* **`lib/api.ts`에 `deleteBff` 헬퍼 신규 추가** (현재 get/post/put/putForm만 존재).
* 신원 BFF 경로는 기존 `/api/bff/me`(프로필)와 구분해 `/api/bff/me/identity`로 둔다.

---

## 3. 데이터 흐름 & 상태

### 3.1 흐름

client 컴포넌트 → `getBff/postBff/putBff/deleteBff`(same-origin) → BFF 라우트 → `beFetch`(httpOnly 쿠키, reissue) → Spring.
반환은 기존 `BffResult<T> = {ok, data?, message}` 계약 유지.

* **신원 로드**: 각 페이지 진입 시 `/api/bff/me/identity`로 `me = {id, role, ...}`를 1회 조회해 작성자 판정(수정/삭제 버튼 노출)에 사용. 실패(401)면 `/login`.
* 소유권 UI는 편의(버튼 노출)일 뿐이며, 실제 인가는 BE가 최종 판정한다(403은 §4에서 처리 — 버튼을 우회해도 안전).

### 3.2 무한스크롤 커서 병합 (순수 함수로 추출)

* `mergeCursorPage(prev, page)`: `prev.items`에 `page.items` append, `nextCursor`를 `page.nextCursor`로 갱신, **id 기준 중복 제거**(경합/재요청 방어). 반환 `{items, nextCursor}`.
* 로드 트리거 판단 `shouldLoadMore({isLoading, nextCursor})`: `!isLoading && nextCursor !== null`일 때만 true. IntersectionObserver 콜백이 이 순수 함수를 통해 판단 → **중복 로드 방지**.

### 3.3 좋아요 낙관적 토글 (순수 함수로 추출)

* `toggleLike(item)`: `likedByMe` 반전 + `likeCount`를 `likedByMe ? -1 : +1`. 게시글·댓글 공통(둘 다 `{likedByMe, likeCount}` 형태).
* 클릭 즉시 로컬 상태에 `toggleLike` 적용 → BFF 호출(POST=좋아요, DELETE=취소) → `!res.ok`면 **원복**(다시 `toggleLike` 또는 이전 스냅샷 복원).
* BE 좋아요 응답은 빈 성공(카운트 미포함)이므로 카운트는 **로컬 계산**한다.

### 3.4 게시글 수정

* 프로필 화면과 동일한 **인라인 편집 모드 토글**(상세 페이지). textarea 편집 → `PUT` → 성공 시 카드 갱신, 실패 시 인라인 에러.

---

## 4. 에러 처리

| 상황 | 처리 |
|---|---|
| 401 (미인증/만료) | `session.ts`가 reissue 1회 재시도 → 여전히 401이면 BFF `ok:false` → 클라이언트가 `/login`으로 리다이렉트 |
| 404 (POST_NOT_FOUND / 삭제·없음) | 상세 페이지: "삭제되었거나 없는 게시글입니다" 상태. 타임라인: 해당 카드 제거 |
| 403 (수정/삭제 권한 없음) | 인라인 빨간 문구(프로필 화면 패턴 재사용) |
| BE 다운(status 0) | BFF가 502 반환 → "일시적 오류가 발생했습니다" 문구 |
| 좋아요 실패 | 낙관적 변경 원복 + (선택) 조용한 무시 또는 짧은 토스트 |

---

## 5. 테스트 (Vitest)

기존 단위 테스트 스타일(unwrap·cookies·beClient·session·bff·폼 스모크)과 매칭.

* **BE 신원 엔드포인트**(§0.1): 인증 시 id/nickname/role/verified 반환, 미인증 401, verified 파생(승인/미승인).
* **BFF 라우트 핸들러**: 성공 프록시(data 전달) / **status 폴백(BE 다운 → 502)** / 401 위임(로그인 필요 신호) / `cursor`·`size` 쿼리 전달. 신원 라우트 포함.
* **소유권 판정 로직**(순수 함수 `canEdit(me, author)`/`canDelete(me, author)`): 작성자·어드민 케이스.
* **순수 로직**:
  * `mergeCursorPage`: append, `nextCursor` 갱신, id 중복 제거.
  * `shouldLoadMore`: 로딩 중·끝(nextCursor null) 가드.
  * `toggleLike`: 토글 + 롤백(두 번 적용 시 원상).
* **폼 스모크**: 작성 폼 빈값 차단·최대 길이(게시글 2000 / 댓글 500), 기본 렌더.

---

## 6. 범위

### 포함 (이번 이터레이션)

* **BE 선행**: 신원 엔드포인트 `GET /api/members/me`(§0.1).
* **FE**: 타임라인(무한스크롤) · 게시글 작성(인라인) · 게시글 상세 · 게시글 수정/삭제 · 게시글 좋아요 · 댓글 목록(무한스크롤)/작성/삭제 · **댓글 좋아요**.

### 범위 밖 (BE와 동일)

이미지 첨부, 대댓글, 댓글 수정, 팔로우 타임라인, 신고, PERFORMANCE 카드 노출.

---

## 7. 참고

* BE API 계약: `docs/DOMAIN-FEED-STATUTE.md` §7(엔드포인트/DTO), `docs/CONTEXT.md`(FEED 항목).
* FE 패턴 선례: `FE/app/profile/page.tsx`(인라인 편집·이미지·에러), `FE/app/api/bff/me/profile/route.ts`(BFF 라우트), `FE/lib/server/beClient.ts`·`session.ts`(reissue), `FE/lib/api.ts`(BffResult 헬퍼), `FE/lib/unwrap.ts`.

### DTO (BE 확정, §7.4)

* `PostResponse`: `id, author{id, nickname, verified}, content, likeCount, commentCount, likedByMe, createdAt, updatedAt`
* `CommentResponse`: `id, postId, author{id, nickname, verified}, content, likeCount, likedByMe, createdAt`
* 커서 목록 래퍼: `{items, nextCursor}` (nextCursor=null이면 끝)
* 커서 size: 기본 20 / 최대 50
