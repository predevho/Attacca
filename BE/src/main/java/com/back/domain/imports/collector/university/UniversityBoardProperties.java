package com.back.domain.imports.collector.university;

import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "import.collector.university")
public record UniversityBoardProperties(List<Board> boards, String contact) {

    private static final List<String> DEFAULT_KEYWORDS = List.of(
            "음악", "실기", "곡목", "악보", "예능", "예체능", "모집요강", "수시", "정시");

    public UniversityBoardProperties {
        boards = boards == null ? List.of() : List.copyOf(boards);
        contact = contact == null ? "" : contact;
    }

    public record Board(
            String code,
            String name,
            URI listUrl,
            Charset charset,
            String rowSelector,
            String titleSelector,
            String linkSelector,
            String dateSelector,
            String dateFormat,
            String postIdPattern,
            List<String> keywords
    ) {

        public Board {
            charset = charset == null ? StandardCharsets.UTF_8 : charset;
            keywords = keywords == null ? DEFAULT_KEYWORDS : List.copyOf(keywords);
        }
    }
}
