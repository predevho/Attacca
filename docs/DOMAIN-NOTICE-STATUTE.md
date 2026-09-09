# DOMAIN-NOTICE-STATUTE

공지·소식·운영 일정 도메인 구현 규칙.

> 작성일: 2026-09-08. 세부 필드·엔드포인트 시그니처는 구현 착수 시 확정하며, 변경 시 이 문서를 갱신한다.
> 작성 자격(ADMIN 전용)·공개 조회 분리·`scheduledAt` 단일 상태·soft delete·도메인 경계는 확정 규칙이다.

---

## 1. 패키지

```
com.back.domain.notice
├── controller      // NoticeAdminController, NoticePublicController
├── service
├── repository
├── entity
└── dto             // 어드민 DTO와 공개 DTO를 분리해 둔다(§6)
```

---

## 2. 엔티티 (초안)

`BaseEntity` 상속(createdAt/updatedAt). 기존 패턴 준수: `@NoArgsConstructor(access = PROTECTED)` + private 생성자 + static 팩토리, 단순 접근자는 Lombok `@Getter`, setter 금지(의도가 드러나는 변경 메서드).

### Notice

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | Long | PK |
| `authorId` | Long | 작성 어드민. non-null |
| `type` | NoticeType | `NOTICE`/`NEWS`/`EVENT`. non-null. `@Enumerated(EnumType.STRING)` |
| `title` | String | non-null, ≤100 |
| `content` | String | 본문. non-null, ≤5000 |
| `scheduledAt` | LocalDateTime | **nullable.** 값이 있으면 달력에 뜬다(§5) |
| `place` | String | 일정 장소. ≤200, nullable |
| `pinned` | boolean | 홈 캐러셀 노출 여부. 기본 false, non-null |
| `coverImageKey` | String | 커버 이미지 key(FileService). nullable |
| `deletedAt` | LocalDateTime | soft delete 마킹. null=미삭제 |

* 팩토리 `create(authorId, type, title, content, scheduledAt, place, pinned)`.
* 변경 메서드: `edit(...)`(본문 필드 전체 교체, PUT 시맨틱), `changeCover(newKey)`, `pin()`/`unpin()`, `delete()`(=`deletedAt=now`), `isDeleted()`, `isScheduled()`(=`scheduledAt != null`).
* `authorId`는 원시 Long. 작성자 정보가 필요하면 서비스 계층에서 MEMBER 서비스로 협력한다.

### NoticeType

| 값 | 뜻 | 홈에서의 쓰임 |
|---|---|---|
| `NOTICE` | 공지 | 캐러셀 배지 "공지" |
| `NEWS` | 소식 | 캐러셀 배지 "뉴스" |
| `EVENT` | 운영 일정 | 캐러셀 + 달력 |

* `type`은 **표시 분류**이지 데이터 제약이 아니다. `NOTICE`에 `scheduledAt`을 넣으면 달력에 뜬다(§5). 단 `EVENT` 등록 시에는 `scheduledAt`을 요구한다(§3) — 날짜 없는 일정은 의미가 없기 때문이다.
* 인덱스: `(deletedAt, scheduledAt)`(달력 범위 조회), `(deletedAt, pinned, createdAt)`(캐러셀). 구현 시 실제 쿼리로 확정.

---

## 3. 권한 & 검증 규칙 (확정)

* **등록·수정·삭제·커버 변경**: `ROLE_ADMIN`만. 경로 자체를 `/api/admin/notices`에 두어 `SecurityConfig`의 기존 `requestMatchers("/api/admin/**").hasRole("ADMIN")`으로 막는다(VERIFIED-PERFORMER 어드민 경로 선례와 동일). 별도 서비스 계층 판정은 두지 않는다.
* **조회**: 공개. 비인증 포함 누구나(§6).
* `authorId`는 등록한 어드민 본인이다. 다른 어드민이 수정·삭제할 수 있다(운영 주체의 글이지 개인 글이 아니므로 소유자 판정을 두지 않는다).
* 검증(`@Valid`):
  * `title` `@NotBlank @Size(max=100)`, `content` `@NotBlank @Size(max=5000)`, `place` `@Size(max=200)`.
  * `type == EVENT`이면 `scheduledAt` 필수. 위반 시 `INVALID_INPUT_VALUE`(400-01).
  * `scheduledAt` 과거 일시 등록은 **허용**(지난 일정 기록용).

---

## 4. soft delete 규칙 (확정)

* 모든 조회(공개·어드민, 목록·단건)는 `deletedAt IS NULL` 조건을 포함한다.
* 삭제된 글의 단건 조회·수정·커버 변경은 `NOTICE_NOT_FOUND`.

---

## 5. `scheduledAt` 단일 상태 규칙 (확정)

* **달력 노출 = `scheduledAt IS NOT NULL`.** 별도 플래그를 두지 않는다(CONSTITUTION §2).
* 달력 조회는 `scheduledAt`이 주어진 범위 안에 있고 `deletedAt IS NULL`인 것만 반환한다.
* `pinned`는 **캐러셀** 노출만 제어한다. 달력과 무관하다. 두 축은 독립이다(달력에만 뜨는 일정, 캐러셀에만 뜨는 공지, 둘 다 뜨는 것 모두 유효).

---

## 6. 공개 조회 규칙 (확정) — 이 도메인이 처음 도입한다

기존 도메인은 모두 인증 필수였다(`SecurityConfig`의 `anyRequest().authenticated()`). 이 도메인이 비인증 조회를 처음 여는 만큼, 규칙을 여기서 확정하고 이후 도메인(PERFORMANCE 공개 조회 등)도 같은 규칙을 따른다.

* **경로 분리**: 공개는 `/api/public/**`, 어드민은 `/api/admin/**`. `SecurityConfig`에 `requestMatchers("/api/public/**").permitAll()`을 추가한다.
* **컨트롤러 분리**: `NoticePublicController` / `NoticeAdminController`. 하나의 컨트롤러에서 인증 여부로 분기하지 않는다.
* **DTO 분리**: 공개 응답은 어드민 응답과 **다른 클래스**를 쓴다. 필드는 화이트리스트다 — 넣기로 정한 것만 들어간다.
* **공개 응답에 넣지 않는 것**(모든 도메인 고정): 회원 식별자(`authorId`·회원 `id`), 이메일·loginId, 내부 상태(`deletedAt` 등), 수정 시각, 보는 사람에 종속된 값(예: FEED의 `likedByMe` — 비인증 경로에서는 계산할 수도 없고 해서도 안 된다).
  * 이를 강제하는 장치가 `PublicMemberDisplay`(`domain.member.dto`)다 — 닉네임·인증 뱃지만 갖고 회원 id를 아예 담지 않는다. **공개 응답에 `MemberDisplay`를 그대로 쓰면 안 된다**(그 레코드는 `@JsonProperty("id")`로 회원 id를 직렬화한다).
* **표시정보(닉네임·인증 뱃지)를 노출할지는 도메인이 판단한다.**
  * NOTICE는 담지 않는다 — 공지는 개인 명의가 아니라 운영 주체의 발언이다(CONSTITUTION §3).
  * PERFORMANCE·FEED는 담는다 — 누가 여는 공연이고 누가 쓴 글인지가 콘텐츠의 일부다. 단 회원 id는 위 규칙대로 나가지 않는다.
* **공개는 읽기 전용**: `/api/public/**` 아래에 쓰기(POST/PUT/DELETE) 엔드포인트를 두지 않는다.
* **쿼리 파라미터 enum은 상수명 그대로 대문자**로 받는다(`?scope=PINNED`). 소문자는 400-01 — 기존 도메인과 동일(CONTEXT 주의사항).

---

## 7. API (초안)

### 7.1 공개 (인증 불필요) — 접두사 `/api/public/notices`

* `GET /?scope=PINNED|SCHEDULED|ALL&from=&to=&page=&size=` : 목록.
  * `PINNED`: `pinned=true`, `createdAt DESC`. 홈 캐러셀용.
  * `SCHEDULED`: `scheduledAt` 이 `[from, to)` 범위, `scheduledAt ASC`. 홈 달력용. `from`/`to` 필수.
  * `ALL`(기본): 전체, `createdAt DESC`.
  * → `Page<PublicNoticeResponse>`
* `GET /{id}` : 단건. 삭제/없음이면 `NOTICE_NOT_FOUND`. → `PublicNoticeResponse`

### 7.2 어드민 (`ROLE_ADMIN`) — 접두사 `/api/admin/notices`

* `POST /` : 등록. body `{type, title, content, scheduledAt, place, pinned}`. → `NoticeResponse`
* `GET /?type=&page=&size=` : 목록(`createdAt DESC`). → `Page<NoticeResponse>`
* `GET /{id}` : 단건. → `NoticeResponse`
* `PUT /{id}` : 수정(전체 교체). body 는 등록과 동일. → `NoticeResponse`
* `DELETE /{id}` : soft delete. → 성공
* `PUT /{id}/cover` : 커버 이미지 업로드. `image/*` 멀티파트. 교체 시 옛 파일 삭제. → 갱신된 `NoticeResponse`

### 7.3 응답 DTO

* `PublicNoticeResponse`: `id, type, title, content, scheduledAt, place, coverImageUrl, createdAt`
  * 작성자 없음(§6). `coverImageUrl`은 `coverImageKey`를 `FileService.getUrl`로 변환(없으면 null).
* `NoticeResponse`(어드민): 위 필드 + `author{id, nickname, verified}`, `pinned`, `updatedAt`
  * `author`는 `MemberQueryService.findDisplaysByIds` 배치 조회로 파생(N+1 방지, PERFORMANCE·FEED와 동일 패턴).

### 7.4 홈 달력의 합성은 BFF가 한다

* 홈 달력은 **공연 + 일정**을 함께 보여주지만, 이를 합친 응답을 BE가 만들지 않는다(CONSTITUTION §3, ARCHITECTURE-CONSTITUTION §2).
* BE는 도메인별 공개 범위 조회만 제공한다:
  * `GET /api/public/notices?scope=SCHEDULED&from=&to=` (이 문서)
  * `GET /api/public/performances?scope=SCHEDULED&from=&to=` (2026-09-08 구현, PERFORMANCE-STATUTE §12)
  * 두 경로의 `scope=SCHEDULED`와 `from`/`to` 규약(`[from, to)`)은 일부러 같게 맞췄다 — BFF가 같은 모양으로 두 번 호출해 합치기만 하면 된다.
* FE의 BFF(`/api/bff/public/calendar`)가 둘을 호출해 화면용 한 벌로 합친다. 점 색·정렬·라벨 등 표시 규칙은 전적으로 FE에 둔다.

---

## 8. 커버 이미지 규칙 (확정)

* `FileService.upload(file, "notice", authorId)` 로 저장, `image/*` contentType 만 허용(아니면 `INVALID_FILE` 400-02).
* 엔티티는 `coverImageKey` 만 보관. 새 이미지 저장이 확정된 뒤에만 옛 파일을 제거한다(실패해도 이미지 유실 없음 — 프로필·포스터 이미지 패턴).

---

## 9. 에러 코드 (전역 `ErrorCode`에 추가, 도메인 전용 enum 분리는 계속 보류)

| 코드 | resultCode | HTTP | 사유 |
|---|---|---|---|
| `NOTICE_NOT_FOUND` | 404-12 | 404 | 공지 없음/삭제됨 |

* 권한 위반은 경로 단위(`/api/admin/**`)에서 Security 가 막으므로 도메인 코드가 필요 없다.
* `EVENT`인데 `scheduledAt` 누락, 잘못된 `scope` 값 등은 기존 `INVALID_INPUT_VALUE`(400-01) 재사용.
* 404-12는 현재 미사용값(404-11 CHAT_MESSAGE_NOT_FOUND 다음)으로 확정, 구현 시 최종 대조.

---

## 10. 테스트 (구현 시)

* 엔티티: 생성/전체 교체(edit)/커버 교체/pin·unpin/soft delete 마킹, `isScheduled()` 경계(null vs 값).
* 리포지토리: `scope` 별 목록(PINNED·SCHEDULED·ALL 정렬과 필터), `scheduledAt` 범위 경계(`from` 포함 / `to` 미포함), `deletedAt` 필터, 단건 미삭제 조회.
* 서비스: 등록 검증(`EVENT` + `scheduledAt` 누락 → 400-01), 수정·삭제, 삭제 대상 접근 404, 커버 업로드/교체, 어드민 목록의 작성자 표시 배치 파생.
* 컨트롤러(공개): **인증 없이 200**이 나오는지 — 이 도메인의 핵심 회귀. 그리고 **공개 응답 본문에 `authorId`·작성자·내부 필드가 없음을 명시적으로 단언**한다(§6이 코드로 지켜지는지 확인하는 유일한 방법).
* 컨트롤러(어드민): 비어드민 403, 미인증 401, CRUD 흐름, 페이징.
* SecurityConfig: `/api/public/**` permitAll 이 다른 경로의 보호를 깨지 않는지 회귀(기존 `SecurityConfigTest` 확장).

---

## 11. 구현 착수 시 확정할 것 (미결정)

* 목록 `size` 기본·최대 — 기존 도메인과 동일하게 **기본 20 / 최대 50** 을 따를 예정이나, 캐러셀은 3~5건이면 충분하므로 `PINNED` 만 별도 상한(예: 10)을 둘지 판단.
* `pinned` 개수 제한 — 캐러셀에 20건이 꽂히면 아무도 끝까지 안 본다. 등록 시 상한을 강제할지, 조회에서 상위 N건만 자를지.
* 공개 목록 응답을 `Page<T>` 로 둘지 — PageImpl 직렬화 경고와 공통 `PageResponse` DTO 도입이 이미 코드베이스 공통 BACKLOG 에 있다. 공개 API 는 외부 계약이므로 여기서 먼저 `PageResponse` 를 쓸지 검토.
* `content` 의 형식 — 순수 텍스트로 둘지, 마크다운을 허용할지. 마크다운이면 FE 렌더링과 XSS 처리 규칙이 함께 필요하다.

---

## 8. 어드민 화면 (2026-09-09 도입)

BE는 처음부터 CRUD가 있었는데 **화면이 없어 공지를 올릴 방법이 없었다.**
홈 캐러셀과 달력이 공지를 원천으로 쓰므로, 이 화면이 없으면 홈이 채워지지 않는다.

* `/admin/notices` — 목록·등록·수정·삭제. 어드민 전용(미들웨어 + 화면에서 role 재확인).
* 등록과 수정이 **같은 폼**을 쓴다. 항목이 같은데 화면이 둘이면 한쪽만 고치는 일이 생긴다.
* 빈 칸은 `null` 로 보낸다 — 빈 문자열을 그대로 보내면 "장소가 빈 문자열인 공지"가 생긴다.
* `datetime-local` 은 초를 주지 않으므로 붙여 보내고(`:00`), 되돌릴 때는 잘라 낸다.
* **일정(EVENT)인데 일시가 없으면 막는다.** `scheduledAt` 이 달력 노출의 유일한 상태라
  (§4), 일시 없는 일정은 올린 뜻이 사라진다.
* 길이 제한은 BE `NoticeRequest` 와 **같게** 유지한다. 갈리면 화면이 통과시킨 값을
  서버가 거절한다.
* 삭제는 되돌릴 수 없어 한 번 묻는다.

> 커버 이미지 업로드는 BFF 라우트(`PUT /api/bff/admin/notices/{id}/cover`)만 두고
> 화면은 아직 붙이지 않았다. 캐러셀에서 커버 없는 공지는 "이미지 없음"으로 나온다.
