# 인증 연주자(VERIFIED-PERFORMER) FE 설계

- 작성일: 2026-08-12
- 범위: 인증 연주자 도메인 프론트엔드 전체(회원 신청/상태 + 어드민 심사/직접지정)
- 참고 선행 구현: 구인(RECRUITMENT)·공연·피드 FE (동일 3계층 BFF 패턴)

---

## 결정 사항 요약

1. **범위**: 회원 측(신청/내 상태) + 어드민 측(심사/직접지정)을 하나의 spec으로 통째 구현.
2. **어드민 심사 UX**: 거절/철회는 사유가 필수 → "거절"/"철회" 클릭 시 사유 textarea를 인라인으로 펼치는 토글. 승인은 즉시(사유 선택이라 빈 입력 허용).
3. **직접지정(grant) 포함**: 어드민 페이지 상단에 회원 id + 사유(선택) 작은 폼.
4. **패턴**: 3계층 BFF(`proxyAuthed` / `getBff·postBff` / `useInfiniteList` + `toCursorPage`) 답습.

---

## BE 계약 (구현 착수 전 확인 완료)

- **회원 API** (`/api/verified-performers`, 인증 필요)
  - `POST /applications` — `ApplyRequest{ statement(필수,≤1000), evidenceUrls(≤10) }` → `ApplicationResponse`
  - `GET /applications/me` — 내 최신 신청. 이력 없으면 `data: null`
- **어드민 API** (`/api/admin/verified-performers`, ROLE_ADMIN — SecurityConfig가 경로로 강제)
  - `GET /applications?status=PENDING&page=&size=` — `Page<ApplicationResponse>`(status 기본 PENDING)
  - `POST /applications/{id}/approve` — body `DecisionRequest{ reason }` **선택**(`required=false`)
  - `POST /applications/{id}/reject` — body `DecisionReasonRequest{ reason(필수,≤500) }`
  - `POST /applications/{id}/revoke` — body `DecisionReasonRequest{ reason(필수,≤500) }`
  - `POST /grant` — body `GrantRequest{ memberId(필수), reason(선택) }`
- **ApplicationResponse** = `{ id, memberId, statement, evidenceUrls: string[], status: 'PENDING'|'APPROVED'|'REJECTED'|'REVOKED', decisionReason: string|null, decidedBy: number|null, decidedAt: string|null, createdAt }`. PENDING이면 decision* 필드 null.
- **상태 규칙**: 활성 신청(PENDING/APPROVED) 유일 → 재신청 409. 재신청 = 새 레코드. 뱃지는 APPROVED만.
- **에러코드**: 404-04(APPLICATION_NOT_FOUND)/409-04(ALREADY_PENDING)/409-05(ALREADY_APPROVED)/409-06(INVALID_APPLICATION_STATE). BFF가 `message`를 그대로 전달 → FE는 `r.message` 노출.
- **제약**: 응답에 `memberId`(Long)만 있고 닉네임 없음(별도 표시정보 엔드포인트 없음) → 어드민 목록은 "회원 #{memberId}"로 표시.

---

## 1. 라우팅 (페이지 2)

| 경로 | 역할 |
|------|------|
| `/verified-performer` | 회원. `GET /applications/me` → 상태별 분기(신청 폼 / 심사 중 / 인증됨 / 거절·철회+재신청) |
| `/admin/verified-performers` | 어드민. status 필터 목록 + 승인/거절/철회 + 직접지정. 비어드민 리다이렉트 |

진입점: `/profile`(인증 뱃지 위치)에 "인증 연주자 신청/상태" 링크 1개 추가(기존 파일 수정).

---

## 2. 회원 페이지 상태별 분기

`GET /api/bff/verified-performers/applications/me` → `Application | null`

- **이력 없음(null)** → 신청 폼(ApplyForm)
- **PENDING** → "심사 중입니다" 카드(제출한 statement/evidenceUrls/createdAt 표시). 회원측 취소 API 없음 → 대기만.
- **APPROVED** → "인증 연주자로 승인되었습니다" 카드(인증 뱃지)
- **REJECTED / REVOKED** → `decisionReason` 표시 + 재신청 폼(ApplyForm, 활성 신청 없으므로 재신청 = 새 레코드)
- 제출: `POST /applications` → 성공 시 상태 재조회로 카드 갱신. 409(ALREADY_PENDING/APPROVED) 시 BE 메시지 노출.

---

## 3. 어드민 페이지

- **역할 게이트**: `GET /api/bff/me/identity` 후 `role !== 'ADMIN'`이면 `/dashboard`로 리다이렉트(BE도 403 이중 방어). 미로그인 → `/login`.
- **status 필터 탭**: PENDING(기본)/APPROVED/REJECTED/REVOKED. 각 탭은 `useInfiniteList`로 무한스크롤(오프셋→커서).
- **항목별 액션(ApplicationReviewItem)**: PENDING → 승인(즉시)·거절(인라인 사유 펼침) / APPROVED → 철회(인라인 사유 펼침) / REJECTED·REVOKED → 액션 없음(터미널).
- **직접지정(GrantForm)**: 상단에 회원 id(number) + 사유(선택) 폼 → `POST /grant`. 성공/실패 메시지 노출.
- 액션(승인/거절/철회/지정) 성공 시 현재 탭 목록 재조회(status 필터가 표시 대상을 바꾸므로 재조회가 정확).
- 표시: "회원 #{memberId}" + statement + evidenceUrls(링크) + createdAt + (결정된 경우) decisionReason/decidedAt.

---

## 4. 데이터 계층 (`FE/lib/verification/`)

- `types.ts`
  - `VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED'`
  - `Application` = ApplicationResponse 형태(위)
  - `ApplyFormValues` = `{ statement: string; evidenceUrls: string[] }`
  - `GrantFormValues` = `{ memberId: string; reason: string }`(입력은 문자열, 전송 시 변환)
  - `SpringPage<T>`(content/number/totalPages/last)
- `logic.ts`
  - `toCursorPage<T>(page)` — 오프셋→커서(last ? null : number+1)
  - `validateApply(v)` — 사유 필수·≤1000, 증빙 링크 ≤10개, 빈 링크는 제출 시 제거. 첫 에러 또는 null
  - `validateReason(reason)` — 필수·≤500(거절/철회용). 첫 에러 또는 null
  - `statusLabel(status)` — 한글 라벨(심사 중/승인됨/거절됨/철회됨)
  - `canReapply(status)` — REJECTED/REVOKED만 true
  - `toApplyRequest(v)` — 빈 evidenceUrl 제거 후 `{ statement, evidenceUrls }`
  - `toGrantRequest(v)` — `{ memberId: Number, reason: reason || null }`
- 재사용: `useInfiniteList`, `Me` 타입(`lib/feed/types`)

---

## 5. BFF 라우트 (`proxyAuthed`, BE 미러)

```
/api/bff/verified-performers/applications                       POST(신청)
/api/bff/verified-performers/applications/me                    GET(내 상태)
/api/bff/admin/verified-performers/applications                 GET(?status&page)
/api/bff/admin/verified-performers/applications/[id]/approve    POST
/api/bff/admin/verified-performers/applications/[id]/reject     POST
/api/bff/admin/verified-performers/applications/[id]/revoke     POST
/api/bff/admin/verified-performers/grant                        POST
```

어드민 라우트도 단순 프록시 — ROLE_ADMIN 인가는 BE가 강제(비어드민이면 403). FE는 UX용 게이트.

---

## 6. 컴포넌트 (`FE/components/verification/`)

- `EvidenceUrlsInput` — 동적 URL 목록(추가/삭제, 최대 10). props `urls / onChange`.
- `ApplyForm` — 지원 사유 textarea + EvidenceUrlsInput. `validateApply` 후 `onSubmit`. 신청/재신청 공용.
- `MyStatusCard` — 회원 현재 상태 표시(status별 문구 + decisionReason).
- `ApplicationReviewItem` — 어드민 항목: 승인(즉시) + 거절/철회(인라인 사유 토글, `validateReason`).
- `GrantForm` — 어드민 직접지정(memberId + reason).

---

## 7. 권한 / 에러 규칙 (FE 파생)

- 회원 신청: 로그인 필요. 미로그인 → `/login`.
- 어드민 페이지: `role === 'ADMIN'`만. 아니면 `/dashboard`.
- 재신청 노출: `canReapply(status)`(REJECTED/REVOKED).
- BE 에러코드 → BFF `message` 그대로 노출: 409-04/05/06, 404-04.
- 상태 변경은 성공 시 재조회(회원=내 상태 재조회, 어드민=현재 탭 목록 재조회), 실패 시 메시지 노출.

---

## 8. 테스트 (Vitest, 계층별)

- **logic**: validateApply / validateReason / statusLabel / canReapply / toApplyRequest / toGrantRequest
- **bff**: 7라우트(cookies mock + fetch stub)
- **pages**: 회원(상태별 분기 4종 + 제출 성공/409), 어드민(비어드민 리다이렉트·status 탭·승인/거절 인라인/철회/grant)
- **components**: EvidenceUrlsInput / ApplyForm / MyStatusCard / ApplicationReviewItem / GrantForm

---

## 9. 진행 방식

- TDD, 서브에이전트 주도.
- 새 브랜치 `feature/verified-performer-fe`(main에서 분기 — 구인 등과 독립).
- 문서 반영: CONTEXT.md(FE 인증연주자 요약), TODO(DONE 이동·BACKLOG 체크), AI-ACTION-LOGS.md.

---

## 미해결/확인 필요 사항

1. `/profile`에 진입 링크 1개 추가(기존 파일 수정) — 승인됨(설계 확인).
2. 어드민 목록 "회원 #{memberId}" 표시(닉네임 없음, BE 제약) — 승인됨. 추후 BE에 표시정보 확장 시 개선(후속 백로그).
3. 회원측 PENDING 취소 기능은 BE에 없음 → FE도 대기 상태만 노출(범위 밖).

BE 응답 필드명은 위 계약대로 확정. 구현 착수 시 `lib/feed/types`의 `Me`(role 'USER'|'ADMIN') 재사용.
