# 구인(RECRUITMENT) FE 설계

- 작성일: 2026-08-12
- 범위: 구인 도메인 프론트엔드 전체(공고 CRUD + 지원 플로우)
- 참고 선행 구현: 공연(PERFORMANCE) FE (동일 3계층 BFF 패턴 답습)

---

## 결정 사항 요약

브레인스토밍에서 확정한 4가지.

1. **범위**: 공고 + 지원을 하나의 spec으로 통째 구현.
2. **지원 라우팅**: 지원하기·지원자 관리는 공고 상세 페이지에 인라인, 내 지원 현황만 별도 페이지.
3. **지원 UX**: "지원하기" 클릭 시 메시지 textarea를 인라인으로 펼치는 토글(모달 미도입 — 코드베이스에 모달 선례 없음).
4. **패턴**: 공연 FE의 3계층 BFF 패턴(`proxyAuthed` / `getBff·postBff…` / `useInfiniteList` + `toCursorPage`)을 그대로 답습.

---

## 1. 라우팅 & 페이지 맵

| 경로 | 역할 |
|------|------|
| `/recruitments` | 목록. scope 탭(OPEN/CLOSED/ALL) + 악기 필터 + 무한스크롤. "공고 등록" 버튼(로그인만 필요, 자격 게이팅 없음) |
| `/recruitments/new` | 공고 등록 폼 |
| `/recruitments/[id]` | 상세. 공고 정보 + 역할별 분기(지원 패널 / 지원자 관리 섹션 / 수정·마감·삭제) |
| `/recruitments/[id]/edit` | 공고 수정 폼 |
| `/recruitments/applications/me` | 내 지원 현황 목록 + 철회 |

공연과의 차이: 포스터 라우트 없음. 대신 상세에 지원 인터랙션이 붙는다.

---

## 2. 상세 페이지 역할별 분기 (핵심)

- **비작성자 + 미마감 + 미지원** → "지원하기" 버튼 → 클릭 시 인라인 메시지 textarea 펼침 → 제출(`POST .../applications`). 성공 시 "지원 완료" 상태로 전환.
- **작성자** → 하단에 지원자 목록 섹션(닉네임 + 인증뱃지 + 메시지 + 상태). PENDING 지원마다 수락/거절 버튼. 상단엔 수정·마감·삭제.
- **마감된 공고** → 지원 버튼 숨김, "마감된 공고입니다" 표시.

**지원 여부 사전판정**: 상세 응답에 "내 지원 상태"가 없다. 추가 왕복 없이 낙관적 제출 + `409-08`(ALREADY_APPLIED) 피드백으로 처리(BE의 best-effort 모델과 일치). 제출 성공 후 버튼을 "지원 완료"로 잠근다.

---

## 3. 데이터 계층 (`FE/lib/recruitment/`)

- `types.ts`
  - `RecruitmentScope = 'OPEN' | 'CLOSED' | 'ALL'`
  - `Posting` = { id, author: Author, instruments: string[], recruitCount, location, fee, deadline: string | null, status: 'OPEN' | 'CLOSED', description, createdAt }
  - `PostingFormValues` (모두 string, BE `RecruitmentPostingRequest`로 전송)
  - `Application` = { id, status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN', message, applicant/posting 요약, createdAt }
  - `SpringPage<T>` (FE가 쓰는 필드만: content, number, totalPages, last)
- `logic.ts`
  - `toCursorPage(page)` — Spring offset → cursor 계약(`last ? null : number + 1`)
  - `validatePosting(v)` — 첫 에러 메시지 또는 null, BE 규칙과 일치
  - `isClosed(posting)` — 파생 마감판정 = `status === 'CLOSED' || (deadline != null && now >= deadline)`
  - `formatDeadline(iso | null)` — null → "상시모집", 값 있으면 "YYYY.MM.DD" 포맷
  - `applicationStatusLabel(status)` — 상태 → 한글 라벨
- **재사용**: `useInfiniteList`, `mergeCursorPage`, `shouldLoadMore`, `canEdit`/`canDelete`(`lib/feed/logic`), `Author`/`Me`/`CursorPage` 타입(`lib/feed/types`)

---

## 4. BFF 라우트 (`FE/app/api/bff/recruitments/**`)

모두 `proxyAuthed`만 사용. BE `/api/recruitments/**`를 미러.

```
/api/bff/recruitments                              GET(목록 ?scope&instrument&page) / POST(등록)
/api/bff/recruitments/[id]                         GET / PUT / DELETE
/api/bff/recruitments/[id]/close                   POST
/api/bff/recruitments/[id]/applications            GET(작성자용 지원자목록) / POST(지원)
/api/bff/recruitments/applications/me              GET
/api/bff/recruitments/applications/[aid]/accept    POST
/api/bff/recruitments/applications/[aid]/reject    POST
/api/bff/recruitments/applications/[aid]/withdraw  POST
```

- 목록 쿼리는 `new URL(request.url).search` 통과, body는 `request.text()`.
- accept/reject/withdraw/close는 body 없는 POST.

---

## 5. 컴포넌트 (`FE/components/recruitment/`)

- `PostingForm.tsx` (등록/수정 공용): 제목·설명·악기(다중)·모집인원·지역·페이·마감일(비우면 상시모집). `aria-label` 접근성, 제출 전 `validatePosting`.
- `PostingCard.tsx` (목록 카드): 제목·악기칩·모집인원·지역·마감상태. `onOpen` 콜백.
- `InstrumentPicker.tsx` (신규 공용 프레젠테이셔널): props `options / selected / onToggle`. 폼·필터 양쪽에서 사용. max 규칙은 호출자가 강제(프로필의 max 10 부작용을 컴포넌트에 넣지 않음). 추후 프로필 페이지도 이 컴포넌트로 리팩터 가능(이번 범위 밖, 선택).
- `ApplyPanel.tsx` (인라인 펼 토글 지원 폼): 메시지 textarea + 제출.
- `ApplicantList.tsx` (작성자용): 지원자 목록 + PENDING 수락/거절.
- `ApplicationCard.tsx` (내 지원 현황 카드 + 철회).
- **재사용**: `AuthorBadge`(`components/feed/AuthorBadge`).

---

## 6. 권한 / 에러 규칙 (FE 파생)

- 등록: 로그인만 필요(verified 게이팅 없음 — 공연과 다름). 미로그인 → `/login`.
- 수정·마감: 작성자. 삭제: `canDelete`(본인 또는 ADMIN).
- 지원 버튼 노출: 비작성자 && 미마감 && 미지원(제출 전 낙관적, 실패 시 409 피드백).
- 수락/거절: 작성자만. 철회: 지원자 본인만.
- BE 에러코드 → 사용자 메시지 매핑(BFF가 message를 그대로 전달):
  - 409-07 RECRUITMENT_CLOSED(마감)
  - 409-08 ALREADY_APPLIED(중복지원)
  - 409-09 CANNOT_APPLY_OWN_RECRUITMENT(본인공고 지원불가)
  - 409-10 RECRUITMENT_INVALID_APPLICATION_STATE(잘못된 상태전이)
  - 404-08/404-09(공고/지원 없음)
- 상태 변경(수락/거절/철회/마감)은 성공 시 로컬 상태 갱신 or 재조회, 실패 시 롤백.

---

## 7. 테스트 (Vitest, 계층별 — 공연 FE와 동일 방식)

- **logic**: `validatePosting` / `isClosed` / `formatDeadline` / `applicationStatusLabel` 단위.
- **bff**: 8개 라우트 (`@vitest-environment node`, cookies mock + fetch stub). 목록 쿼리 전달/등록 body/상세·수정·삭제 경로/close·accept·reject·withdraw/지원 POST.
- **pages**: 목록(scope 탭·악기 필터·등록 버튼), 등록, 상세(역할별 분기 전부 — 지원 패널/지원자 관리/수정·마감·삭제 노출 조건), 수정, 내 지원.
- **components**: PostingForm/Card, InstrumentPicker, ApplyPanel, ApplicantList.

---

## 8. 진행 방식

- TDD로 공연 FE처럼 태스크 분할해 서브에이전트 주도 구현.
- 브랜치 `feature/recruitment-fe`(공연·피드 FE와 동일하게 main 병합 대기 방식).
- 문서 반영: CONTEXT.md(FE 구인 요약 추가), TODO(DOING→DONE 이동), AI-ACTION-LOGS.md, 필요 시 TIL.

---

## 미해결/확인 필요 사항

브레인스토밍에서 사용자에게 확인받고 싶은 두 지점(구현 착수 전 재확인):

1. 상세 페이지 지원 여부 사전판정을 낙관적 제출 + 409 처리로 두는 방식(추가 왕복 없음) — 승인 여부.
2. `InstrumentPicker`를 신규 공용 컴포넌트로 추출하는 것 — 승인 여부(프로필 리팩터는 이번 범위 밖).

BE 응답 DTO의 정확한 필드명(특히 `Application`의 applicant/posting 요약 구조, `Posting`의 필드명)은 구현 착수 시 BE 컨트롤러/DTO를 직접 확인해 확정한다.
