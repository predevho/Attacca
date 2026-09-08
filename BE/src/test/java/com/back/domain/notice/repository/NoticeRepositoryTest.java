package com.back.domain.notice.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.notice.entity.Notice;
import com.back.domain.notice.entity.NoticeType;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

@DataJpaTest
class NoticeRepositoryTest {

    @Autowired
    private NoticeRepository repository;

    private Notice notice(String title, LocalDateTime scheduledAt, boolean pinned) {
        return Notice.create(1L, NoticeType.NOTICE, title, "본문", scheduledAt, null, pinned);
    }

    private PageRequest page() {
        return PageRequest.of(0, 10);
    }

    @Test
    void 미삭제_단건만_조회된다() {
        Notice saved = repository.save(notice("A", null, false));
        assertThat(repository.findByIdAndDeletedAtIsNull(saved.getId())).isPresent();

        saved.delete();
        repository.saveAndFlush(saved);
        assertThat(repository.findByIdAndDeletedAtIsNull(saved.getId())).isEmpty();
    }

    @Test
    void pinned만_캐러셀_목록에_들어온다() {
        Notice pinnedA = repository.save(notice("고정A", null, true));
        Notice pinnedB = repository.save(notice("고정B", null, true));
        repository.save(notice("보통", null, false));

        List<Notice> pinned = repository
                .findByDeletedAtIsNullAndPinnedTrueOrderByCreatedAtDesc(page()).getContent();

        // 같은 밀리초에 저장되면 createdAt 동률로 순서가 흔들릴 수 있어 구성만 단언한다.
        assertThat(pinned).extracting(Notice::getId)
                .containsExactlyInAnyOrder(pinnedA.getId(), pinnedB.getId());
    }

    @Test
    void 삭제된_공지는_캐러셀_목록에서_빠진다() {
        Notice alive = repository.save(notice("살아있음", null, true));
        Notice removed = repository.save(notice("삭제됨", null, true));
        removed.delete();
        repository.saveAndFlush(removed);

        List<Notice> pinned = repository
                .findByDeletedAtIsNullAndPinnedTrueOrderByCreatedAtDesc(page()).getContent();

        assertThat(pinned).extracting(Notice::getId).containsExactly(alive.getId());
    }

    @Test
    void 달력_조회는_범위_안의_일정만_이른순으로_준다() {
        LocalDateTime from = LocalDateTime.of(2026, 9, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 10, 1, 0, 0);
        repository.save(notice("전달", LocalDateTime.of(2026, 8, 31, 23, 59), false));
        Notice mid = repository.save(notice("중순", LocalDateTime.of(2026, 9, 16, 10, 0), false));
        Notice early = repository.save(notice("초순", LocalDateTime.of(2026, 9, 2, 10, 0), false));
        repository.save(notice("다음달", LocalDateTime.of(2026, 10, 1, 0, 0), false));
        repository.save(notice("날짜없음", null, false));

        List<Notice> scheduled = repository
                .findByDeletedAtIsNullAndScheduledAtGreaterThanEqualAndScheduledAtLessThanOrderByScheduledAtAsc(
                        from, to, page())
                .getContent();

        assertThat(scheduled).extracting(Notice::getId)
                .containsExactly(early.getId(), mid.getId());
    }

    @Test
    void 달력_범위는_from_포함이고_to_미포함이다() {
        LocalDateTime from = LocalDateTime.of(2026, 9, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 10, 1, 0, 0);
        Notice onFrom = repository.save(notice("경계-시작", from, false));
        repository.save(notice("경계-끝", to, false));

        List<Notice> scheduled = repository
                .findByDeletedAtIsNullAndScheduledAtGreaterThanEqualAndScheduledAtLessThanOrderByScheduledAtAsc(
                        from, to, page())
                .getContent();

        assertThat(scheduled).extracting(Notice::getId).containsExactly(onFrom.getId());
    }

    @Test
    void 삭제된_일정은_달력에서_빠진다() {
        LocalDateTime from = LocalDateTime.of(2026, 9, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 10, 1, 0, 0);
        Notice alive = repository.save(notice("살아있음", LocalDateTime.of(2026, 9, 5, 10, 0), false));
        Notice removed = repository.save(notice("삭제됨", LocalDateTime.of(2026, 9, 6, 10, 0), false));
        removed.delete();
        repository.saveAndFlush(removed);

        List<Notice> scheduled = repository
                .findByDeletedAtIsNullAndScheduledAtGreaterThanEqualAndScheduledAtLessThanOrderByScheduledAtAsc(
                        from, to, page())
                .getContent();

        assertThat(scheduled).extracting(Notice::getId).containsExactly(alive.getId());
    }

    @Test
    void 종류_필터는_해당_종류만_준다() {
        Notice event = repository.save(Notice.create(1L, NoticeType.EVENT, "일정", "본문",
                LocalDateTime.now(), null, false));
        repository.save(notice("공지", null, false));

        List<Notice> events = repository
                .findByDeletedAtIsNullAndTypeOrderByCreatedAtDesc(NoticeType.EVENT, page())
                .getContent();

        assertThat(events).extracting(Notice::getId).containsExactly(event.getId());
    }

    @Test
    void 전체_목록은_삭제된_것을_뺀다() {
        Notice alive = repository.save(notice("살아있음", null, false));
        Notice removed = repository.save(notice("삭제됨", null, false));
        removed.delete();
        repository.saveAndFlush(removed);

        List<Notice> all = repository.findByDeletedAtIsNullOrderByCreatedAtDesc(page()).getContent();

        assertThat(all).extracting(Notice::getId).containsExactly(alive.getId());
    }
}
