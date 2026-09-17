package com.back.domain.imports.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.imports.collector.CollectedItem;
import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.entity.ImportStatus;
import com.back.domain.imports.entity.ImportedItem;
import com.back.domain.imports.repository.ImportedItemRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

@DataJpaTest
class ImportIngestionServiceTest {

    @Autowired
    private ImportedItemRepository repository;

    private ImportIngestionService service;

    @BeforeEach
    void setUp() {
        service = new ImportIngestionService(repository);
    }

    @Test
    void 같은_원천_키는_새로_저장하지_않고_lastSeenAt만_갱신한다() {
        LocalDateTime firstSeenAt = LocalDateTime.of(2026, 9, 13, 10, 0);
        LocalDateTime seenAgainAt = LocalDateTime.of(2026, 9, 14, 11, 0);
        repository.save(item("PF-1", "기존 제목", firstSeenAt));

        int newCount = service.save(ImportSource.KOPIS,
                List.of(collected("PF-1", "새 제목")), seenAgainAt);

        ImportedItem saved = repository.findBySourceAndSourceKey(ImportSource.KOPIS, "PF-1")
                .orElseThrow();
        assertThat(newCount).isZero();
        assertThat(repository.count()).isEqualTo(1);
        assertThat(saved.getLastSeenAt()).isEqualTo(seenAgainAt);
        assertThat(saved.getTitle()).isEqualTo("기존 제목");
    }

    @Test
    void 신규_키만_저장_수에_포함한다() {
        LocalDateTime seenAt = LocalDateTime.of(2026, 9, 14, 11, 0);
        repository.save(item("PF-1", "기존 제목", seenAt.minusDays(1)));

        int newCount = service.save(ImportSource.KOPIS,
                List.of(collected("PF-1", "기존"), collected("PF-2", "신규")), seenAt);

        assertThat(newCount).isEqualTo(1);
        assertThat(repository.count()).isEqualTo(2);
        assertThat(repository.findBySourceAndSourceKey(ImportSource.KOPIS, "PF-2"))
                .get()
                .extracting(ImportedItem::getStatus, ImportedItem::getLastSeenAt)
                .containsExactly(ImportStatus.NEW, seenAt);
    }

    @Test
    void 승인_거절된_중복_항목은_상태를_보존하고_lastSeenAt만_갱신한다() {
        LocalDateTime seenAgainAt = LocalDateTime.of(2026, 9, 14, 11, 0);
        ImportedItem approved = item("PF-1", "승인", seenAgainAt.minusDays(1));
        approved.approve(41L);
        repository.save(approved);
        ImportedItem rejected = item("PF-2", "거절", seenAgainAt.minusDays(1));
        rejected.reject();
        repository.save(rejected);

        int newCount = service.save(ImportSource.KOPIS,
                List.of(collected("PF-1", "승인 재수집"), collected("PF-2", "거절 재수집")),
                seenAgainAt);

        assertThat(newCount).isZero();
        assertThat(repository.findBySourceAndSourceKey(ImportSource.KOPIS, "PF-1"))
                .get()
                .extracting(ImportedItem::getStatus, ImportedItem::getNoticeId,
                        ImportedItem::getLastSeenAt)
                .containsExactly(ImportStatus.APPROVED, 41L, seenAgainAt);
        assertThat(repository.findBySourceAndSourceKey(ImportSource.KOPIS, "PF-2"))
                .get()
                .extracting(ImportedItem::getStatus, ImportedItem::getNoticeId,
                        ImportedItem::getLastSeenAt)
                .containsExactly(ImportStatus.REJECTED, null, seenAgainAt);
    }

    private ImportedItem item(String sourceKey, String title, LocalDateTime lastSeenAt) {
        return ImportedItem.newItem(ImportSource.KOPIS, sourceKey, "KOPIS",
                "https://example.com/" + sourceKey, title,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2), null,
                "장소", "요약", "https://example.com/poster.jpg", lastSeenAt);
    }

    private CollectedItem collected(String sourceKey, String title) {
        return new CollectedItem(sourceKey, "KOPIS", "https://example.com/" + sourceKey, title,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2), null,
                "장소", "요약", "https://example.com/poster.jpg");
    }
}
