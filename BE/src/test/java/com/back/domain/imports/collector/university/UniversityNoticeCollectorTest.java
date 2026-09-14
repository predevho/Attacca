package com.back.domain.imports.collector.university;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.imports.collector.ImportCollector;
import com.back.domain.imports.entity.ImportSource;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.ClientHttpRequest;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.client.RestClient;

class UniversityNoticeCollectorTest {

    @Test
    void 한_게시판이_실패해도_다음_게시판을_수집하고_PARTIAL_메시지를_남긴다() {
        RecordingHttp factory = new RecordingHttp()
                .respond("https://admission.example/robots.txt", 200, """
                        User-agent: AttaccaBot
                        Allow: /
                        """)
                .respond("https://admission.example/fail", 500, "boom")
                .respond("https://admission.example/success", 200, html("BBS_NO=200", "수시 모집요강", "2026.09.14"));
        RecordingSleeper sleeper = new RecordingSleeper();
        UniversityNoticeCollector collector = collector(factory, sleeper,
                board("fail", "https://admission.example/fail"),
                board("success", "https://admission.example/success"));

        ImportCollector.ImportCollectionResult result = collector.collect();

        assertThat(result.items()).extracting(com.back.domain.imports.collector.CollectedItem::sourceKey)
                .containsExactly("success:200");
        assertThat(result.message()).contains("PARTIAL").contains("fail");
        assertThat(factory.requestedUrls()).containsExactly(
                "https://admission.example/robots.txt",
                "https://admission.example/fail",
                "https://admission.example/success");
        assertThat(sleeper.durations).containsExactly(Duration.ofSeconds(1));
    }

    @Test
    void 같은_호스트의_robots는_한_번만_받고_차단된_게시판은_목록을_읽지_않는다() {
        RecordingHttp factory = new RecordingHttp()
                .respond("https://admission.example/robots.txt", 200, """
                        User-agent: AttaccaBot
                        Disallow: /blocked
                        Allow: /open
                        """)
                .respond("https://admission.example/open", 200, html("BBS_NO=300", "정시 모집요강", "2026.11.01"));
        UniversityNoticeCollector collector = collector(factory, new RecordingSleeper(),
                board("blocked", "https://admission.example/blocked"),
                board("open", "https://admission.example/open"));

        ImportCollector.ImportCollectionResult result = collector.collect();

        assertThat(result.items()).extracting(com.back.domain.imports.collector.CollectedItem::sourceKey)
                .containsExactly("open:300");
        assertThat(result.message()).contains("blocked").contains("robots");
        assertThat(factory.requestedUrls()).containsExactly(
                "https://admission.example/robots.txt",
                "https://admission.example/open");
    }

    @Test
    void robots_5xx_호스트는_목록_요청_없이_건너뛴다() {
        RecordingHttp factory = new RecordingHttp()
                .respond("https://admission.example/robots.txt", 503, "down");
        UniversityNoticeCollector collector = collector(factory, new RecordingSleeper(),
                board("skipped", "https://admission.example/notice"));

        ImportCollector.ImportCollectionResult result = collector.collect();

        assertThat(result.items()).isEmpty();
        assertThat(result.message()).contains("skipped").contains("robots");
        assertThat(factory.requestedUrls()).containsExactly("https://admission.example/robots.txt");
    }

    @Test
    void robots_URL은_비표준_포트를_보존한다() {
        RecordingHttp factory = new RecordingHttp()
                .respond("http://localhost:18080/robots.txt", 200, """
                        User-agent: AttaccaBot
                        Allow: /
                        """)
                .respond("http://localhost:18080/notice", 200, html("BBS_NO=400", "수시 모집요강", "2026.09.14"));
        UniversityNoticeCollector collector = collector(factory, new RecordingSleeper(),
                board("local", "http://localhost:18080/notice"));

        ImportCollector.ImportCollectionResult result = collector.collect();

        assertThat(result.items()).extracting(com.back.domain.imports.collector.CollectedItem::sourceKey)
                .containsExactly("local:400");
        assertThat(factory.requestedUrls()).containsExactly(
                "http://localhost:18080/robots.txt",
                "http://localhost:18080/notice");
    }

    @Test
    void robots_네트워크_실패는_목록_요청_없이_호스트를_건너뛴다() {
        RecordingHttp factory = new RecordingHttp()
                .fail("https://admission.example/robots.txt");
        UniversityNoticeCollector collector = collector(factory, new RecordingSleeper(),
                board("timeout", "https://admission.example/notice"));

        ImportCollector.ImportCollectionResult result = collector.collect();

        assertThat(result.items()).isEmpty();
        assertThat(result.message()).contains("timeout").contains("robots");
        assertThat(factory.requestedUrls()).containsExactly("https://admission.example/robots.txt");
    }

    @Test
    void 파서_스킵_사유를_PARTIAL_메시지에_포함한다() {
        RecordingHttp factory = new RecordingHttp()
                .respond("https://admission.example/robots.txt", 200, """
                        User-agent: AttaccaBot
                        Allow: /
                        """)
                .respond("https://admission.example/notice", 200, html("NO_ID=500", "수시 모집요강", "2026.09.14"));
        UniversityNoticeCollector collector = collector(factory, new RecordingSleeper(),
                board("notice", "https://admission.example/notice"));

        ImportCollector.ImportCollectionResult result = collector.collect();

        assertThat(result.items()).isEmpty();
        assertThat(result.message()).contains("PARTIAL").contains("notice").contains("missing article id");
    }

    @Test
    void source는_UNIV_NOTICE다() {
        UniversityNoticeCollector collector = collector(new RecordingHttp(), new RecordingSleeper());

        assertThat(collector.source()).isEqualTo(ImportSource.UNIV_NOTICE);
    }

    private UniversityNoticeCollector collector(
            RecordingHttp factory, RecordingSleeper sleeper, UniversityBoardProperties.Board... boards) {
        UniversityBoardProperties properties = new UniversityBoardProperties(
                List.of(boards), "contact@example.com");
        return new UniversityNoticeCollector(
                RestClient.builder().requestFactory(factory).build(),
                properties,
                new UniversityBoardParser(),
                sleeper);
    }

    private UniversityBoardProperties.Board board(String code, String url) {
        return new UniversityBoardProperties.Board(
                code, code, URI.create(url), StandardCharsets.UTF_8, "tr", ".title", "a", ".date",
                "yyyy.MM.dd", "BBS_NO=(\\d+)", List.of());
    }

    private String html(String idPart, String title, String date) {
        return """
                <table><tr><td class="title"><a href="/view?%s">%s</a></td><td class="date">%s</td></tr></table>
                """.formatted(idPart, title, date);
    }

    private static class RecordingSleeper implements UniversityNoticeCollector.Sleeper {
        private final List<Duration> durations = new ArrayList<>();

        @Override
        public void sleep(Duration duration) {
            durations.add(duration);
        }
    }

    private static class RecordingHttp implements ClientHttpRequestFactory {
        private final List<String> requestedUrls = new ArrayList<>();
        private final java.util.Map<String, Response> responses = new java.util.HashMap<>();

        RecordingHttp respond(String url, int status, String body) {
            responses.put(url, new Response(status, body));
            return this;
        }

        RecordingHttp fail(String url) {
            responses.put(url, new Response(0, ""));
            return this;
        }

        List<String> requestedUrls() {
            return requestedUrls;
        }

        @Override
        public ClientHttpRequest createRequest(URI uri, HttpMethod httpMethod) {
            return new Request(uri);
        }

        private class Request implements ClientHttpRequest {
            private final URI uri;
            private final HttpHeaders headers = new HttpHeaders();

            private Request(URI uri) {
                this.uri = uri;
            }

            @Override
            public ClientHttpResponse execute() throws IOException {
                requestedUrls.add(uri.toString());
                Response response = responses.get(uri.toString());
                if (response == null) {
                    throw new IOException("Unexpected URL " + uri);
                }
                if (response.status == 0) {
                    throw new IOException("network failure");
                }
                return response.toClientResponse();
            }

            @Override
            public HttpMethod getMethod() {
                return HttpMethod.GET;
            }

            @Override
            public URI getURI() {
                return uri;
            }

            @Override
            public HttpHeaders getHeaders() {
                return headers;
            }

            @Override
            public java.util.Map<String, Object> getAttributes() {
                return new java.util.HashMap<>();
            }

            @Override
            public java.io.OutputStream getBody() {
                return java.io.OutputStream.nullOutputStream();
            }
        }

        private record Response(int status, String body) {
            ClientHttpResponse toClientResponse() {
                return new ClientHttpResponse() {
                    @Override
                    public HttpStatus getStatusCode() {
                        return HttpStatus.valueOf(status);
                    }

                    @Override
                    public String getStatusText() {
                        return String.valueOf(status);
                    }

                    @Override
                    public void close() {
                    }

                    @Override
                    public java.io.InputStream getBody() {
                        return new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8));
                    }

                    @Override
                    public HttpHeaders getHeaders() {
                        HttpHeaders headers = new HttpHeaders();
                        headers.add(HttpHeaders.CONTENT_TYPE, "text/html;charset=UTF-8");
                        return headers;
                    }
                };
            }
        }
    }
}
