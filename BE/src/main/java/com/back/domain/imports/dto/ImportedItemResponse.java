package com.back.domain.imports.dto;

import com.back.domain.imports.entity.ImportedItem;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record ImportedItemResponse(Long id, String source, String sourceKey, String sourceName,
        String sourceUrl, String title, LocalDate startsAt, LocalDate endsAt, LocalDate postedAt,
        String place, String summary, String posterUrl, String status, Long noticeId,
        LocalDateTime lastSeenAt, LocalDateTime createdAt) {
    public static ImportedItemResponse from(ImportedItem item) {
        return new ImportedItemResponse(item.getId(), item.getSource().name(), item.getSourceKey(),
                item.getSourceName(), item.getSourceUrl(), item.getTitle(), item.getStartsAt(),
                item.getEndsAt(), item.getPostedAt(), item.getPlace(), item.getSummary(),
                item.getPosterUrl(), item.getStatus().name(), item.getNoticeId(), item.getLastSeenAt(),
                item.getCreatedAt());
    }
}
