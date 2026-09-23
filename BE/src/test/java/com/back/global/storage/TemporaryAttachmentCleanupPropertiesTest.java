package com.back.global.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class TemporaryAttachmentCleanupPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfig.class);

    @Test
    void 임시_첨부_정리_설정을_바인딩한다() {
        runner.withPropertyValues(
                        "storage.temporary-cleanup.cron=0 15 * * * *",
                        "storage.temporary-cleanup.retention=PT24H",
                        "storage.temporary-cleanup.zone=Asia/Seoul")
                .run(context -> {
                    TemporaryAttachmentCleanupProperties properties =
                            context.getBean(TemporaryAttachmentCleanupProperties.class);

                    assertThat(properties.cron()).isEqualTo("0 15 * * * *");
                    assertThat(properties.retention()).isEqualTo(Duration.ofHours(24));
                    assertThat(properties.zone()).isEqualTo("Asia/Seoul");
                });
    }

    @Configuration
    @EnableConfigurationProperties(TemporaryAttachmentCleanupProperties.class)
    static class TestConfig {
    }
}
