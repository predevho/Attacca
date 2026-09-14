package com.back.domain.imports.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class ImportedItemTest {

    private static final LocalDateTime FIRST_SEEN_AT = LocalDateTime.of(2026, 9, 13, 10, 0);

    @Test
    void newItem은_NEW_항목을_만든다() {
        ImportedItem item = newItem();

        assertThat(item.getSource()).isEqualTo(ImportSource.KOPIS);
        assertThat(item.getSourceKey()).isEqualTo("PF-1");
        assertThat(item.getSourceName()).isEqualTo("KOPIS");
        assertThat(item.getSourceUrl()).isEqualTo("https://example.com/PF-1");
        assertThat(item.getTitle()).isEqualTo("공연 제목");
        assertThat(item.getStartsAt()).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(item.getEndsAt()).isEqualTo(LocalDate.of(2026, 10, 2));
        assertThat(item.getPostedAt()).isNull();
        assertThat(item.getPlace()).isEqualTo("예술의전당");
        assertThat(item.getSummary()).isEqualTo("공연 요약");
        assertThat(item.getPosterUrl()).isEqualTo("https://example.com/poster.jpg");
        assertThat(item.getStatus()).isEqualTo(ImportStatus.NEW);
        assertThat(item.getNoticeId()).isNull();
        assertThat(item.getLastSeenAt()).isEqualTo(FIRST_SEEN_AT);
    }

    @Test
    void approve는_NEW를_APPROVED로_바꾸고_noticeId를_기록한다() {
        ImportedItem item = newItem();

        item.approve(41L);

        assertThat(item.getStatus()).isEqualTo(ImportStatus.APPROVED);
        assertThat(item.getNoticeId()).isEqualTo(41L);
    }

    @Test
    void approve는_유효한_noticeId가_없으면_거절한다() {
        ImportedItem item = newItem();

        assertThatThrownBy(() -> item.approve(0L))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(item.getStatus()).isEqualTo(ImportStatus.NEW);
        assertThat(item.getNoticeId()).isNull();
    }

    @Test
    void reject는_NEW를_REJECTED로_바꾼다() {
        ImportedItem item = newItem();

        item.reject();

        assertThat(item.getStatus()).isEqualTo(ImportStatus.REJECTED);
        assertThat(item.getNoticeId()).isNull();
    }

    @Test
    void 종결된_항목은_다시_처리할_수_없다() {
        ImportedItem approved = newItem();
        approved.approve(41L);
        ImportedItem rejected = newItem();
        rejected.reject();

        assertAlreadyHandled(() -> approved.reject());
        assertAlreadyHandled(() -> rejected.approve(42L));
    }

    @Test
    void 종결된_항목을_approve하면_noticeId보다_처리_완료를_먼저_거절한다() {
        ImportedItem approved = newItem();
        approved.approve(41L);
        ImportedItem rejected = newItem();
        rejected.reject();

        assertAlreadyHandled(() -> approved.approve(0L));
        assertAlreadyHandled(() -> rejected.approve(0L));
    }

    @Test
    void seenAt은_확인_시각만_바꾸고_처리_상태를_보존한다() {
        ImportedItem item = newItem();
        item.reject();
        LocalDateTime seenAgainAt = FIRST_SEEN_AT.plusDays(1);

        item.seenAt(seenAgainAt);

        assertThat(item.getLastSeenAt()).isEqualTo(seenAgainAt);
        assertThat(item.getStatus()).isEqualTo(ImportStatus.REJECTED);
        assertThat(item.getNoticeId()).isNull();
    }

    @Test
    void seenAt은_null을_거절한다() {
        ImportedItem item = newItem();

        assertThatThrownBy(() -> item.seenAt(null))
                .isInstanceOf(NullPointerException.class);
        assertThat(item.getLastSeenAt()).isEqualTo(FIRST_SEEN_AT);
    }

    private void assertAlreadyHandled(Runnable transition) {
        assertThatThrownBy(transition::run)
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getErrorCode())
                .isEqualTo(ErrorCode.IMPORT_ITEM_ALREADY_HANDLED);
    }

    private ImportedItem newItem() {
        return ImportedItem.newItem(
                ImportSource.KOPIS,
                "PF-1",
                "KOPIS",
                "https://example.com/PF-1",
                "공연 제목",
                LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 10, 2),
                null,
                "예술의전당",
                "공연 요약",
                "https://example.com/poster.jpg",
                FIRST_SEEN_AT);
    }
}
