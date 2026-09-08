package com.back.domain.notice.service;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.domain.notice.dto.NoticeRequest;
import com.back.domain.notice.dto.NoticeResponse;
import com.back.domain.notice.dto.NoticeScope;
import com.back.domain.notice.dto.PublicNoticeResponse;
import com.back.domain.notice.entity.Notice;
import com.back.domain.notice.entity.NoticeType;
import com.back.domain.notice.repository.NoticeRepository;
import com.back.global.common.PageResponse;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.storage.FileService;
import com.back.global.storage.StoredFile;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 공지·소식·운영 일정의 등록/조회/수정/삭제.
 *
 * <p>작성 권한(ROLE_ADMIN)은 경로(`/api/admin/**`)에서 Security가 막으므로 여기서 다시 판정하지 않는다.
 * 소유자 판정도 두지 않는다 — 운영 주체의 글이라 다른 어드민이 이어서 고칠 수 있어야 한다(STATUTE §3).
 */
@Service
@RequiredArgsConstructor
public class NoticeService {

    private static final String COVER_DIRECTORY = "notice";

    private final NoticeRepository noticeRepository;
    private final MemberQueryService memberQueryService;
    private final FileService fileService;

    @Transactional
    public NoticeResponse register(Long authorId, NoticeRequest request) {
        validateSchedule(request);
        Notice saved = noticeRepository.save(Notice.create(authorId, request.type(),
                request.title(), request.content(), request.scheduledAt(), request.place(),
                request.pinned()));
        return toAdminResponse(saved);
    }

    @Transactional
    public NoticeResponse editNotice(Long id, NoticeRequest request) {
        validateSchedule(request);
        Notice notice = findActive(id);
        notice.edit(request.type(), request.title(), request.content(), request.scheduledAt(),
                request.place(), request.pinned());
        return toAdminResponse(notice);
    }

    @Transactional
    public void deleteNotice(Long id) {
        findActive(id).delete();
    }

    @Transactional
    public NoticeResponse updateCover(Long adminId, Long id, MultipartFile file) {
        validateImage(file);
        Notice notice = findActive(id);
        String oldKey = notice.getCoverImageKey();
        StoredFile stored = fileService.upload(file, COVER_DIRECTORY, adminId);
        notice.changeCover(stored.storageKey());
        // 새 이미지 저장이 확정된 뒤에만 옛 파일을 제거한다 — 실패해도 이미지 유실 없음(포스터·프로필 패턴).
        if (oldKey != null) {
            fileService.delete(oldKey);
        }
        return toAdminResponse(notice);
    }

    @Transactional(readOnly = true)
    public NoticeResponse getAdminNotice(Long id) {
        return toAdminResponse(findActive(id));
    }

    @Transactional(readOnly = true)
    public PageResponse<NoticeResponse> getAdminNotices(NoticeType type, Pageable pageable) {
        Page<Notice> page = type == null
                ? noticeRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable)
                : noticeRepository.findByDeletedAtIsNullAndTypeOrderByCreatedAtDesc(type, pageable);
        Set<Long> authorIds = page.getContent().stream()
                .map(Notice::getAuthorId).collect(Collectors.toSet());
        Map<Long, MemberDisplay> authors = memberQueryService.findDisplaysByIds(authorIds);
        return PageResponse.from(page.map(n -> toAdminResponse(n, authors.get(n.getAuthorId()))));
    }

    // --- 공개 조회 (비인증) ---

    @Transactional(readOnly = true)
    public PublicNoticeResponse getPublicNotice(Long id) {
        return toPublicResponse(findActive(id));
    }

    @Transactional(readOnly = true)
    public PageResponse<PublicNoticeResponse> getPublicNotices(NoticeScope scope,
            LocalDateTime from, LocalDateTime to, Pageable pageable) {
        Page<Notice> page = switch (scope) {
            case PINNED -> noticeRepository
                    .findByDeletedAtIsNullAndPinnedTrueOrderByCreatedAtDesc(pageable);
            case SCHEDULED -> {
                if (from == null || to == null) {
                    throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE,
                            "달력 조회에는 from과 to가 모두 필요합니다.");
                }
                yield noticeRepository
                        .findByDeletedAtIsNullAndScheduledAtGreaterThanEqualAndScheduledAtLessThanOrderByScheduledAtAsc(
                                from, to, pageable);
            }
            case ALL -> noticeRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable);
        };
        return PageResponse.from(page.map(this::toPublicResponse));
    }

    // --- 내부 ---

    /** EVENT는 날짜가 없으면 일정으로서 의미가 없다. 필드 간 관계라 Bean Validation으로 표현 못 한다. */
    private void validateSchedule(NoticeRequest request) {
        if (request.type() == NoticeType.EVENT && request.scheduledAt() == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE,
                    "일정에는 날짜가 필요합니다.");
        }
    }

    /** 이미지 타입만 허용. 크기 상한은 전역 multipart 설정이 담당. */
    private void validateImage(MultipartFile file) {
        if (file == null || file.getContentType() == null
                || !file.getContentType().startsWith("image/")) {
            throw new BusinessException(ErrorCode.INVALID_FILE, "이미지 파일만 업로드할 수 있습니다.");
        }
    }

    private Notice findActive(Long id) {
        return noticeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOTICE_NOT_FOUND));
    }

    private String coverUrl(Notice notice) {
        return notice.getCoverImageKey() == null
                ? null
                : fileService.getUrl(notice.getCoverImageKey());
    }

    private NoticeResponse toAdminResponse(Notice notice) {
        MemberDisplay author = memberQueryService
                .findDisplaysByIds(Set.of(notice.getAuthorId()))
                .get(notice.getAuthorId());
        return toAdminResponse(notice, author);
    }

    private NoticeResponse toAdminResponse(Notice n, MemberDisplay author) {
        return new NoticeResponse(n.getId(), author, n.getType(), n.getTitle(), n.getContent(),
                n.getScheduledAt(), n.getPlace(), n.isPinned(), coverUrl(n), n.getCreatedAt(),
                n.getUpdatedAt());
    }

    private PublicNoticeResponse toPublicResponse(Notice n) {
        return new PublicNoticeResponse(n.getId(), n.getType(), n.getTitle(), n.getContent(),
                n.getScheduledAt(), n.getPlace(), coverUrl(n), n.getCreatedAt());
    }
}
