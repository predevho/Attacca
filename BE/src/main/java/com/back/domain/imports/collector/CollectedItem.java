package com.back.domain.imports.collector;

import java.time.LocalDate;

public record CollectedItem(
        String sourceKey,
        String sourceName,
        String sourceUrl,
        String title,
        LocalDate startsAt,
        LocalDate endsAt,
        LocalDate postedAt,
        String place,
        String summary,
        String posterUrl
) {
}
