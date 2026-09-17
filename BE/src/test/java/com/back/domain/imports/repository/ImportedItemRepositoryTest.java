package com.back.domain.imports.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.entity.ImportStatus;
import com.back.domain.imports.entity.ImportedItem;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

@DataJpaTest
class ImportedItemRepositoryTest {

    @Autowired
    private ImportedItemRepository repository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void source와_sourceKey가_같은_항목은_중복_저장할_수_없다() {
        repository.saveAndFlush(item(ImportSource.KOPIS, "same", "첫 항목"));

        assertThatThrownBy(() -> repository.saveAndFlush(
                item(ImportSource.KOPIS, "same", "중복 항목")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void source와_sourceKey로_항목을_조회한다() {
        ImportedItem saved = repository.saveAndFlush(item(ImportSource.KOPIS, "PF-1", "공연"));

        assertThat(repository.findBySourceAndSourceKey(ImportSource.KOPIS, "PF-1"))
                .contains(saved);
        assertThat(repository.existsBySourceAndSourceKey(ImportSource.KOPIS, "PF-1")).isTrue();
    }

    @Test
    void 목록은_전달된_createdAt과_id_역순으로_조회한다() {
        ImportedItem first = repository.saveAndFlush(item(ImportSource.KOPIS, "1", "첫째"));
        ImportedItem second = repository.saveAndFlush(item(ImportSource.KOPIS, "2", "둘째"));
        ImportedItem latest = repository.saveAndFlush(item(ImportSource.KOPIS, "3", "최신"));
        LocalDateTime tiedAt = LocalDateTime.of(2026, 9, 12, 12, 0);
        entityManager.createNativeQuery("update imported_item set created_at = :createdAt where id in (:firstId, :secondId)")
                .setParameter("createdAt", tiedAt)
                .setParameter("firstId", first.getId())
                .setParameter("secondId", second.getId())
                .executeUpdate();
        entityManager.createNativeQuery("update imported_item set created_at = :createdAt where id = :id")
                .setParameter("createdAt", tiedAt.plusDays(1))
                .setParameter("id", latest.getId())
                .executeUpdate();
        entityManager.clear();

        var page = PageRequest.of(0, 10,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));

        assertThat(repository.findAllByFilters(null, null, page).getContent())
                .extracting(ImportedItem::getId)
                .containsExactly(latest.getId(), second.getId(), first.getId());
    }

    @Test
    void 상태와_원천을_독립적으로_필터링한다() {
        ImportedItem newKopis = repository.save(item(ImportSource.KOPIS, "K1", "신규 공연"));
        ImportedItem approvedKopis = item(ImportSource.KOPIS, "K2", "승인 공연");
        approvedKopis.approve(10L);
        repository.save(approvedKopis);
        ImportedItem newUniversity = repository.save(
                item(ImportSource.UNIV_NOTICE, "U1", "신규 대학 공지"));
        var page = PageRequest.of(0, 10, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));

        assertThat(repository.findAllByFilters(ImportStatus.NEW, null, page).getContent())
                .extracting(ImportedItem::getId)
                .containsExactlyInAnyOrder(newKopis.getId(), newUniversity.getId());
        assertThat(repository.findAllByFilters(null, ImportSource.KOPIS, page).getContent())
                .extracting(ImportedItem::getId)
                .containsExactlyInAnyOrder(newKopis.getId(), approvedKopis.getId());
        assertThat(repository.findAllByFilters(ImportStatus.NEW, ImportSource.UNIV_NOTICE, page).getContent())
                .extracting(ImportedItem::getId)
                .containsExactly(newUniversity.getId());
    }

    @Test
    void findByIdForUpdate는_비관적_쓰기_잠금을_건다() {
        ImportedItem saved = repository.saveAndFlush(item(ImportSource.KOPIS, "locked", "잠금"));
        entityManager.clear();

        ImportedItem locked = repository.findByIdForUpdate(saved.getId()).orElseThrow();

        assertThat(entityManager.getLockMode(locked)).isEqualTo(LockModeType.PESSIMISTIC_WRITE);
    }

    private ImportedItem item(ImportSource source, String sourceKey, String title) {
        return ImportedItem.newItem(source, sourceKey, source.name(),
                "https://example.com/" + sourceKey, title,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2), null,
                "장소", "요약", "https://example.com/poster.jpg",
                LocalDateTime.of(2026, 9, 13, 10, 0));
    }
}
