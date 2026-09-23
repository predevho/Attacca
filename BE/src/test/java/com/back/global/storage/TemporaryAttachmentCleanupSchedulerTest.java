package com.back.global.storage;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class TemporaryAttachmentCleanupSchedulerTest {

    @Test
    void 보관기간보다_오래된_임시_첨부_정리를_호출한다() {
        FileService fileService = mock(FileService.class);
        Clock clock = Clock.fixed(Instant.parse("2026-09-22T03:15:00Z"), ZoneId.of("Asia/Seoul"));
        TemporaryAttachmentCleanupProperties properties = new TemporaryAttachmentCleanupProperties(
                "0 15 * * * *", Duration.ofHours(24), "Asia/Seoul");
        TemporaryAttachmentCleanupScheduler scheduler =
                new TemporaryAttachmentCleanupScheduler(fileService, properties, clock);

        scheduler.cleanExpiredTemporaryFiles();

        verify(fileService).deleteExpiredTemporaryFiles(LocalDateTime.of(2026, 9, 21, 12, 15));
    }
}
