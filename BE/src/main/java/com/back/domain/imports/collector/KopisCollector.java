package com.back.domain.imports.collector;

import com.back.domain.imports.collector.kopis.KopisDetailResponse;
import com.back.domain.imports.collector.kopis.KopisDetailResponse.KopisDetailItem;
import com.back.domain.imports.collector.kopis.KopisListResponse;
import com.back.domain.imports.collector.kopis.KopisListResponse.KopisListItem;
import com.back.domain.imports.config.ImportProperties;
import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.repository.ImportedItemRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class KopisCollector implements ImportCollector {

    public static final String SOURCE_NAME = "(재)예술경영지원센터 공연예술통합전산망(www.kopis.or.kr)";
    private static final String SKIPPED_MESSAGE = "KOPIS_SERVICE_KEY missing";
    private static final String DEFAULT_SOURCE_URL = "https://www.kopis.or.kr";
    private static final Duration REQUEST_INTERVAL = Duration.ofMillis(200);
    private static final DateTimeFormatter REQUEST_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter KOPIS_DATE = DateTimeFormatter.ofPattern("yyyy.MM.dd");

    private final RestClient restClient;
    private final ImportProperties.Kopis properties;
    private final ImportedItemRepository importedItemRepository;
    private final Clock clock;
    private final Sleeper sleeper;
    private final XmlMapper xmlMapper = new XmlMapper();
    private boolean requestSent;

    @Autowired
    public KopisCollector(@Qualifier("kopisRestClient") RestClient restClient,
            ImportProperties properties, ImportedItemRepository importedItemRepository, Clock clock) {
        this(restClient, properties.kopis(), importedItemRepository, clock, duration -> {
            try {
                Thread.sleep(duration.toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("KOPIS request sleep interrupted", e);
            }
        });
    }

    public KopisCollector(RestClient restClient, ImportProperties.Kopis properties,
            ImportedItemRepository importedItemRepository, Clock clock, Sleeper sleeper) {
        this.restClient = restClient;
        this.properties = properties;
        this.importedItemRepository = importedItemRepository;
        this.clock = clock;
        this.sleeper = sleeper;
    }

    @Override
    public ImportSource source() {
        return ImportSource.KOPIS;
    }

    @Override
    public ImportCollectionResult collect() {
        if (properties.serviceKey().isBlank()) {
            return new ImportCollectionResult(List.of(), SKIPPED_MESSAGE);
        }

        requestSent = false;
        List<CollectedItem> items = new ArrayList<>();
        LocalDate start = LocalDate.now(clock);
        LocalDate limit = start.plusDays(properties.daysAhead() - 1L);
        for (LocalDate windowStart = start; !windowStart.isAfter(limit);
                windowStart = windowStart.plusDays(properties.windowDays())) {
            LocalDate windowEnd = windowStart.plusDays(properties.windowDays() - 1L);
            if (windowEnd.isAfter(limit)) {
                windowEnd = limit;
            }
            collectWindow(items, windowStart, windowEnd);
        }
        return new ImportCollectionResult(items, null);
    }

    private void collectWindow(List<CollectedItem> items, LocalDate start, LocalDate end) {
        int page = 1;
        while (true) {
            KopisListResponse response = readXml(requestList(start, end, page), KopisListResponse.class);
            List<KopisListItem> listItems = response.items();
            for (KopisListItem item : listItems) {
                if (item.mt20id() != null && !item.mt20id().isBlank()
                        && !importedItemRepository.existsBySourceAndSourceKey(ImportSource.KOPIS, item.mt20id())) {
                    CollectedItem collected = fetchDetail(item.mt20id());
                    if (collected != null) {
                        items.add(collected);
                    }
                }
            }
            if (listItems.size() < properties.rows()) {
                return;
            }
            page++;
        }
    }

    private String requestList(LocalDate start, LocalDate end, int page) {
        beforeRequest();
        return restClient.get()
                .uri(properties.baseUrl() + "/openApi/restful/pblprfr?service={service}"
                                + "&stdate={stdate}&eddate={eddate}&cpage={cpage}&rows={rows}&shcate={shcate}",
                        properties.serviceKey(), REQUEST_DATE.format(start), REQUEST_DATE.format(end),
                        page, properties.rows(), properties.genreCode())
                .retrieve()
                .body(String.class);
    }

    private CollectedItem fetchDetail(String id) {
        KopisDetailResponse response = readXml(requestDetail(id), KopisDetailResponse.class);
        KopisDetailItem item = response.firstItem();
        if (item == null) {
            return null;
        }
        return new CollectedItem(
                item.mt20id(),
                SOURCE_NAME,
                firstHttpUrl(item),
                item.prfnm(),
                parseDate(item.prfpdfrom()),
                parseDate(item.prfpdto()),
                null,
                item.fcltynm(),
                summary(item),
                item.poster());
    }

    private String requestDetail(String id) {
        beforeRequest();
        return restClient.get()
                .uri(properties.baseUrl() + "/openApi/restful/pblprfr/{id}?service={service}",
                        id, properties.serviceKey())
                .retrieve()
                .body(String.class);
    }

    private void beforeRequest() {
        if (requestSent) {
            sleeper.sleep(REQUEST_INTERVAL);
        }
        requestSent = true;
    }

    private <T> T readXml(String xml, Class<T> type) {
        try {
            return xmlMapper.readValue(xml, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("KOPIS XML parse failed", e);
        }
    }

    private LocalDate parseDate(String value) {
        return value == null || value.isBlank() ? null : LocalDate.parse(value, KOPIS_DATE);
    }

    private String summary(KopisDetailItem item) {
        List<String> lines = new ArrayList<>();
        addLine(lines, item.prfcast());
        addLine(lines, item.pcseguidance());
        addLine(lines, item.dtguidance());
        addLine(lines, item.prfruntime());
        return lines.isEmpty() ? null : String.join("\n", lines);
    }

    private void addLine(List<String> lines, String value) {
        if (value != null && !value.isBlank()) {
            lines.add(value.trim());
        }
    }

    private String firstHttpUrl(KopisDetailItem item) {
        if (item.relates() == null || item.relates().items() == null) {
            return DEFAULT_SOURCE_URL;
        }
        return item.relates().items().stream()
                .map(KopisDetailResponse.Relate::relateurl)
                .filter(url -> url != null && (url.startsWith("http://") || url.startsWith("https://")))
                .findFirst()
                .orElse(DEFAULT_SOURCE_URL);
    }

    @FunctionalInterface
    public interface Sleeper {
        void sleep(Duration duration);
    }
}
