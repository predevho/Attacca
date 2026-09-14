package com.back.domain.imports.repository;

import com.back.domain.imports.entity.ImportRun;
import com.back.domain.imports.entity.ImportSource;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImportRunRepository extends JpaRepository<ImportRun, Long> {

    Optional<ImportRun> findTopBySourceOrderByStartedAtDescIdDesc(ImportSource source);

    long deleteByFinishedAtBefore(LocalDateTime cutoff);
}
