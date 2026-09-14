package com.back.domain.imports.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.imports.config.ImportProperties;
import java.util.List;
import org.junit.jupiter.api.Test;

class PosterDownloaderTest {
    private final PosterDownloader downloader = new PosterDownloader(new ImportProperties(
            new ImportProperties.Kopis("https://example.com", "", "CCCA", 56, 28, 100,
                    List.of("www.kopis.or.kr"))));

    @Test
    void 허용되지_않은_호스트와_스킴은_다운로드하지_않는다() {
        assertThat(downloader.download("https://evil.example/poster.png")).isNull();
        assertThat(downloader.download("file:///tmp/poster.png")).isNull();
    }
}
