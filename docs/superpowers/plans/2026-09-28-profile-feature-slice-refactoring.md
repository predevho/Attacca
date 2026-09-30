# 프로필 기능 슬라이스 리팩터링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/profile`의 현재 동작과 BFF 계약을 유지하면서 조회·편집·이미지·비밀번호·탈퇴 책임을 기능 폴더로 분리한다.

**Architecture:** `FE/app/profile/page.tsx`는 Next.js 경로 경계와 기능 루트 조립만 담당한다. 상태와 요청 조정은 `FE/features/profile/hooks`, 화면 조각은 `FE/features/profile/components`, 화면 전용 타입과 상수는 `FE/features/profile/model`, 기존 공통 HTTP primitive를 호출하는 얇은 어댑터는 `FE/features/profile/api`로 둔다. BFF route 파일과 `FE/lib/api.ts`는 물리 경로와 공개 함수를 유지한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-28-incremental-file-structure-refactoring-design.md`

## Global Constraints

* 브라우저 요청은 기존 same-origin BFF 경로만 사용하며, FE가 BE를 직접 호출하지 않는다.
* `/profile` URL, BFF HTTP 메서드, request payload, response shape를 변경하지 않는다.
* `FormData` 업로드에서 `Content-Type`을 직접 설정하지 않는다.
* `app/api/bff/**/route.ts`의 파일 시스템 라우트는 이동하지 않는다.
* `FE/lib/api.ts`와 인증 쿠키·opaque refresh session 동작은 이번 범위에서 바꾸지 않는다.
* UI의 기존 성공·실패·로딩 텍스트, 접근성 role, 탈퇴 후 `window.location.assign('/')` 동작을 유지한다.
* 새 의존성은 추가하지 않는다.

## Review Focus

* 비로그인 상태에서 `/api/bff/me`가 실패하면 기존처럼 `/login`으로 이동해야 한다.
* 프로필·선택지·신원 병렬 요청 중 선택지 또는 신원만 실패해도 프로필 화면은 표시되어야 한다.
* 이미지가 아닌 파일, 서버 오류, 네트워크 오류에서 같은 오류 영역에 이해 가능한 메시지가 표시되어야 한다.
* 악기 열한 번째 선택은 요청을 보내지 않고 최대 10개 오류를 표시해야 한다.
* 비밀번호 확인 값은 검증에는 쓰이되 `/api/bff/members/me/password` 요청 본문에는 포함되지 않아야 한다.

---

## 작업 1: 프로필 전용 모델과 API 경계 만들기

**파일:**
* 생성: `FE/features/profile/model/profile.ts`
* 생성: `FE/features/profile/api/profileApi.ts`
* 생성: `FE/__tests__/profile-api.test.ts`

- [ ] 먼저 `profileApi`의 BFF 경로와 payload를 고정하는 실패 테스트를 작성한다.
  - `loadProfilePageData()`가 `/api/bff/me`, `/api/bff/profile-options`, `/api/bff/me/identity`를 병렬로 요청하는지 확인한다.
  - `saveProfile()`이 `PUT /api/bff/me/profile`에 `{ instruments, bio }`만 전송하는지 확인한다.
  - `uploadProfileImage()`가 `PUT /api/bff/me/profile/image`에 동일한 `FormData`를 넘기는지 확인한다.
  - `changePassword()`가 확인란을 제외한 `{ currentPassword, newPassword }`만 전송하는지 확인한다.
  - `withdrawMember()`가 `DELETE /api/bff/members/me`를 호출하는지 확인한다.
- [ ] `FE/features/profile/model/profile.ts`에 `Profile`, `ProfileOption`, `ProfilePageData`, `MAX_INSTRUMENTS`를 정의한다.
  - `PasswordChangeForm`은 이미 공용 비밀번호 검증 모듈의 타입이므로 중복 정의하지 않는다.
  - `Me`는 기존 `@/lib/feed/types`에서 유지하고 재정의하지 않는다.
- [ ] `FE/features/profile/api/profileApi.ts`를 추가한다.
  - 기존 `getBff`, `putBff`, `putBffForm`, `deleteBff`만 호출한다.
  - BFF result를 임의로 unwrap하거나 오류 문구를 바꾸지 않는다. 화면 훅이 현재의 `ok`, `message`, `data` 처리를 유지할 수 있어야 한다.
- [ ] 대상 테스트 실행: `npm --prefix FE test -- --run __tests__/profile-api.test.ts`.
- [ ] 커밋 후보: `refactor: 프로필 요청 경계 분리`.

## 작업 2: 조회·편집·이미지 상태를 `useProfileEditor`로 분리

**파일:**
* 생성: `FE/features/profile/hooks/useProfileEditor.ts`
* 생성: `FE/features/profile/components/ProfileEditForm.tsx`
* 생성: `FE/features/profile/components/ProfileImageControl.tsx`
* 수정: `FE/app/profile/page.tsx`
* 수정: `FE/__tests__/profile-page.test.tsx`

- [ ] 먼저 기존 `profile-page` 테스트를 보강한다.
  - 초기 로딩 상태와 로드 실패 `role="alert"`를 확인한다.
  - 프로필 조회 실패 시 `/login` 이동을 확인한다.
  - 저장 성공 시 조회 모드로 전환하고 저장된 악기·소개가 반영되는지 확인한다.
  - 10개 초과 악기 선택과 비이미지 파일 오류를 확인한다.
- [ ] `useProfileEditor`에 다음 상태만 옮긴다: profile, options, me, editing, draftInstruments, draftBio, saving, uploading, loadError, 공통 profile error.
  - 초기 세 요청의 병렬 로드와 `router.push('/login')` 정책을 그대로 보존한다.
  - `startEdit`, `toggleInstrument`, `save`, `onImageChange`의 현재 성공·실패 문구를 보존한다.
  - 이미지 성공 후에는 현재 profile 객체의 `profileImageUrl`만 교체한다.
- [ ] `ProfileEditForm`에는 소개와 악기 편집 UI를, `ProfileImageControl`에는 이미지 선택 UI를 옮긴다.
  - 훅이 상태와 이벤트 핸들러를 소유하고 컴포넌트는 필요한 값과 콜백만 받도록 한다.
  - 현재 `AuthorBadge`, 시각 스타일, focus-visible 클래스, `aria-live`/`role`을 보존한다.
- [ ] `FE/app/profile/page.tsx`를 얇은 루트로 줄인다. 페이지 파일에 직접 BFF 호출이나 편집 상태가 남지 않아야 한다.
- [ ] 대상 테스트 실행: `npm --prefix FE test -- --run __tests__/profile-api.test.ts __tests__/profile-page.test.tsx`.
- [ ] 커밋 후보: `refactor: 프로필 조회와 편집 화면 분리`.

## 작업 3: 비밀번호·탈퇴 행동을 독립 컴포넌트로 분리

**파일:**
* 생성: `FE/features/profile/components/PasswordChangeForm.tsx`
* 생성: `FE/features/profile/components/WithdrawSection.tsx`
* 생성: `FE/features/profile/hooks/usePasswordChange.ts`
* 생성: `FE/features/profile/hooks/useMemberWithdrawal.ts`
* 수정: `FE/app/profile/page.tsx`
* 수정: `FE/__tests__/profile-page.test.tsx`
* 참조 유지: `FE/lib/auth/passwordChangeValidation.ts`

- [ ] 먼저 실패 테스트를 추가한다.
  - 비밀번호 검증 실패 시 세 필드 오류가 표시되고 BFF 요청이 발생하지 않는지 확인한다.
  - 성공 요청 본문에 `newPasswordConfirm`이 없는지 확인한다.
  - 서버·네트워크 실패 문구와 pending 상태를 확인한다.
  - 탈퇴 확인 문구가 일치하지 않으면 버튼이 비활성인지, 성공 시 `window.location.assign('/')`를 호출하는지 확인한다.
- [ ] `usePasswordChange`는 기존 `validatePasswordChange`, `hasError`와 `PasswordChangeForm`을 재사용한다.
  - touched 상태, success 메시지, 서버 오류, pending 상태를 훅 안에 둔다.
  - API 요청은 작업 1의 `changePassword`를 사용한다.
- [ ] `useMemberWithdrawal`은 confirmText, pending, error와 삭제 요청을 담당한다.
  - `window.location.assign('/')`를 유지한다. `router.push`나 `router.refresh`로 바꾸지 않는다.
- [ ] 각 폼 컴포넌트는 UI와 접근성 속성만 소유하고, 데이터 요청과 페이지 전환 판단은 훅에 둔다.
- [ ] 대상 테스트 실행: `npm --prefix FE test -- --run __tests__/password-change-validation.test.ts __tests__/profile-api.test.ts __tests__/profile-page.test.tsx`.
- [ ] 커밋 후보: `refactor: 프로필 보안 행동 분리`.

## 작업 4: 기능 경계 검증과 문서 반영

**파일:**
* 수정: `FE/app/profile/page.tsx`
* 수정: `FE/__tests__/profile-page.test.tsx`
* 수정: `docs/ARCHITECTURE-STATUTE.md`
* 수정: `docs/TODO-BACKLOG.md`
* 수정: `docs/TODO-DONE.md`
* 수정: `docs/AI-ACTION-LOGS.md`

- [ ] 구조 검사를 추가하거나 수동 확인한다.
  - `FE/app/profile/page.tsx`에 `getBff`, `putBff`, `putBffForm`, `deleteBff` import가 남지 않는지 확인한다.
  - `FE/app/profile/page.tsx`에 `useState`와 `useEffect` 기반 도메인 상태가 남지 않는지 확인한다.
  - BFF route 파일의 경로·내용을 변경하지 않았는지 `git diff`로 확인한다.
- [ ] FE 전체 검증을 수행한다.
  - `npm --prefix FE test`
  - `npm --prefix FE run typecheck`
  - `npm --prefix FE run lint`
  - `npm --prefix FE run colors`
  - `npm --prefix FE run build`
- [ ] 로컬 브라우저 스모크 체크를 한다.
  - 로그인한 사용자로 `/profile`을 열고 조회, 수정, 이미지 업로드 실패, 비밀번호 검증 실패, 탈퇴 확인 문구 비일치 상태를 각각 확인한다.
  - Network에서 기존 BFF 경로와 HTTP 메서드가 유지되는지 확인한다.
- [ ] 실제 확정된 `features/profile` 경계만 `docs/ARCHITECTURE-STATUTE.md`에 기록한다.
  - 계획 단계의 Notice·Chat 후속 후보는 완료 문서에 넣지 않는다.
  - 완료 사항과 테스트 근거를 TODO/작업 로그에 기록한다.
- [ ] `git diff --check`와 `git status --short`를 확인한다.
- [ ] 커밋 후보: `docs: 프로필 구조 리팩터링 기록`.

## 구현 후 다음 결정

프로필 리팩터링이 완료된 뒤에만 다음 중 하나를 새 설계로 시작한다.

1. `NoticeService`의 명령·조회 분리: 컨트롤러 공개 계약을 유지할 수 있는지와 실제 테스트 커버리지를 먼저 측정한다.
2. 채팅 화면 분리: WebSocket 재연결, 구독 중복, 페이지네이션과 스크롤 보존을 자동 검증할 수 있을 때만 시작한다.

둘을 이번 계획에 섞지 않는다.
