package com.back.domain.imports.collector.university;

import com.back.domain.imports.collector.CollectedItem;
import com.back.domain.imports.collector.ImportCollector;
import com.back.domain.imports.entity.ImportSource;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class UniversityNoticeCollector implements ImportCollector {

    private static final Duration SAME_HOST_INTERVAL = Duration.ofSeconds(1);

    private final RestClient restClient;
    private final UniversityBoardProperties properties;
    private final UniversityBoardParser parser;
    private final Sleeper sleeper;

    @Autowired
    public UniversityNoticeCollector(RestClient.Builder restClientBuilder,
            UniversityBoardProperties properties, UniversityBoardParser parser) {
        this(restClientBuilder.build(), properties, parser, duration -> {
            try {
                Thread.sleep(duration.toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("University collector sleep interrupted", e);
            }
        });
    }

    public UniversityNoticeCollector(RestClient restClient, UniversityBoardProperties properties,
            UniversityBoardParser parser, Sleeper sleeper) {
        this.restClient = restClient;
        this.properties = properties;
        this.parser = parser;
        this.sleeper = sleeper;
    }

    @Override
    public ImportSource source() {
        return ImportSource.UNIV_NOTICE;
    }

    @Override
    public ImportCollectionResult collect() {
        Map<String, RobotsPolicy> robotsByAuthority = new HashMap<>();
        Map<String, Boolean> authorityRequested = new HashMap<>();
        List<CollectedItem> items = new ArrayList<>();
        List<String> failures = new ArrayList<>();
        for (UniversityBoardProperties.Board board : properties.boards()) {
            String authority = board.listUrl().getAuthority();
            RobotsPolicy robots = robotsByAuthority.computeIfAbsent(authority, ignored -> fetchRobots(board.listUrl()));
            RobotsPolicy.Decision decision = robots.evaluate(userAgent(), board.listUrl());
            if (decision != RobotsPolicy.Decision.ALLOW) {
                failures.add(board.code() + ": robots " + decision);
                continue;
            }
            if (Boolean.TRUE.equals(authorityRequested.put(authority, true))) {
                sleeper.sleep(SAME_HOST_INTERVAL);
            }
            try {
                byte[] body = restClient.get()
                        .uri(board.listUrl())
                        .header("User-Agent", userAgent())
                        .retrieve()
                        .body(byte[].class);
                UniversityBoardParser.ParseResult parseResult = parser.parseWithDiagnostics(
                        board, body == null ? new byte[0] : body);
                items.addAll(parseResult.items());
                failures.addAll(parseResult.skipReasons());
            } catch (RuntimeException e) {
                failures.add(board.code() + ": " + e.getClass().getSimpleName());
            }
        }
        return new ImportCollectionResult(items, message(failures));
    }

    private RobotsPolicy fetchRobots(URI listUrl) {
        URI robotsUri = URI.create(listUrl.getScheme() + "://" + listUrl.getAuthority() + "/robots.txt");
        try {
            String body = restClient.get()
                    .uri(robotsUri)
                    .header("User-Agent", userAgent())
                    .retrieve()
                    .body(String.class);
            return RobotsPolicy.parse(robotsUri, body == null ? "" : body);
        } catch (HttpStatusCodeException e) {
            if (e.getStatusCode().is4xxClientError()) {
                return RobotsPolicy.allowAll(robotsUri);
            }
            return RobotsPolicy.skipHost(robotsUri, "robots " + e.getStatusCode());
        } catch (RestClientException e) {
            return RobotsPolicy.skipHost(robotsUri, e.getClass().getSimpleName());
        }
    }

    private String userAgent() {
        if (properties.contact().isBlank()) {
            return "AttaccaBot/1.0";
        }
        return "AttaccaBot/1.0 (+" + properties.contact() + ")";
    }

    private String message(List<String> failures) {
        if (failures.isEmpty()) {
            return null;
        }
        return "PARTIAL: " + String.join("; ", failures);
    }

    @FunctionalInterface
    public interface Sleeper {
        void sleep(Duration duration);
    }
}
