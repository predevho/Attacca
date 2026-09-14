package com.back.domain.imports.collector;

import com.back.domain.imports.entity.ImportSource;
import java.util.List;

public interface ImportCollector {

    ImportSource source();

    ImportCollectionResult collect();

    record ImportCollectionResult(List<CollectedItem> items, String message) {

        public ImportCollectionResult {
            items = List.copyOf(items);
        }
    }
}
