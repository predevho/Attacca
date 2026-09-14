package com.back.domain.imports.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "import")
public record ImportProperties(Kopis kopis) {

    public ImportProperties {
        kopis = kopis == null ? new Kopis(null, null, null, 0, 0, 0, null) : kopis;
    }

    public record Kopis(
            String baseUrl,
            String serviceKey,
            String genreCode,
            int daysAhead,
            int windowDays,
            int rows,
            List<String> posterAllowedHosts
    ) {

        public Kopis {
            baseUrl = blankToDefault(baseUrl, "http://www.kopis.or.kr");
            serviceKey = serviceKey == null ? "" : serviceKey;
            genreCode = blankToDefault(genreCode, "CCCA");
            daysAhead = daysAhead <= 0 ? 56 : daysAhead;
            windowDays = windowDays <= 0 ? 28 : windowDays;
            rows = rows <= 0 ? 100 : rows;
            posterAllowedHosts = posterAllowedHosts == null || posterAllowedHosts.isEmpty()
                    ? List.of("www.kopis.or.kr", "kopis.or.kr")
                    : List.copyOf(posterAllowedHosts);
        }

        private static String blankToDefault(String value, String defaultValue) {
            return value == null || value.isBlank() ? defaultValue : value;
        }
    }
}
