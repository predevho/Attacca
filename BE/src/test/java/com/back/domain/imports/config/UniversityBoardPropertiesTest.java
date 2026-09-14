package com.back.domain.imports.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.imports.collector.university.UniversityBoardProperties;
import com.back.domain.imports.collector.university.UniversityBoardProperties.Board;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class UniversityBoardPropertiesTest {

    private static final Set<String> EXPECTED_CODES = Set.of(
            "snu-admission",
            "snu-music",
            "yonsei-rolling",
            "yonsei-regular",
            "karts-admission");

    private static final Set<String> FORBIDDEN_CODES = Set.of(
            "pnu-admission",
            "gwnu-music",
            "jeju-admission",
            "jnu-admission",
            "knu-admission",
            "knu-music");

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withUserConfiguration(TestConfig.class);

    @Test
    void 검증된_대학_게시판만_설정한다() {
        runner.run(context -> {
            UniversityBoardProperties properties = context.getBean(UniversityBoardProperties.class);
            List<Board> boards = properties.boards();

            assertThat(boards).extracting(Board::code).containsExactlyInAnyOrderElementsOf(EXPECTED_CODES);
            assertThat(boards).extracting(Board::code).doesNotHaveDuplicates();
            assertThat(boards).extracting(Board::code).doesNotContainAnyElementsOf(FORBIDDEN_CODES);
            assertThat(properties.contact()).isEqualTo("");

            assertThat(boards).allSatisfy(board -> {
                assertThat(board.name()).isNotBlank();
                assertThat(board.listUrl()).hasScheme("https");
                assertThat(board.rowSelector()).isNotBlank();
                assertThat(board.titleSelector()).isNotBlank();
                assertThat(board.linkSelector()).isNotBlank();
                assertThat(board.dateSelector()).isNotBlank();
                assertThat(board.keywords()).isNotEmpty();
                Pattern.compile(board.postIdPattern());
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern(board.dateFormat());
                assertThat(LocalDate.parse(sampleDateFor(board.code()), formatter)).isNotNull();
            });
        });
    }

    private String sampleDateFor(String code) {
        if (code.equals("snu-admission")) {
            return "2026. 9. 14.";
        }
        if (code.startsWith("yonsei-")) {
            return "2026.09.14";
        }
        return "2026-09-14";
    }

    @Configuration
    @EnableConfigurationProperties(UniversityBoardProperties.class)
    static class TestConfig {
    }
}
