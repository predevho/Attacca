# 밝은 콘텐츠 커뮤니티 UI와 피드·구인 첨부 구현 계획

## 구현 현황 (2026-09-23)

* **완료**: Flyway V7 관계 테이블, `TEMPORARY`/`ATTACHED` 파일 상태, 임시 업로드 API와 정리 스케줄러, 피드·구인글의 소유 검증 후 연결 및 조회 응답을 구현했다.
* **완료**: 프런트 BFF multipart 프록시, 선택 검증, 실패 파일별 오류·개별 재시도, 성공한 임시 ID 재사용, 상세 첨부 목록, `/feed/new` 작성 화면과 기본 밝은 테마를 구현했다.
* **검증 완료**: BE 전체 테스트, FE 전체 테스트·타입검사·lint·색 토큰 검사·build를 실행했다. lint는 기존 `img` 관련 경고 5건만 남고 실패하지 않는다.
* **남은 검증**: 운영 브라우저에서 피드·구인 신규 첨부/조회, 파일별 실패 후 재시도, 모바일 레이아웃을 확인한 뒤 배포한다.
* **범위 고정**: 피드 본문은 빈 값 불가를 유지하며, 첨부 전용 게시글·첨부 삭제/교체/순서 변경·이미지 갤러리는 후속 작업이다. 수정 화면의 새 첨부는 기존 첨부를 보존하고 추가만 한다.

> **실행 방식:** 이 계획은 작업자가 순서대로 수행하는 구현 지침이다. 각 단계는 테스트를 먼저 추가하고, 범위를 벗어난 리팩터링 없이 실패 원인을 확인한 뒤 최소 변경으로 통과시킨다.

## Goal

밝은 기본 테마와 콘텐츠 탐색 중심의 전역 화면 구조를 적용한다. 피드와 구인 게시글에는 JPG, PNG, WebP, PDF를 실제로 업로드하고 게시글과 연결하며, 사용자에게 파일별 오류와 복구 행동을 명확히 제공한다.

## Architecture

- 업로드는 `FileMetadata`를 `TEMPORARY` 상태로 먼저 생성하고, 게시글 생성·수정 요청의 `attachmentIds`가 소유자와 상태를 검증한 뒤 해당 도메인 연결 테이블로 귀속한다.
- `FileMetadata`와 물리 저장소는 `global.storage`에 남기고, 피드·구인 도메인이 각자 연결 엔티티를 소유한다. 저장소가 도메인에 의존하지 않게 한다.
- 만료된 임시 파일은 설정값으로 보존 시간을 관리하는 스케줄러가 메타데이터와 실제 파일을 함께 정리한다. 정리 실패는 다음 스케줄에서 재시도 가능하게 오류만 기록한다.
- 프런트는 BFF를 통해 `multipart/form-data` 업로드를 중계한다. 게시글 저장 실패 뒤에도 작성 내용과 성공한 업로드 목록을 유지한다.
- 전역은 공통 헤더와 밝은 토큰을 적용하고, 피드·구인 화면만 이번 범위에서 콘텐츠 커뮤니티형 정보 계층으로 재구성한다.

## Tech Stack

- Backend: Java, Spring Boot, JPA, Flyway, MySQL, Spring Scheduler
- Frontend: Next.js App Router, TypeScript, React, Vitest, React Testing Library, Playwright
- Deployment boundary: Vercel BFF -> `api.attacca.site` Spring API. 비밀 값은 EC2 `.env.prod`에만 둔다.

## Spec

정본 설계는 [2026-09-22-content-community-attachments-ui-design.md](/Users/predevho/dev/Attaca/docs/superpowers/specs/2026-09-22-content-community-attachments-ui-design.md)다.

## 참고 자료

| 자료 | 적용 범위 | 적용하지 않는 범위 |
| --- | --- | --- |
| [Uibowl - 토스 비즈니스 참고 화면](https://uibowl.io/self-contents/cmmk1jz2s000ni804jza4m3ql) | 넓은 여백, 명확한 전역 탐색, 한 화면의 하나의 주요 행동, 콘텐츠 우선 정보 계층 | 원본 브랜드, 카피, 자산, 다크 톤, 화면을 그대로 복제하는 구현 |
| [Spring Framework - MultipartFile](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/multipart/MultipartFile.html) | 서버 파일 업로드 요청 형식과 스트림 처리 확인 | 업로드 정책이나 도메인 연결 규칙을 외부 예제로 대체하지 않음 |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | 확장자만 신뢰하지 않는 콘텐츠 검증, 크기 제한, 저장 경로 비노출 원칙 | 바이러스 검사나 별도 파일 서비스 도입은 이번 MVP에 포함하지 않음 |

## Global Constraints

- 허용 형식은 JPG, PNG, WebP, PDF이며 파일당 10 MB, 게시글당 최대 5개다.
- 피드는 본문만, 첨부만, 둘 다 가능하다. 본문과 첨부가 모두 비어 있으면 `INVALID_INPUT_VALUE`로 거절한다.
- 구인은 제목과 악기 정보가 필수이고, 설명과 첨부는 독립적으로 선택 사항이다.
- S3 presigned URL, CDN, 동영상, 이미지 편집, 드래그 정렬, 파일 관리자, 바이러스 검사, 기존 파일 일괄 마이그레이션은 이번 범위에서 구현하지 않는다.
- 브라우저 `alert()`를 사용하지 않는다. 입력 오류는 필드 근처, 파일 오류는 해당 파일 행, 제출 오류는 폼 상단에 보인다.
- 기존 API의 `{ resultCode, code, message }` 오류 응답은 유지한다. `fields`는 선택 속성으로만 확장한다.
- 외부 자료가 이후 결정에 쓰이면 해당 문서의 `참고 자료`에 URL, 적용 범위, 미적용 범위를 기록한다. 외부 자료가 없으면 그 사실을 명시한다.
- 커밋과 푸시는 사용자의 명시 요청이 있을 때만 한다.

## Review Focus

- 선언 MIME과 실제 바이트가 다른 파일, 다른 사용자의 임시 파일 ID, 이미 다른 도메인에 귀속된 파일 ID가 모두 거절되는가.
- 파일 업로드 실패와 게시글 저장 실패 뒤에도 사용자가 즉시 원인을 확인하고 다시 시도하거나 삭제할 수 있는가.
- 편집 시 기존 첨부 보존, 새 임시 첨부 귀속, 제거된 연결 해제가 의도대로 분리되는가.
- 밝은 전역 헤더가 모바일에서 깨지지 않고, 피드 작성이 목록에서 분리되어 정보 탐색을 방해하지 않는가.
- 업로드와 첨부 파일의 경로·예외 원문이 API 응답이나 UI에 노출되지 않는가.

---

## Task 1. 파일 메타데이터 상태와 도메인 연결 스키마를 추가한다

**Files:**
- Create: `BE/src/main/resources/db/migration/V7__post_attachments.sql`
- Create: `BE/src/main/java/com/back/global/storage/AttachmentState.java`
- Create: `BE/src/main/java/com/back/domain/feed/entity/FeedPostAttachment.java`
- Create: `BE/src/main/java/com/back/domain/recruitment/entity/RecruitmentPostingAttachment.java`
- Modify: `BE/src/main/java/com/back/global/storage/FileMetadata.java`
- Modify: `BE/src/main/java/com/back/global/storage/FileMetadataRepository.java`
- Modify: `BE/src/main/java/com/back/global/exception/ErrorCode.java`
- Test: `BE/src/test/java/com/back/global/storage/FileMetadataRepositoryTest.java`

**Consumes:** 저장소 파일 메타데이터와 기존 `Post`, `RecruitmentPosting` 테이블.

**Produces:** 임시/귀속 상태를 가진 파일 레코드와 두 게시 도메인의 명시적 연결 테이블.

1. `FileMetadataRepositoryTest`에 상태별 조회와 연결 테이블의 동일 파일 중복 연결 제약을 검증하는 실패 테스트를 추가한다.
2. Flyway V7에 확장 전용 DDL을 작성한다. 기존 `file_metadata`에는 프로필·공연 포스터 등 이미 사용 중인 파일이 있으므로, `state`는 `ATTACHED` 기본값과 `NOT NULL`을 사용한다. 새 업로드는 Java 생성 코드에서만 `TEMPORARY`로 명시한다. 각 연결 테이블은 게시글 FK, `file_metadata` FK, 정렬용 `display_order`, 생성 시각, 파일 ID 유니크 제약을 둔다.

```sql
ALTER TABLE file_metadata
    ADD COLUMN state VARCHAR(20) NOT NULL DEFAULT 'TEMPORARY';

CREATE TABLE feed_post_attachment (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    file_metadata_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    created_at DATETIME(6),
    UNIQUE KEY uk_feed_post_attachment_file (file_metadata_id),
    CONSTRAINT fk_feed_post_attachment_post FOREIGN KEY (post_id) REFERENCES feed_post (id),
    CONSTRAINT fk_feed_post_attachment_file FOREIGN KEY (file_metadata_id) REFERENCES file_metadata (id)
);
```

3. 같은 형태로 `recruitment_posting_attachment`를 만들되 `recruitment_posting` FK를 사용한다.
4. `AttachmentState { TEMPORARY, ATTACHED }`를 추가하고 `FileMetadata`에 상태, 상태 전이 메서드, 소유자 확인을 추가한다. 엔티티 외부에서 setter로 상태를 바꾸지 않는다.
5. 오류 코드를 추가한다: `INVALID_ATTACHMENT_TYPE`, `ATTACHMENT_TOO_LARGE`, `ATTACHMENT_LIMIT_EXCEEDED`, `ATTACHMENT_NOT_OWNED`, `ATTACHMENT_NOT_TEMPORARY`. 기존 `FILE_NOT_FOUND`, `FILE_UPLOAD_FAILED`는 재사용한다.
6. 테스트를 실행한다.

```bash
cd BE && ./gradlew test --tests 'com.back.global.storage.FileMetadataRepositoryTest'
```

## Task 2. 업로드 정책·임시 파일 수명·정리 작업을 구현한다

**Files:**
- Create: `BE/src/main/java/com/back/global/storage/AttachmentFilePolicy.java`
- Create: `BE/src/main/java/com/back/global/storage/TemporaryAttachmentCleanupScheduler.java`
- Modify: `BE/src/main/java/com/back/global/storage/FileService.java`
- Modify: `BE/src/main/java/com/back/global/storage/FileMetadataRepository.java`
- Modify: `BE/src/main/resources/application.yml`
- Test: `BE/src/test/java/com/back/global/storage/AttachmentFilePolicyTest.java`
- Test: `BE/src/test/java/com/back/global/storage/FileServiceTest.java`

**Consumes:** Task 1의 상태 필드와 현행 `FileStorage` 구현.

**Produces:** 바이트 서명과 크기를 검증해 임시 업로드하고, 소유자만 귀속 가능하게 하는 저장소 서비스.

1. `AttachmentFilePolicyTest`부터 작성한다. 정상 JPEG/PNG/WebP/PDF, 10 MB 초과, 허용되지 않은 텍스트 파일, 선언 `image/png`이지만 PNG 서명이 아닌 바이트를 각각 검증한다.
2. `AttachmentFilePolicy`는 확장자만으로 판단하지 않고 선언 `contentType`과 최소 바이트 서명을 함께 확인한다. 이번 형식에는 별도 파서 라이브러리를 추가하지 않고 다음 고정 시그니처만 검사한다.

```java
private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
private static final byte[] PDF = {0x25, 0x50, 0x44, 0x46, 0x2D};
```

3. `FileService.uploadTemporary(MultipartFile file, Long uploaderId)`를 추가한다. 정책 검증 후 물리 파일을 저장하고 `state=TEMPORARY` 메타데이터를 만들며, 메타데이터 저장 실패 시 저장된 물리 파일을 삭제한다.
4. `claimTemporaryFiles(List<Long> attachmentIds, Long uploaderId)`를 추가한다. 중복 ID, 5개 초과, 누락 ID, 소유자 불일치, `TEMPORARY` 이외 상태를 모두 `BusinessException`으로 거절한다. 성공한 결과만 `ATTACHED`로 전이한다.
5. 연결을 해제해도 이미 `ATTACHED`인 파일은 즉시 물리 삭제하지 않는다. 향후 게시글 삭제 정책과 충돌하지 않게 이번 변경은 연결 정보만 갱신한다.
6. `storage.temporary-cleanup-retention`과 `storage.temporary-cleanup-cron` 설정을 추가한다. 스케줄러는 만료된 `TEMPORARY` 파일을 찾고 물리 저장소 삭제 성공 뒤 메타데이터를 삭제한다. 한 파일 실패가 다른 파일 정리를 중단하지 않도록 반복 단위를 분리한다.
7. `FileServiceTest`에서 업로드 실패 시 메타데이터 미생성, 소유자 불일치 거절, 상태 전이 성공, 만료 임시 파일 삭제를 검증한다.

```bash
cd BE && ./gradlew test --tests 'com.back.global.storage.AttachmentFilePolicyTest' --tests 'com.back.global.storage.FileServiceTest'
```

## Task 3. 파일 업로드 API와 오류 필드 계약을 추가한다

**Files:**
- Create: `BE/src/main/java/com/back/global/storage/FileController.java`
- Create: `BE/src/main/java/com/back/global/storage/dto/AttachmentResponse.java`
- Modify: `BE/src/main/java/com/back/global/response/ApiResponse.java`
- Modify: `BE/src/main/java/com/back/global/exception/GlobalExceptionHandler.java`
- Test: `BE/src/test/java/com/back/global/storage/FileControllerTest.java`
- Test: `BE/src/test/java/com/back/global/exception/GlobalExceptionHandlerTest.java`

**Consumes:** Task 2의 `uploadTemporary`와 현행 인증 principal.

**Produces:** 인증 사용자가 BFF를 통해 임시 파일을 업로드·삭제할 수 있는 API와 선택적 필드 오류 응답.

1. `FileControllerTest`로 `POST /api/files`의 정상 `multipart/form-data` 업로드, 비인증 요청, 초과 파일, 잘못된 타입을 먼저 실패하게 만든다.
2. `POST /api/files`는 단일 `file` 파트만 받고 `AttachmentResponse(id, originalName, contentType, size, url)`을 반환한다. 로컬 저장 경로·storageKey는 반환하지 않는다.
3. `DELETE /api/files/{fileId}`는 요청자가 소유한 `TEMPORARY` 파일만 제거한다. 이미 귀속된 파일에는 삭제 API를 사용하지 않으며, UI의 게시글 편집 제거는 연결 목록 업데이트로 처리한다.
4. `ApiResponse`에 `fields`를 선택적으로 담을 수 있게 하되, 기존 생성 메서드는 그대로 유지한다. 검증 예외가 있을 때만 예를 들어 `{"content":"내용 또는 첨부 파일을 추가해 주세요."}`를 포함한다.
5. 원본 `MultipartException`, 저장소 절대 경로, Java 예외 메시지는 응답 본문에 넣지 않는다.
6. 테스트를 실행한다.

```bash
cd BE && ./gradlew test --tests 'com.back.global.storage.FileControllerTest' --tests 'com.back.global.exception.GlobalExceptionHandlerTest'
```

## Task 4. 피드와 구인 도메인에 첨부 연결을 적용한다

**Files:**
- Create: `BE/src/main/java/com/back/domain/feed/repository/FeedPostAttachmentRepository.java`
- Create: `BE/src/main/java/com/back/domain/recruitment/repository/RecruitmentPostingAttachmentRepository.java`
- Create: `BE/src/main/java/com/back/global/storage/dto/AttachmentSummary.java`
- Modify: `BE/src/main/java/com/back/domain/feed/dto/CreatePostRequest.java`
- Modify: `BE/src/main/java/com/back/domain/feed/dto/UpdatePostRequest.java`
- Modify: `BE/src/main/java/com/back/domain/feed/dto/PostResponse.java`
- Modify: `BE/src/main/java/com/back/domain/feed/entity/Post.java`
- Modify: `BE/src/main/java/com/back/domain/feed/service/FeedPostService.java`
- Modify: `BE/src/main/java/com/back/domain/recruitment/dto/RecruitmentPostingRequest.java`
- Modify: `BE/src/main/java/com/back/domain/recruitment/dto/RecruitmentPostingResponse.java`
- Modify: `BE/src/main/java/com/back/domain/recruitment/entity/RecruitmentPosting.java`
- Modify: `BE/src/main/java/com/back/domain/recruitment/service/RecruitmentPostingService.java`
- Test: `BE/src/test/java/com/back/domain/feed/service/FeedPostServiceTest.java`
- Test: `BE/src/test/java/com/back/domain/recruitment/service/RecruitmentPostingServiceTest.java`

**Consumes:** Task 1~3의 연결 엔티티, `AttachmentResponse`, 임시 파일 귀속 서비스.

**Produces:** 생성·수정·조회 응답에 실제 첨부가 반영되는 두 게시 도메인.

1. 피드 서비스 테스트에 아래 네 시나리오를 먼저 추가한다: 텍스트만 생성, 첨부만 생성, 본문과 첨부 모두 비어 있음 거절, 타 사용자 임시 파일 ID 거절.
2. `CreatePostRequest`와 `UpdatePostRequest`에 `List<Long> attachmentIds`를 추가한다. `content`의 `@NotBlank`를 제거하고, 서비스에서 `StringUtils.hasText(content) || !attachmentIds.isEmpty()`를 확인해 도메인 오류를 만든다.
3. 피드 생성은 게시글을 저장한 뒤 임시 파일을 claim하고 `display_order` 순서대로 `FeedPostAttachment`를 만든다. 트랜잭션 실패 시 상태 전이와 연결 저장도 함께 롤백된다.
4. 피드 수정은 요청의 ID 목록을 최종 목록으로 취급한다. 기존에 같은 게시글에 연결된 ID는 유지하고, 새 `TEMPORARY` ID만 claim한다. 요청에서 빠진 기존 연결은 삭제한다.
5. 구인 생성·수정에 동일한 `attachmentIds` 처리와 `RecruitmentPostingAttachment` 연결을 적용한다. 구인의 제목·악기 검증은 기존 규칙을 유지한다.
6. `PostResponse`와 `RecruitmentPostingResponse`에 `attachments` 목록을 추가한다. 목록 화면은 첨부 전체를 받을 수 있어도 프런트가 첫 이미지와 개수만 표시하며, 상세는 전체를 표시한다.
7. N+1을 만들지 않도록 목록/상세 조회의 연결 파일을 fetch join 또는 배치 조회로 가져오는 저장소 쿼리를 작성하고, 기존 목록 정렬·페이징 계약은 유지한다.
8. 두 서비스 테스트를 실행한다.

```bash
cd BE && ./gradlew test --tests 'com.back.domain.feed.service.FeedPostServiceTest' --tests 'com.back.domain.recruitment.service.RecruitmentPostingServiceTest'
```

## Task 5. Next.js BFF와 프런트 API 계약을 multipart 업로드에 맞춘다

**Files:**
- Create: `FE/app/api/bff/files/route.ts`
- Create: `FE/app/api/bff/files/[id]/route.ts`
- Modify: `FE/lib/server/bffProxy.ts`
- Modify: `FE/lib/api.ts`
- Modify: `FE/lib/feed/types.ts`
- Modify: `FE/lib/recruitment/types.ts`
- Test: `FE/__tests__/bff-files.test.ts`
- Test: `FE/__tests__/api.test.ts`

**Consumes:** Task 3의 API 경로와 응답 계약.

**Produces:** 브라우저가 쿠키를 외부 API에 직접 노출하지 않고 파일을 업로드·삭제하는 BFF 경로와 타입 안전한 첨부 모델.

1. 기존 프로필 이미지와 공연 포스터 BFF가 FormData를 중계하는 방식을 확인한 뒤, 같은 `proxyAuthed` 경계를 사용한 실패 테스트를 작성한다.
2. `POST /api/bff/files`는 브라우저의 `FormData`를 그대로 백엔드 `/api/files`로 전달한다. 여기서 `Content-Type`을 수동으로 설정하지 않아 multipart boundary가 유실되지 않게 한다.
3. `DELETE /api/bff/files/[id]`는 백엔드 임시 파일 삭제를 중계한다.
4. `BffResult<T>`에 `fields?: Record<string, string>`를 선택 속성으로 추가하고, `postBffForm<T>(path, formData)`를 추가한다. 기존 JSON helper의 동작은 바꾸지 않는다.
5. `Attachment` 프런트 타입은 `id`, `originalName`, `contentType`, `size`, `url`만 포함한다. `storageKey`나 서버 물리 경로는 타입에 넣지 않는다.
6. BFF 실패가 `message`, `fields`를 보존해 호출자에 전달되는지 테스트한다.

```bash
cd FE && npm test -- --runInBand __tests__/bff-files.test.ts __tests__/api.test.ts
```

## Task 6. 재사용 가능한 첨부 입력과 오류 요약 컴포넌트를 구현한다

**Files:**
- Create: `FE/components/attachments/AttachmentUploader.tsx`
- Create: `FE/components/attachments/AttachmentList.tsx`
- Create: `FE/components/forms/FormErrorSummary.tsx`
- Create: `FE/lib/attachments/validation.ts`
- Modify: `FE/app/globals.css`
- Test: `FE/__tests__/attachment-uploader.test.tsx`
- Test: `FE/__tests__/form-error-summary.test.tsx`

**Consumes:** Task 5의 BFF API와 `Attachment` 타입.

**Produces:** 파일 선택, 즉시 검증, 업로드 상태, 재시도·제거, 접근 가능한 오류 안내를 공유하는 UI.

1. `AttachmentUploader` 테스트를 먼저 추가한다: 허용되지 않은 형식 즉시 거절, 10 MB 초과 즉시 거절, 업로드 중 중복 선택 방지, 실패 행의 재시도, 성공 파일의 제거.
2. 클라이언트 검증은 MIME과 확장자로 빠르게 안내하되, 서버 검증을 최종 권위로 둔다. 허용 목록은 `image/jpeg`, `image/png`, `image/webp`, `application/pdf`로 통일한다.
3. 각 행은 `queued`, `uploading`, `uploaded`, `error` 상태를 안정된 높이로 표시한다. 이미지는 썸네일과 대체 텍스트를 제공하고 PDF는 파일명·크기·다운로드 링크를 제공한다.
4. 실패 행에는 서버 메시지와 `다시 시도`, `제거` 동작을 함께 제공한다. 업로드 성공한 목록은 부모 폼에 `attachmentIds`와 상세 모델로 전달한다.
5. `FormErrorSummary`는 `role="alert"`로 제출 오류를 표시하고, 첫 번째 오류 필드의 ID를 받아 해당 요소에 focus한다. 필드는 `aria-invalid`와 `aria-describedby`를 사용한다.
6. UI 색상은 기존 CSS 토큰만 사용한다. 이번 변경으로 새 raw hex 값을 추가하지 않는다.
7. 컴포넌트 테스트를 실행한다.

```bash
cd FE && npm test -- --runInBand __tests__/attachment-uploader.test.tsx __tests__/form-error-summary.test.tsx
```

## Task 7. 피드의 작성 흐름·목록·상세 화면을 콘텐츠 중심으로 바꾼다

**Files:**
- Create: `FE/app/feed/new/page.tsx`
- Create: `FE/components/feed/FeedEditor.tsx`
- Modify: `FE/app/feed/page.tsx`
- Modify: `FE/app/feed/[id]/page.tsx`
- Modify: `FE/components/feed/PostCard.tsx`
- Delete: `FE/components/feed/ComposeForm.tsx`
- Modify: `FE/app/globals.css`
- Test: `FE/__tests__/feed-new-page.test.tsx`
- Test: `FE/__tests__/feed-page.test.tsx`
- Test: `FE/__tests__/feed-detail-page.test.tsx`

**Consumes:** Task 4의 피드 첨부 API와 Task 6의 업로더.

**Produces:** 읽기 전용 목록, 별도 작성 화면, 미디어 요약 목록, 전체 첨부 상세 화면.

1. `/feed` 테스트에서 인라인 작성 폼이 없고 `글쓰기` 버튼이 `/feed/new`로 이동하는지 실패하게 만든다.
2. `/feed/new`의 `FeedEditor`는 본문과 첨부를 독립적으로 관리한다. 제출 시 `attachmentIds`를 JSON 요청에 포함하고, 성공하면 응답 ID의 `/feed/{id}`로 이동한다.
3. 본문과 첨부가 모두 없는 경우 제출하지 않고 본문 입력 영역과 첨부 영역에 연결된 오류를 표시한다. 서버가 동일 오류를 반환해도 입력 내용과 업로드 완료 파일을 유지한다.
4. `PostCard`는 첫 번째 이미지 미리보기만 보이고 남은 첨부 수가 있으면 `+N`을 표시한다. PDF만 있는 경우 파일 수 요약과 PDF 아이콘/레이블을 사용한다.
5. 상세는 이미지 전체 갤러리와 PDF 다운로드 링크를 표시한다. 이미지 없는 게시글은 미디어 영역을 렌더하지 않는다.
6. 더 이상 호출되지 않는 `ComposeForm.tsx`를 제거하고 기존 관련 테스트를 `FeedEditor` 기준으로 이동한다.
7. 피드 테스트와 타입 검사를 실행한다.

```bash
cd FE && npm test -- --runInBand __tests__/feed-new-page.test.tsx __tests__/feed-page.test.tsx __tests__/feed-detail-page.test.tsx
npm run typecheck
```

## Task 8. 구인 작성·수정·상세에 첨부와 복구 가능한 오류를 적용한다

**Files:**
- Modify: `FE/components/recruitment/PostingForm.tsx`
- Modify: `FE/app/recruitments/page.tsx`
- Modify: `FE/app/recruitments/[id]/page.tsx`
- Modify: `FE/app/recruitments/new/page.tsx`
- Modify: `FE/app/recruitments/[id]/edit/page.tsx`
- Modify: `FE/app/globals.css`
- Test: `FE/__tests__/recruitment-posting-form.test.tsx`
- Test: `FE/__tests__/recruitment-detail-page.test.tsx`

**Consumes:** Task 4의 구인 첨부 API와 Task 6의 입력 컴포넌트.

**Produces:** 구인 등록·수정·조회에서 실제 첨부를 처리하고 제목/악기 오류를 정확히 가리키는 화면.

1. `PostingForm` 테스트에 제목 오류, 악기 오류, 첨부 업로드 성공, 편집 시 기존 첨부 유지와 제거를 먼저 추가한다.
2. 신규/편집 공통 폼에서 서버 `fields.title`, `fields.instruments`, `fields.attachmentIds`를 각각의 입력과 연결한다.
3. 편집 초기값의 기존 첨부는 업로드된 새 파일과 같은 목록에서 보이되, 기존 파일 제거는 즉시 물리 삭제하지 않고 최종 `attachmentIds`에서 제외한다.
4. 구인 목록에는 첫 이미지 또는 첨부 개수만 요약하고, 상세에는 이미지와 PDF를 모두 표시한다. 기존 악기·마감·지원 흐름은 변경하지 않는다.
5. 구인 테스트와 타입 검사를 실행한다.

```bash
cd FE && npm test -- --runInBand __tests__/recruitment-posting-form.test.tsx __tests__/recruitment-detail-page.test.tsx
npm run typecheck
```

## Task 9. 밝은 전역 셸과 콘텐츠 탐색 계층을 적용하고 전체 검증한다

**Files:**
- Modify: `FE/components/layout/Header.tsx`
- Modify: `FE/app/layout.tsx`
- Modify: `FE/app/globals.css`
- Modify: `FE/app/page.tsx`
- Modify: `FE/app/feed/page.tsx`
- Modify: `FE/app/recruitments/page.tsx`
- Modify: `FE/app/performances/page.tsx`
- Modify: `docs/DOMAIN-COMMON-STATUTE.md`
- Modify: `docs/DOMAIN-FEED-STATUTE.md`
- Modify: `docs/DOMAIN-RECRUITMENT-STATUTE.md`
- Modify: `docs/TODO-DOING.md`
- Modify: `docs/TODO-DONE.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/AI-ACTION-LOGS.md`
- Modify: `docs/AI-MAJOR-EVENT.md`
- Modify: `docs/AI-MAJOR-EVENT-RECAP.md`
- Test: `FE/__tests__/header.test.tsx`
- Test: `FE/__tests__/light-layout.test.tsx`

**Consumes:** Task 5~8의 기능 화면과 정본 설계.

**Produces:** 밝은 기본 전역 탐색, 공통 콘텐츠 폭, 반응형 헤더, 최종 기술·운영 문서와 Notion 미러.

1. 헤더 테스트부터 작성한다. 데스크톱에서 브랜드/주 탐색/계정 행동이 모두 보이고, 좁은 화면에서는 탐색이 겹치지 않으며 현재 경로가 접근 가능하게 표시되는지 검증한다.
2. `globals.css`의 밝은 토큰을 기본값으로 정리하고 헤더를 흰 배경·얇은 경계·제한된 콘텐츠 폭으로 바꾼다. 라운드 카드 남용, 장식용 그라데이션, 앱 같은 과도한 고정 패널을 추가하지 않는다.
3. 홈·피드·구인·공연에 공통 페이지 폭과 제목/주요 행동 계층을 적용한다. 피드·구인 외 도메인의 데이터 요청과 기능 동작은 바꾸지 않는다.
4. 모바일에서 헤더, 피드 목록, 피드 작성, 구인 작성의 텍스트/버튼이 겹치지 않는지 Playwright 스크린샷으로 확인한다. 이미지·PDF 첨부 성공/실패도 실제 로컬 브라우저에서 확인한다.
5. 문서를 정본 기준으로 최신화한다. 공통 규칙에는 파일 수명/오류 계약/참고 자료 규칙을, 각 도메인 규칙에는 첨부 연결과 비어 있는 피드의 거절 조건을 기록한다. 완료 작업은 TODO DONE으로 이동한다.
6. Notion TODO 상태와 Attacca 허브 요약을 `docs/` 변경 후 미러링한다. 접근 불가하면 docs에는 반영하고 미반영 사실을 작업 기록에 남긴다.
7. 전체 자동 검증을 실행한다. 프로젝트의 기존 색상 검사 규칙과 백엔드 테스트가 모두 통과해야 한다.

```bash
cd BE && ./gradlew test
cd ../FE && npm test -- --runInBand
npm run typecheck
npx eslint .
npm run check:colors
```

8. 개발 서버를 실행한 뒤 데스크톱과 모바일 뷰포트에서 다음을 확인한다: 밝은 전역 헤더, `/feed`에서 `/feed/new` 이동, 이미지/PDF 업로드, 파일별 오류/재시도, 첨부만 피드 게시, 구인 수정의 기존 첨부 유지·제거, 게시글 상세 표시. 운영 배포와 커밋·푸시는 사용자가 명시적으로 요청한 후에만 별도 단계로 진행한다.

## Plan Self-review

- **Coverage:** 임시 파일 생성부터 귀속·정리, BFF 중계, 피드·구인 CRUD, 오류 복구, 밝은 전역 UI, 문서·Notion 미러와 브라우저 검증을 모두 단계로 분리했다.
- **Scope control:** S3, CDN, 파일 정렬, 동영상, 바이러스 검사, 별도 파일 관리 화면과 무관한 페이지 기능 변경을 제외했다.
- **Contract consistency:** 백엔드는 `attachmentIds`와 선택적 `fields`, 프런트는 같은 타입과 BFF FormData 경로를 사용한다. 기존 오류 계약은 유지한다.
- **Failure coverage:** 형식/크기/서명/소유자/상태/개수/업로드 실패/제출 실패/임시 파일 만료를 테스트와 UI에서 다룬다.
- **Reference policy:** 계획 자체에 참고 URL, 적용 범위, 미적용 범위를 기록했고, 구현 뒤 도메인·운영 문서에도 같은 정책을 반영하도록 지정했다.
