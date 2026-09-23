package com.back.global.storage;

import java.time.Duration;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 게시글에 귀속되지 않은 임시 첨부 파일의 보관·정리 설정이다. */
@ConfigurationProperties(prefix = "storage.temporary-cleanup")
public record TemporaryAttachmentCleanupProperties(String cron, Duration retention, String zone) {

    public TemporaryAttachmentCleanupProperties {
        if (cron == null || cron.isBlank() || retention == null || retention.isNegative()
                || retention.isZero() || zone == null || zone.isBlank()) {
            throw new IllegalArgumentException("임시 첨부 정리 설정이 올바르지 않습니다.");
        }
        ZoneId.of(zone);
    }
}
