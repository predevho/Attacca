package com.back.domain.imports.service;

import com.back.domain.imports.collector.CollectedItem;
import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.entity.ImportedItem;
import com.back.domain.imports.repository.ImportedItemRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ImportIngestionService {

    private final ImportedItemRepository importedItemRepository;

    @Transactional
    public int save(ImportSource source, List<CollectedItem> items, LocalDateTime seenAt) {
        int newCount = 0;
        for (CollectedItem item : items) {
            ImportedItem existing = importedItemRepository
                    .findBySourceAndSourceKey(source, item.sourceKey())
                    .orElse(null);
            if (existing != null) {
                existing.seenAt(seenAt);
                continue;
            }
            importedItemRepository.save(ImportedItem.newItem(source, item.sourceKey(),
                    item.sourceName(), item.sourceUrl(), item.title(), item.startsAt(),
                    item.endsAt(), item.postedAt(), item.place(), item.summary(),
                    item.posterUrl(), seenAt));
            newCount++;
        }
        return newCount;
    }
}
