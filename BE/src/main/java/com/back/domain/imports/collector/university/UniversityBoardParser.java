package com.back.domain.imports.collector.university;

import com.back.domain.imports.collector.CollectedItem;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

@Component
public class UniversityBoardParser {

    public List<CollectedItem> parse(UniversityBoardProperties.Board board, byte[] body) {
        return parseWithDiagnostics(board, body).items();
    }

    public ParseResult parseWithDiagnostics(UniversityBoardProperties.Board board, byte[] body) {
        Document document = Jsoup.parse(new String(body, board.charset()), board.listUrl().toString());
        DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern(board.dateFormat());
        Pattern postIdPattern = Pattern.compile(board.postIdPattern());
        List<CollectedItem> items = new ArrayList<>();
        List<String> skipReasons = new ArrayList<>();
        for (Element row : document.select(board.rowSelector())) {
            Element titleElement = first(row, board.titleSelector());
            Element linkElement = first(titleElement == null ? row : titleElement, board.linkSelector());
            Element dateElement = first(row, board.dateSelector());
            if (titleElement == null || linkElement == null || dateElement == null) {
                skipReasons.add(board.code() + ": missing selector in row");
                continue;
            }
            String title = titleElement.text().trim();
            if (!matchesKeyword(board, title)) {
                continue;
            }
            String href = linkElement.attr("href");
            Matcher matcher = postIdPattern.matcher(href);
            if (!matcher.find()) {
                matcher = postIdPattern.matcher(linkElement.outerHtml());
                if (!matcher.find()) {
                    skipReasons.add(board.code() + ": missing article id for title '" + title + "'");
                    continue;
                }
            }
            LocalDate postedAt;
            try {
                postedAt = LocalDate.parse(dateElement.text().trim(), dateFormatter);
            } catch (RuntimeException e) {
                skipReasons.add(board.code() + ": invalid date '" + dateElement.text().trim()
                        + "' for title '" + title + "'");
                continue;
            }
            items.add(new CollectedItem(
                    board.code() + ":" + matcher.group(1),
                    board.name(),
                    sourceUrl(linkElement),
                    title,
                    null,
                    null,
                    postedAt,
                    null,
                    null,
                    null));
        }
        return new ParseResult(items, skipReasons);
    }

    private Element first(Element root, String selector) {
        if (root == null) {
            return null;
        }
        if (root.is(selector)) {
            return root;
        }
        return root.selectFirst(selector);
    }

    private String sourceUrl(Element linkElement) {
        String absoluteUrl = linkElement.absUrl("href");
        if (!absoluteUrl.isBlank()) {
            return absoluteUrl;
        }
        return linkElement.attr("href");
    }

    private boolean matchesKeyword(UniversityBoardProperties.Board board, String title) {
        return board.keywords().isEmpty() || board.keywords().stream().anyMatch(title::contains);
    }

    public record ParseResult(List<CollectedItem> items, List<String> skipReasons) {

        public ParseResult {
            items = List.copyOf(items);
            skipReasons = List.copyOf(skipReasons);
        }
    }
}
