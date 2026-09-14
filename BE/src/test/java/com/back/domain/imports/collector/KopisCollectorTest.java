package com.back.domain.imports.collector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.back.domain.imports.config.ImportProperties;
import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.repository.ImportedItemRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KopisCollectorTest {

    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-09-14T00:00:00Z"), ZoneId.of("Asia/Seoul"));
    private static final String BASE_URL = "http://www.kopis.or.kr";

    private final RestClient.Builder restClientBuilder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(restClientBuilder).build();
    private final ImportedItemRepository repository = mock(ImportedItemRepository.class);
    private final List<String> checkedIds = new ArrayList<>();
    private final RecordingSleeper sleeper = new RecordingSleeper();

    @BeforeEach
    void setUp() {
        when(repository.existsBySourceAndSourceKey(eq(ImportSource.KOPIS), org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(invocation -> {
                    String sourceKey = invocation.getArgument(1);
                    checkedIds.add(sourceKey);
                    return false;
                });
    }

    @Test
    void 두_개의_28일_구간을_rows_100으로_조회하고_100건_미만_페이지에서_종료한다() {
        KopisCollector collector = collector("service-key");
        expectList("20260914", "20261011", 1, listWith("PF-OLD", "PF-NEW"));
        expectDetail("PF-OLD", detail("PF-OLD", "기존 공연"));
        expectDetail("PF-NEW", detail("PF-NEW", "신규 공연"));
        expectList("20261012", "20261108", 1, emptyList());

        List<CollectedItem> items = collector.collect().items();

        assertThat(items).extracting(CollectedItem::sourceKey)
                .containsExactly("PF-OLD", "PF-NEW");
        server.verify();
    }

    @Test
    void 목록_페이지가_100건이면_다음_페이지를_요청하고_100건_미만에서_멈춘다() {
        KopisCollector collector = collector("service-key");
        expectList("20260914", "20261011", 1, listOfSize(100));
        expectDetailPages(0, 100);
        expectList("20260914", "20261011", 2, listWith("PF-100"));
        expectDetail("PF-100", detail("PF-100", "마지막 공연"));
        expectList("20261012", "20261108", 1, emptyList());

        List<CollectedItem> items = collector.collect().items();

        assertThat(items).hasSize(101);
        assertThat(items.get(100).sourceKey()).isEqualTo("PF-100");
        server.verify();
    }

    @Test
    void 이미_저장된_ID는_상세_호출하지_않고_신규_ID만_수집한다() {
        markExisting("PF-OLD");
        KopisCollector collector = collector("service-key");
        expectList("20260914", "20261011", 1, listWith("PF-OLD", "PF-NEW"));
        expectDetail("PF-NEW", detail("PF-NEW", "신규 공연"));
        expectList("20261012", "20261108", 1, emptyList());

        List<CollectedItem> items = collector.collect().items();

        assertThat(items).extracting(CollectedItem::sourceKey).containsExactly("PF-NEW");
        assertThat(checkedIds).containsExactly("PF-OLD", "PF-NEW");
        server.verify();
    }

    @Test
    void 목록의_blank_ID는_저장소_확인과_상세_호출을_하지_않고_건너뛴다() {
        KopisCollector collector = collector("service-key");
        expectList("20260914", "20261011", 1, """
                <dbs>
                  <db><mt20id>   </mt20id></db>
                  <db><mt20id>PF-NEW</mt20id></db>
                </dbs>
                """);
        expectDetail("PF-NEW", detail("PF-NEW", "신규 공연"));
        expectList("20261012", "20261108", 1, emptyList());

        List<CollectedItem> items = collector.collect().items();

        assertThat(items).extracting(CollectedItem::sourceKey).containsExactly("PF-NEW");
        assertThat(checkedIds).containsExactly("PF-NEW");
        server.verify();
    }

    @Test
    void XML_상세_필드를_CollectedItem으로_매핑한다() {
        KopisCollector collector = collector("service-key");
        expectList("20260914", "20261011", 1, listWith("PF-NEW"));
        expectDetail("PF-NEW", """
                <dbs>
                  <db>
                    <mt20id>PF-NEW</mt20id>
                    <prfnm>가을 실내악</prfnm>
                    <prfpdfrom>2026.10.03</prfpdfrom>
                    <prfpdto>2026.10.04</prfpdto>
                    <fcltynm>예술의전당 콘서트홀</fcltynm>
                    <prfcast>홍길동, 김영희</prfcast>
                    <pcseguidance>R석 50,000원</pcseguidance>
                    <dtguidance>토 19:30</dtguidance>
                    <prfruntime>100분</prfruntime>
                    <poster>https://www.kopis.or.kr/poster/PF-NEW.jpg</poster>
                    <relates>
                      <relate>
                        <relatenm>예매처</relatenm>
                        <relateurl>ftp://invalid.example/PF-NEW</relateurl>
                      </relate>
                      <relate>
                        <relatenm>공식</relatenm>
                        <relateurl>https://tickets.example/PF-NEW</relateurl>
                      </relate>
                    </relates>
                  </db>
                </dbs>
                """);
        expectList("20261012", "20261108", 1, emptyList());

        CollectedItem item = collector.collect().items().get(0);

        assertThat(item.sourceKey()).isEqualTo("PF-NEW");
        assertThat(item.sourceName()).isEqualTo("(재)예술경영지원센터 공연예술통합전산망(www.kopis.or.kr)");
        assertThat(item.sourceUrl()).isEqualTo("https://tickets.example/PF-NEW");
        assertThat(item.title()).isEqualTo("가을 실내악");
        assertThat(item.startsAt()).isEqualTo(LocalDate.of(2026, 10, 3));
        assertThat(item.endsAt()).isEqualTo(LocalDate.of(2026, 10, 4));
        assertThat(item.postedAt()).isNull();
        assertThat(item.place()).isEqualTo("예술의전당 콘서트홀");
        assertThat(item.summary()).isEqualTo("""
                홍길동, 김영희
                R석 50,000원
                토 19:30
                100분""");
        assertThat(item.posterUrl()).isEqualTo("https://www.kopis.or.kr/poster/PF-NEW.jpg");
        server.verify();
    }

    @Test
    void http_원문_링크가_없으면_KOPIS_홈을_sourceUrl로_쓴다() {
        KopisCollector collector = collector("service-key");
        expectList("20260914", "20261011", 1, listWith("PF-NEW"));
        expectDetail("PF-NEW", detail("PF-NEW", "링크 없는 공연"));
        expectList("20261012", "20261108", 1, emptyList());

        CollectedItem item = collector.collect().items().get(0);

        assertThat(item.sourceUrl()).isEqualTo("https://www.kopis.or.kr");
        server.verify();
    }

    @Test
    void 서비스키가_비어_있으면_HTTP_호출_없이_SKIPPED_메시지를_반환한다() {
        KopisCollector collector = collector(" ");

        ImportCollector.ImportCollectionResult result = collector.collect();

        assertThat(result.items()).isEmpty();
        assertThat(result.message()).isEqualTo("KOPIS_SERVICE_KEY missing");
        server.verify();
    }

    @Test
    void 연속_HTTP_요청_사이에_200ms_이상_sleep한다() {
        KopisCollector collector = collector("service-key");
        expectList("20260914", "20261011", 1, listWith("PF-NEW"));
        expectDetail("PF-NEW", detail("PF-NEW", "신규 공연"));
        expectList("20261012", "20261108", 1, emptyList());

        collector.collect();

        assertThat(sleeper.durations).hasSize(2);
        assertThat(sleeper.durations).allSatisfy(duration ->
                assertThat(duration).isGreaterThanOrEqualTo(Duration.ofMillis(200)));
        server.verify();
    }

    private KopisCollector collector(String serviceKey) {
        ImportProperties.Kopis kopis = new ImportProperties.Kopis(
                BASE_URL, serviceKey, "CCCA", 56, 28, 100, List.of("www.kopis.or.kr", "kopis.or.kr"));
        return new KopisCollector(restClientBuilder.build(), kopis, repository, CLOCK, sleeper);
    }

    private void markExisting(String sourceKey) {
        doAnswer(invocation -> {
                    checkedIds.add(sourceKey);
                    return true;
                })
                .when(repository).existsBySourceAndSourceKey(ImportSource.KOPIS, sourceKey);
    }

    private void expectList(String from, String to, int page, String body) {
        server.expect(once(), requestTo(BASE_URL + "/openApi/restful/pblprfr?service=service-key"
                        + "&stdate=" + from + "&eddate=" + to + "&cpage=" + page
                        + "&rows=100&shcate=CCCA"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("service", "service-key"))
                .andExpect(queryParam("stdate", from))
                .andExpect(queryParam("eddate", to))
                .andExpect(queryParam("cpage", String.valueOf(page)))
                .andExpect(queryParam("rows", "100"))
                .andExpect(queryParam("shcate", "CCCA"))
                .andRespond(withSuccess(body, MediaType.valueOf("application/xml;charset=UTF-8")));
    }

    private void expectDetail(String id, String body) {
        server.expect(once(), requestTo(BASE_URL + "/openApi/restful/pblprfr/" + id
                        + "?service=service-key"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("service", "service-key"))
                .andRespond(withSuccess(body, MediaType.valueOf("application/xml;charset=UTF-8")));
    }

    private void expectDetailPages(int startInclusive, int endExclusive) {
        for (int i = startInclusive; i < endExclusive; i++) {
            String id = "PF-" + i;
            expectDetail(id, detail(id, "공연 " + i));
        }
    }

    private String listWith(String... ids) {
        StringBuilder xml = new StringBuilder("<dbs>");
        for (String id : ids) {
            xml.append("<db><mt20id>").append(id).append("</mt20id></db>");
        }
        return xml.append("</dbs>").toString();
    }

    private String listOfSize(int count) {
        StringBuilder xml = new StringBuilder("<dbs>");
        for (int i = 0; i < count; i++) {
            xml.append("<db><mt20id>PF-").append(i).append("</mt20id></db>");
        }
        return xml.append("</dbs>").toString();
    }

    private String emptyList() {
        return "<dbs></dbs>";
    }

    private String detail(String id, String title) {
        return """
                <dbs>
                  <db>
                    <mt20id>%s</mt20id>
                    <prfnm>%s</prfnm>
                    <prfpdfrom>2026.10.03</prfpdfrom>
                    <prfpdto>2026.10.04</prfpdto>
                    <fcltynm>공연장</fcltynm>
                  </db>
                </dbs>
                """.formatted(id, title);
    }

    private static class RecordingSleeper implements KopisCollector.Sleeper {
        private final List<Duration> durations = new ArrayList<>();

        @Override
        public void sleep(Duration duration) {
            durations.add(duration);
        }
    }
}
