package com.back.global.websocket;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class InMemoryPresenceRegistryTest {

    private final InMemoryPresenceRegistry registry = new InMemoryPresenceRegistry();

    @Test
    void 연결되면_온라인이고_같은_연결수만큼_해제해야_오프라인이_된다() {
        registry.connected(1L);
        registry.connected(1L); // 탭 2개
        assertThat(registry.isOnline(1L)).isTrue();

        registry.disconnected(1L); // 하나 끊김
        assertThat(registry.isOnline(1L)).isTrue(); // 아직 하나 남음

        registry.disconnected(1L); // 마지막 끊김
        assertThat(registry.isOnline(1L)).isFalse();
    }

    @Test
    void onlineAmong은_주어진_집합중_온라인만_돌려준다() {
        registry.connected(1L);
        registry.connected(3L);

        assertThat(registry.onlineAmong(Set.of(1L, 2L, 3L))).containsExactlyInAnyOrder(1L, 3L);
    }

    @Test
    void 과다_해제는_음수로_가지_않고_오프라인을_유지한다() {
        registry.disconnected(9L); // 연결 없던 회원
        assertThat(registry.isOnline(9L)).isFalse();
    }
}
