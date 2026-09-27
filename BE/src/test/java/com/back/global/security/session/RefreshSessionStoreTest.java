package com.back.global.security.session;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RefreshSessionStoreTest {

    private InMemoryRefreshSessionStore store;

    @BeforeEach
    void setUp() {
        store = new InMemoryRefreshSessionStore(Duration.ofDays(14));
    }

    @Test
    void 생성한_세션은_회원과_연결되고_원문은_저장키에_포함되지_않는다() {
        String raw = store.create(3L);

        assertThat(store.findMemberId(raw)).contains(3L);
        assertThat(store.debugKeys()).noneMatch(key -> key.contains(raw));
    }

    @Test
    void 재발급_조회는_세션_ttl을_연장하지_않는다() {
        String raw = store.create(3L);
        Duration before = store.remainingTtl(raw);

        store.findMemberId(raw);

        assertThat(store.remainingTtl(raw)).isLessThanOrEqualTo(before);
    }

    @Test
    void 개별_세션과_회원의_모든_세션을_철회할_수_있다() {
        String first = store.create(3L);
        String second = store.create(3L);

        assertThat(store.revoke(first)).isTrue();
        assertThat(store.findMemberId(first)).isEmpty();
        assertThat(store.findMemberId(second)).contains(3L);

        store.revokeAll(3L);

        assertThat(store.findMemberId(second)).isEmpty();
    }
}
