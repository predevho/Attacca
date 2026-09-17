package com.back.domain.imports.repository;

import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.entity.ImportStatus;
import com.back.domain.imports.entity.ImportedItem;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ImportedItemRepository extends JpaRepository<ImportedItem, Long> {

    Optional<ImportedItem> findBySourceAndSourceKey(ImportSource source, String sourceKey);

    boolean existsBySourceAndSourceKey(ImportSource source, String sourceKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from ImportedItem item where item.id = :id")
    Optional<ImportedItem> findByIdForUpdate(@Param("id") Long id);

    @Query("select item from ImportedItem item "
            + "where (:status is null or item.status = :status) "
            + "and (:source is null or item.source = :source)")
    Page<ImportedItem> findAllByFilters(@Param("status") ImportStatus status,
            @Param("source") ImportSource source, Pageable pageable);
}
