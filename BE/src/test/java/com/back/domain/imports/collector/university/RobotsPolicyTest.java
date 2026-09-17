package com.back.domain.imports.collector.university;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import org.junit.jupiter.api.Test;

class RobotsPolicyTest {

    @Test
    void attaccaBot_그룹이_star보다_우선한다() {
        RobotsPolicy policy = RobotsPolicy.parse(URI.create("https://admission.example/robots.txt"), """
                User-agent: *
                Disallow: /

                User-agent: AttaccaBot
                Allow: /
                """);

        assertThat(policy.evaluate("AttaccaBot/1.0", URI.create("https://admission.example/notice/list")))
                .isEqualTo(RobotsPolicy.Decision.ALLOW);
    }

    @Test
    void 전용_그룹이_없으면_star_그룹을_적용한다() {
        RobotsPolicy policy = RobotsPolicy.parse(URI.create("https://admission.example/robots.txt"), """
                User-agent: *
                Disallow: /private
                """);

        assertThat(policy.evaluate("AttaccaBot/1.0", URI.create("https://admission.example/private/list")))
                .isEqualTo(RobotsPolicy.Decision.DISALLOW);
    }

    @Test
    void allow와_disallow가_겹치면_가장_긴_규칙이_이긴다() {
        RobotsPolicy policy = RobotsPolicy.parse(URI.create("https://admission.example/robots.txt"), """
                User-agent: AttaccaBot
                Disallow: /notice
                Allow: /notice/music
                """);

        assertThat(policy.evaluate("AttaccaBot", URI.create("https://admission.example/notice/music/list")))
                .isEqualTo(RobotsPolicy.Decision.ALLOW);
        assertThat(policy.evaluate("AttaccaBot", URI.create("https://admission.example/notice/general/list")))
                .isEqualTo(RobotsPolicy.Decision.DISALLOW);
    }

    @Test
    void 같은_길이의_allow와_disallow가_겹치면_allow가_이긴다() {
        RobotsPolicy policy = RobotsPolicy.parse(URI.create("https://admission.example/robots.txt"), """
                User-agent: AttaccaBot
                Disallow: /notice
                Allow: /notice
                """);

        assertThat(policy.evaluate("AttaccaBot", URI.create("https://admission.example/notice")))
                .isEqualTo(RobotsPolicy.Decision.ALLOW);
    }

    @Test
    void robots_404는_전체_허용으로_해석한다() {
        RobotsPolicy policy = RobotsPolicy.allowAll(URI.create("https://admission.example/robots.txt"));

        assertThat(policy.evaluate("AttaccaBot", URI.create("https://admission.example/blocked")))
                .isEqualTo(RobotsPolicy.Decision.ALLOW);
    }

    @Test
    void robots_5xx나_timeout은_호스트_건너뛰기로_해석한다() {
        RobotsPolicy policy = RobotsPolicy.skipHost(URI.create("https://admission.example/robots.txt"), "timeout");

        assertThat(policy.evaluate("AttaccaBot", URI.create("https://admission.example/notice/list")))
                .isEqualTo(RobotsPolicy.Decision.SKIP_HOST);
    }
}
