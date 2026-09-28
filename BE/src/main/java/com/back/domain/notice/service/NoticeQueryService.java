package com.back.domain.notice.service;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.domain.notice.dto.NoticeResponse;
import com.back.domain.notice.dto.NoticeScope;
import com.back.domain.notice.dto.PublicNoticeResponse;
import com.back.domain.notice.entity.Notice;
import com.back.domain.notice.entity.NoticeType;
import com.back.domain.notice.repository.NoticeRepository;
import com.back.global.common.PageResponse;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 공지의 공개·관리자 조회만 담당한다. */
@Service
@RequiredArgsConstructor
public class NoticeQueryService {

    private final NoticeRepository noticeRepository;
    private final MemberQueryService memberQueryService;
    private final NoticeResponseAssembler responseAssembler;

    @Transactional(readOnly = true)
    public NoticeResponse getAdminNotice(Long id) {
        return responseAssembler.toAdminResponse(findActive(id));
    }

    @Transactional(readOnly = true)
    public PageResponse<NoticeResponse> getAdminNotices(NoticeType type, Pageable pageable) {
        Page<Notice> page = type == null
                ? noticeRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable)
                : noticeRepository.findByDeletedAtIsNullAndTypeOrderByCreatedAtDesc(type, pageable);
        Set<Long> authorIds = page.getContent().stream()
                .map(Notice::getAuthorId).collect(Collectors.toSet());
        Map<Long, MemberDisplay> authors = memberQueryService.findDisplaysByIds(authorIds);
        return PageResponse.from(page.map(notice -> responseAssembler.toAdminResponse(notice, authors)));
    }

    @Transactional(readOnly = true)
    public PublicNoticeResponse getPublicNotice(Long id) {
        return responseAssembler.toPublicResponse(findActive(id));
    }

    @Transactional(readOnly = true)
    public PageResponse<PublicNoticeResponse> getPublicNotices(NoticeScope scope,
            LocalDateTime from, LocalDateTime to, Pageable pageable) {
        Page<Notice> page = switch (scope) {
            case PINNED -> noticeRepository.findByDeletedAtIsNullAndPinnedTrueOrderByCreatedAtDesc(pageable);
            case SCHEDULED -> scheduledNotices(from, to, pageable);
            case ALL -> noticeRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable);
        };
        return PageResponse.from(page.map(responseAssembler::toPublicResponse));
    }

    private Page<Notice> scheduledNotices(LocalDateTime from, LocalDateTime to, Pageable pageable) {
        if (from == null || to == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE,
                    "달력 조회에는 from과 to가 모두 필요합니다.");
        }
        return noticeRepository
                .findByDeletedAtIsNullAndScheduledAtGreaterThanEqualAndScheduledAtLessThanOrderByScheduledAtAsc(
                        from, to, pageable);
    }

    private Notice findActive(Long id) {
        return noticeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOTICE_NOT_FOUND));
    }
}
