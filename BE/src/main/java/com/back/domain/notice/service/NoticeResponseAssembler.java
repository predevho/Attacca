package com.back.domain.notice.service;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.domain.notice.dto.NoticeResponse;
import com.back.domain.notice.dto.PublicNoticeResponse;
import com.back.domain.notice.entity.Notice;
import com.back.global.storage.FileService;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class NoticeResponseAssembler {

    private final MemberQueryService memberQueryService;
    private final FileService fileService;

    NoticeResponse toAdminResponse(Notice notice) {
        MemberDisplay author = memberQueryService.findDisplaysByIds(Set.of(notice.getAuthorId()))
                .get(notice.getAuthorId());
        return toAdminResponse(notice, author);
    }

    NoticeResponse toAdminResponse(Notice notice, Map<Long, MemberDisplay> authors) {
        return toAdminResponse(notice, authors.get(notice.getAuthorId()));
    }

    PublicNoticeResponse toPublicResponse(Notice notice) {
        return new PublicNoticeResponse(notice.getId(), notice.getType(), notice.getTitle(),
                notice.getContent(), notice.getScheduledAt(), notice.getPlace(), coverUrl(notice),
                notice.getSourceName(), notice.getSourceUrl(), notice.getCreatedAt());
    }

    private NoticeResponse toAdminResponse(Notice notice, MemberDisplay author) {
        return new NoticeResponse(notice.getId(), author, notice.getType(), notice.getTitle(),
                notice.getContent(), notice.getScheduledAt(), notice.getPlace(), notice.isPinned(),
                coverUrl(notice), notice.getSourceName(), notice.getSourceUrl(), notice.getCreatedAt(),
                notice.getUpdatedAt());
    }

    private String coverUrl(Notice notice) {
        return notice.getCoverImageKey() == null ? null : fileService.getUrl(notice.getCoverImageKey());
    }
}
