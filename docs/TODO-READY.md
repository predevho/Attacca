# TODO-READY

바로 작업 가능한 작업 목록.

---

## FE: 피드(FEED) 화면 — 타임라인/작성/댓글/좋아요

BE FEED 도메인은 완료(2026-07-17, main 병합). 이 작업은 그 위에 FE 화면을 붙인다.
기존 인증/프로필 화면과 동일한 **BFF 3계층**(`lib/server/*` → `app/api/bff/**` → UI) + **TDD**(Vitest) 패턴을 그대로 따른다.

### 참고 문서/코드
* BE API 계약: `docs/CONTEXT.md`(FEED 항목) + `docs/DOMAIN-FEED-STATUTE.md`
* FE 패턴 선례: `FE/app/profile/page.tsx`, `FE/app/api/bff/me/profile/route.ts`, `FE/lib/server/beClient.ts`, `FE/lib/server/session.ts`(401 시 reissue 1회 재시도), `FE/lib/unwrap.ts`

### BE API 계약 요약 (모두 `/api/feed/**`, 인증 필요)
* 게시글: 작성(POST) / 커서 타임라인(GET, 최신순 desc) / 상세(GET) / 수정(PUT, 작성자) / 삭제(DELETE, 작성자·ADMIN)
* 댓글: 작성(POST) / 목록(GET, 커서 오래된순 asc) / 삭제(DELETE)
* 좋아요: 게시글·댓글 좋아요/취소(멱등 200)
* 커서 페이징 size 기본 20 / 최대 50
* 표시정보: 작성자 닉네임 + 인증뱃지(`verified`)가 응답에 포함(BE 배치 파생)
* 에러코드: 404-05(POST_NOT_FOUND) / 404-06(COMMENT_NOT_FOUND)

### 작업 범위 (TDD, 계층별 리뷰)
1. **BFF 라우트**(`app/api/bff/feed/**`): 게시글 목록/상세/작성/수정/삭제, 댓글 목록/작성/삭제, 좋아요 토글. `beFetch`(`lib/server/beClient.ts`) 경유, httpOnly 쿠키 인증, `session.ts` reissue 재시도 재사용.
   * ⚠️ 기존 BFF 라우트의 `{ status: res.status || 200 }` 폴백 버그(BACKLOG의 "FE 공통" 항목)를 이 라우트들에서는 처음부터 `res.status || 502`로 작성.
2. **UI 화면**(`app/feed/**`, 미들웨어 인증 보호): 타임라인(무한스크롤/더보기 커서), 게시글 작성 폼, 상세+댓글 목록/작성, 좋아요 버튼(낙관적 업데이트), 작성자 뱃지 표시.
3. **Vitest 단위 테스트**: BFF 라우트(unwrap·status·인증 위임), 커서 병합 로직, 폼 스모크.

### 착수 전 확인 필요(결정)
* 무한스크롤 vs "더보기" 버튼 — 커서 페이징이라 둘 다 가능. 구현 시 결정.
* 좋아요 낙관적 업데이트 실패 시 롤백 UX — 구현 시 결정.

### 범위 밖 (BE와 동일하게 유지)
이미지 첨부, 대댓글, 댓글 수정, 팔로우 타임라인, 신고, PERFORMANCE 카드 노출.

---

## (그 외) FE 나머지 화면 — BACKLOG 참고

인증 연주자 신청/승인, 공연(PERFORMANCE), 구인(RECRUITMENT), 채팅(CHAT) 화면은 아직 BACKLOG.
피드 화면이 커서 페이징·뱃지 표시·작성 폼 등 재사용 패턴을 확립한 뒤 순차 착수.
