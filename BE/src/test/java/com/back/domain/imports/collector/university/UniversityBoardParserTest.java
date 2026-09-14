package com.back.domain.imports.collector.university;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.imports.collector.CollectedItem;
import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class UniversityBoardParserTest {

    private final UniversityBoardParser parser = new UniversityBoardParser();

    @Test
    void table_tr_HTML에서_상대링크_query_ID_날짜와_키워드를_읽는다() {
        UniversityBoardProperties.Board board = board("yyyy.MM.dd", "BBS_NO=(\\d+)", List.of("실기"));
        String html = """
                <table>
                  <tr><td class="title"><a href="/notice/view?BBS_NO=123&s_page=1">2027학년도 실기 곡목 안내</a></td><td class="date">2026.09.14</td></tr>
                  <tr><td class="title"><a href="/notice/view?BBS_NO=124">장학 안내</a></td><td class="date">2026.09.13</td></tr>
                </table>
                """;

        List<CollectedItem> items = parser.parse(board, html.getBytes(StandardCharsets.UTF_8));

        assertThat(items).hasSize(1);
        CollectedItem item = items.get(0);
        assertThat(item.sourceKey()).isEqualTo("test-board:123");
        assertThat(item.sourceName()).isEqualTo("테스트 대학");
        assertThat(item.sourceUrl()).isEqualTo("https://admission.example/notice/view?BBS_NO=123&s_page=1");
        assertThat(item.title()).isEqualTo("2027학년도 실기 곡목 안내");
        assertThat(item.postedAt()).isEqualTo(LocalDate.of(2026, 9, 14));
    }

    @Test
    void ul_li_HTML에서_EUC_KR_path_ID와_slash_날짜를_읽는다() {
        UniversityBoardProperties.Board board = new UniversityBoardProperties.Board(
                "test-board", "테스트 대학", URI.create("https://music.example/admission/list"),
                Charset.forName("EUC-KR"), "li", ".title", "a", ".date",
                "yyyy/MM/dd", "/notice/(\\d+)", List.of());
        String html = """
                <ul>
                  <li><a class="title" href="../notice/991">정시 모집요강</a><span class="date">2026/11/03</span></li>
                </ul>
                """;

        List<CollectedItem> items = parser.parse(board, html.getBytes(Charset.forName("EUC-KR")));

        assertThat(items).extracting(CollectedItem::sourceKey).containsExactly("test-board:991");
        assertThat(items.get(0).sourceUrl()).isEqualTo("https://music.example/notice/991");
        assertThat(items.get(0).postedAt()).isEqualTo(LocalDate.of(2026, 11, 3));
    }

    @Test
    void javascript_링크에서_글번호를_뽑고_고정글_중복은_같은_sourceKey를_반환한다() {
        UniversityBoardProperties.Board board = new UniversityBoardProperties.Board(
                "test-board", "테스트 대학", URI.create("https://admission.example/notice/list"),
                StandardCharsets.UTF_8, "li", ".title", "a", ".date",
                "yyyy. M. d.", "goView\\('(\\d+)'\\)", List.of());
        String html = """
                <ul>
                  <li><a class="title" href="javascript:goView('777')">수시 실기 시간표</a><span class="date">2026. 9. 1.</span></li>
                  <li><a class="title" href="javascript:goView('777')">[공지] 수시 실기 시간표</a><span class="date">2026. 9. 1.</span></li>
                </ul>
                """;

        List<CollectedItem> items = parser.parse(board, html.getBytes(StandardCharsets.UTF_8));

        assertThat(items).extracting(CollectedItem::sourceKey)
                .containsExactly("test-board:777", "test-board:777");
    }

    @Test
    void 글번호나_게시일을_읽지_못한_행은_건너뛴다() {
        UniversityBoardProperties.Board board = board("yyyy.MM.dd", "BBS_NO=(\\d+)", List.of());
        String html = """
                <table>
                  <tr><td class="title"><a href="/notice/view">수시 모집요강</a></td><td class="date">2026.09.14</td></tr>
                  <tr><td class="title"><a href="/notice/view?BBS_NO=124">정시 모집요강</a></td><td class="date">날짜없음</td></tr>
                </table>
                """;

        List<CollectedItem> items = parser.parse(board, html.getBytes(StandardCharsets.UTF_8));

        assertThat(items).isEmpty();
    }

    @Test
    void 글번호와_게시일_누락은_진단_사유로_반환한다() {
        UniversityBoardProperties.Board board = board("yyyy.MM.dd", "BBS_NO=(\\d+)", List.of());
        String html = """
                <table>
                  <tr><td class="title"><a href="/notice/view">수시 모집요강</a></td><td class="date">2026.09.14</td></tr>
                  <tr><td class="title"><a href="/notice/view?BBS_NO=124">정시 모집요강</a></td><td class="date">날짜없음</td></tr>
                </table>
                """;

        UniversityBoardParser.ParseResult result = parser.parseWithDiagnostics(
                board, html.getBytes(StandardCharsets.UTF_8));

        assertThat(result.items()).isEmpty();
        assertThat(result.skipReasons()).containsExactly(
                "test-board: missing article id for title '수시 모집요강'",
                "test-board: invalid date '날짜없음' for title '정시 모집요강'");
    }

    private UniversityBoardProperties.Board board(String dateFormat, String postIdPattern, List<String> keywords) {
        return new UniversityBoardProperties.Board(
                "test-board", "테스트 대학", URI.create("https://admission.example/notice/list"),
                StandardCharsets.UTF_8, "tr", ".title", "a", ".date",
                dateFormat, postIdPattern, keywords);
    }
}
