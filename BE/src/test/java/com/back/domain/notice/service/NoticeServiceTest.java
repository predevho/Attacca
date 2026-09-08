package com.back.domain.notice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.domain.member.service.MemberQueryService;
import com.back.domain.notice.dto.NoticeRequest;
import com.back.domain.notice.dto.NoticeResponse;
import com.back.domain.notice.dto.NoticeScope;
import com.back.domain.notice.dto.PublicNoticeResponse;
import com.back.domain.notice.entity.NoticeType;
import com.back.domain.notice.repository.NoticeRepository;
import com.back.domain.verifiedperformer.repository.VerificationApplicationRepository;
import com.back.domain.verifiedperformer.service.VerifiedPerformerService;
import com.back.global.common.PageResponse;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.storage.FileMetadataRepository;
import com.back.global.storage.FileService;
import com.back.global.storage.FileStorage;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.mock.web.MockMultipartFile;

@DataJpaTest
class NoticeServiceTest {

    @Autowired NoticeRepository noticeRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired VerificationApplicationRepository verificationApplicationRepository;
    @Autowired FileMetadataRepository fileMetadataRepository;

    private NoticeService service;
    private FakeFileStorage storage;
    private Long adminId;

    @BeforeEach
    void setUp() {
        VerifiedPerformerService verifiedPerformerService =
                new VerifiedPerformerService(verificationApplicationRepository);
        MemberQueryService memberQueryService =
                new MemberQueryService(memberRepository, verifiedPerformerService);
        storage = new FakeFileStorage();
        FileService fileService = new FileService(storage, fileMetadataRepository);
        service = new NoticeService(noticeRepository, memberQueryService, fileService);

        Member admin = memberRepository.save(
                Member.createLocal("admin", "pw", "admin@x.com", "운영자"));
        adminId = admin.getId();
    }

    private NoticeRequest request(NoticeType type, String title, LocalDateTime scheduledAt,
            boolean pinned) {
        return new NoticeRequest(type, title, "본문", scheduledAt, null, pinned);
    }

    private ErrorCode errorOf(Throwable t) {
        return ((BusinessException) t).getErrorCode();
    }

    private PageRequest page() {
        return PageRequest.of(0, 10);
    }

    @Test
    void 등록하면_어드민_응답에_작성자가_실린다() {
        NoticeResponse response = service.register(adminId,
                request(NoticeType.NOTICE, "점검 안내", null, false));

        assertThat(response.title()).isEqualTo("점검 안내");
        assertThat(response.author().nickname()).isEqualTo("운영자");
        assertThat(response.coverImageUrl()).isNull();
    }

    @Test
    void 일정인데_날짜가_없으면_400_01() {
        assertThatThrownBy(() -> service.register(adminId,
                request(NoticeType.EVENT, "일정", null, false)))
                .isInstanceOf(BusinessException.class)
                .satisfies(t -> assertThat(errorOf(t)).isEqualTo(ErrorCode.INVALID_INPUT_VALUE));
    }

    @Test
    void 공지는_날짜가_없어도_등록된다() {
        NoticeResponse response = service.register(adminId,
                request(NoticeType.NOTICE, "공지", null, false));
        assertThat(response.scheduledAt()).isNull();
    }

    @Test
    void 수정에도_일정_날짜_규칙이_적용된다() {
        Long id = service.register(adminId, request(NoticeType.NOTICE, "공지", null, false)).id();

        assertThatThrownBy(() -> service.editNotice(id, request(NoticeType.EVENT, "일정", null, false)))
                .isInstanceOf(BusinessException.class)
                .satisfies(t -> assertThat(errorOf(t)).isEqualTo(ErrorCode.INVALID_INPUT_VALUE));
    }

    @Test
    void 다른_어드민도_수정하고_삭제할_수_있다() {
        // 운영 주체의 글이라 소유자 판정을 두지 않는다(STATUTE §3).
        Long id = service.register(adminId, request(NoticeType.NOTICE, "공지", null, false)).id();

        NoticeResponse edited = service.editNotice(id,
                request(NoticeType.NOTICE, "고친 공지", null, true));
        assertThat(edited.title()).isEqualTo("고친 공지");
        assertThat(edited.pinned()).isTrue();

        service.deleteNotice(id);
        assertThatThrownBy(() -> service.getAdminNotice(id))
                .satisfies(t -> assertThat(errorOf(t)).isEqualTo(ErrorCode.NOTICE_NOT_FOUND));
    }

    @Test
    void 없거나_삭제된_공지_조회는_NOTICE_NOT_FOUND() {
        assertThatThrownBy(() -> service.getPublicNotice(9999L))
                .isInstanceOf(BusinessException.class)
                .satisfies(t -> assertThat(errorOf(t)).isEqualTo(ErrorCode.NOTICE_NOT_FOUND));
    }

    @Test
    void 공개_응답에는_작성자가_담기지_않는다() {
        Long id = service.register(adminId, request(NoticeType.NOTICE, "공지", null, false)).id();

        PublicNoticeResponse response = service.getPublicNotice(id);

        // 공개 DTO는 작성자 필드 자체를 갖지 않는다 — 회원 식별자가 공개 경로로 나가지 않는다는 뜻이다.
        assertThat(response.title()).isEqualTo("공지");
        assertThat(PublicNoticeResponse.class.getRecordComponents())
                .extracting(java.lang.reflect.RecordComponent::getName)
                .doesNotContain("author", "authorId");
    }

    @Test
    void PINNED_범위는_고정된_것만_준다() {
        service.register(adminId, request(NoticeType.NOTICE, "고정", null, true));
        service.register(adminId, request(NoticeType.NOTICE, "보통", null, false));

        PageResponse<PublicNoticeResponse> pinned =
                service.getPublicNotices(NoticeScope.PINNED, null, null, page());

        assertThat(pinned.content()).extracting(PublicNoticeResponse::title)
                .containsExactly("고정");
    }

    @Test
    void SCHEDULED_범위는_날짜가_있는_것만_이른순으로_준다() {
        LocalDateTime from = LocalDateTime.of(2026, 9, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 10, 1, 0, 0);
        service.register(adminId,
                request(NoticeType.EVENT, "중순", LocalDateTime.of(2026, 9, 16, 10, 0), false));
        service.register(adminId,
                request(NoticeType.EVENT, "초순", LocalDateTime.of(2026, 9, 2, 10, 0), false));
        service.register(adminId, request(NoticeType.NOTICE, "날짜없음", null, false));

        PageResponse<PublicNoticeResponse> scheduled =
                service.getPublicNotices(NoticeScope.SCHEDULED, from, to, page());

        assertThat(scheduled.content()).extracting(PublicNoticeResponse::title)
                .containsExactly("초순", "중순");
    }

    @Test
    void SCHEDULED인데_from이나_to가_없으면_400_01() {
        assertThatThrownBy(() ->
                service.getPublicNotices(NoticeScope.SCHEDULED, LocalDateTime.now(), null, page()))
                .isInstanceOf(BusinessException.class)
                .satisfies(t -> assertThat(errorOf(t)).isEqualTo(ErrorCode.INVALID_INPUT_VALUE));
    }

    @Test
    void 어드민_목록은_종류로_거를_수_있고_작성자를_담는다() {
        service.register(adminId,
                request(NoticeType.EVENT, "일정", LocalDateTime.now().plusDays(1), false));
        service.register(adminId, request(NoticeType.NOTICE, "공지", null, false));

        PageResponse<NoticeResponse> events =
                service.getAdminNotices(NoticeType.EVENT, page());

        assertThat(events.content()).extracting(NoticeResponse::title).containsExactly("일정");
        assertThat(events.content().get(0).author().nickname()).isEqualTo("운영자");
        assertThat(events.totalElements()).isEqualTo(1);
    }

    @Test
    void 커버_이미지를_올리면_URL이_생기고_교체하면_옛파일이_지워진다() {
        Long id = service.register(adminId, request(NoticeType.NOTICE, "공지", null, false)).id();

        NoticeResponse first = service.updateCover(adminId, id, image("a.png"));
        assertThat(first.coverImageUrl()).isNotNull();
        assertThat(storage.stored).hasSize(1);

        NoticeResponse second = service.updateCover(adminId, id, image("b.png"));
        assertThat(second.coverImageUrl()).isNotEqualTo(first.coverImageUrl());
        assertThat(storage.stored).hasSize(1); // 옛 파일 제거됨
    }

    @Test
    void 이미지가_아니면_INVALID_FILE() {
        Long id = service.register(adminId, request(NoticeType.NOTICE, "공지", null, false)).id();
        MockMultipartFile text = new MockMultipartFile("file", "a.txt", "text/plain",
                "hi".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> service.updateCover(adminId, id, text))
                .isInstanceOf(BusinessException.class)
                .satisfies(t -> assertThat(errorOf(t)).isEqualTo(ErrorCode.INVALID_FILE));
    }

    private MockMultipartFile image(String name) {
        return new MockMultipartFile("file", name, "image/png",
                name.getBytes(StandardCharsets.UTF_8));
    }

    static class FakeFileStorage implements FileStorage {
        final Map<String, byte[]> stored = new HashMap<>();

        @Override
        public String upload(String key, InputStream content, long size, String contentType) {
            try {
                stored.put(key, content.readAllBytes());
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
            return key;
        }

        @Override
        public void delete(String key) {
            stored.remove(key);
        }

        @Override
        public String getUrl(String key) {
            return "http://fake/" + key;
        }
    }
}
