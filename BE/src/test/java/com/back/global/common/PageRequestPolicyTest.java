package com.back.global.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PageRequestPolicyTest {

    @Test
    void 음수_페이지는_첫_페이지로_보정한다() {
        assertThat(PageRequestPolicy.of(-1, 20).getPageNumber()).isZero();
    }

    @Test
    void 유효하지_않은_크기는_기본값으로_보정한다() {
        assertThat(PageRequestPolicy.of(0, 0).getPageSize()).isEqualTo(20);
    }

    @Test
    void 최대_크기를_초과하면_50으로_보정한다() {
        assertThat(PageRequestPolicy.of(0, 51).getPageSize()).isEqualTo(50);
    }
}
