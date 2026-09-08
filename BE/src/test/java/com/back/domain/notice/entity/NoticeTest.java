package com.back.domain.notice.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class NoticeTest {

    private Notice notice(LocalDateTime scheduledAt) {
        return Notice.create(1L, NoticeType.NOTICE, "제목", "본문", scheduledAt, null, false);
    }

    @Test
    void 생성하면_전달한_값을_그대로_갖는다() {
        LocalDateTime when = LocalDateTime.of(2026, 9, 16, 10, 0);
        Notice notice = Notice.create(7L, NoticeType.EVENT, "심사 결과 발표", "본문", when, "온라인", true);

        assertThat(notice.getAuthorId()).isEqualTo(7L);
        assertThat(notice.getType()).isEqualTo(NoticeType.EVENT);
        assertThat(notice.getTitle()).isEqualTo("심사 결과 발표");
        assertThat(notice.getScheduledAt()).isEqualTo(when);
        assertThat(notice.getPlace()).isEqualTo("온라인");
        assertThat(notice.isPinned()).isTrue();
        assertThat(notice.getCoverImageKey()).isNull();
        assertThat(notice.isDeleted()).isFalse();
    }

    @Test
    void 달력_노출은_scheduledAt의_유무로만_결정된다() {
        assertThat(notice(null).isScheduled()).isFalse();
        assertThat(notice(LocalDateTime.now()).isScheduled()).isTrue();
    }

    @Test
    void 일정이_아닌_종류도_날짜가_있으면_달력에_뜬다() {
        // type은 표시 분류일 뿐 달력 노출을 가르지 않는다(STATUTE §5).
        Notice announcement = Notice.create(1L, NoticeType.NOTICE, "제목", "본문",
                LocalDateTime.now(), null, false);
        assertThat(announcement.isScheduled()).isTrue();
    }

    @Test
    void edit는_본문필드만_교체하고_작성자와_커버는_보존한다() {
        Notice notice = notice(null);
        notice.changeCover("old-key");

        LocalDateTime when = LocalDateTime.of(2026, 10, 1, 9, 0);
        notice.edit(NoticeType.EVENT, "새 제목", "새 본문", when, "새 장소", true);

        assertThat(notice.getType()).isEqualTo(NoticeType.EVENT);
        assertThat(notice.getTitle()).isEqualTo("새 제목");
        assertThat(notice.getContent()).isEqualTo("새 본문");
        assertThat(notice.getScheduledAt()).isEqualTo(when);
        assertThat(notice.getPlace()).isEqualTo("새 장소");
        assertThat(notice.isPinned()).isTrue();
        assertThat(notice.getAuthorId()).isEqualTo(1L);
        assertThat(notice.getCoverImageKey()).isEqualTo("old-key");
    }

    @Test
    void 날짜를_비우는_수정으로_달력에서_내릴_수_있다() {
        Notice notice = notice(LocalDateTime.now());
        notice.edit(NoticeType.NOTICE, "제목", "본문", null, null, false);
        assertThat(notice.isScheduled()).isFalse();
    }

    @Test
    void pin과_unpin은_캐러셀_노출만_바꾼다() {
        Notice notice = notice(LocalDateTime.now());
        notice.pin();
        assertThat(notice.isPinned()).isTrue();
        assertThat(notice.isScheduled()).isTrue(); // 달력과는 독립된 축

        notice.unpin();
        assertThat(notice.isPinned()).isFalse();
        assertThat(notice.isScheduled()).isTrue();
    }

    @Test
    void changeCover는_키를_교체한다() {
        Notice notice = notice(null);
        notice.changeCover("a");
        notice.changeCover("b");
        assertThat(notice.getCoverImageKey()).isEqualTo("b");
    }

    @Test
    void delete는_deletedAt을_마킹한다() {
        Notice notice = notice(null);
        assertThat(notice.isDeleted()).isFalse();

        notice.delete();

        assertThat(notice.isDeleted()).isTrue();
        assertThat(notice.getDeletedAt()).isNotNull();
    }
}
