package com.back.global.storage;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class AttachmentFilePolicyTest {

    private final AttachmentFilePolicy policy = new AttachmentFilePolicy();

    @Test
    void JPG_PNG_WebP_PDF를_허용한다() {
        assertThatCode(() -> policy.validate(file("photo.jpg", "image/jpeg",
                new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00})))
                .doesNotThrowAnyException();
        assertThatCode(() -> policy.validate(file("photo.png", "image/png",
                new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A})))
                .doesNotThrowAnyException();
        assertThatCode(() -> policy.validate(file("photo.webp", "image/webp",
                new byte[] {0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
                        0x57, 0x45, 0x42, 0x50})))
                .doesNotThrowAnyException();
        assertThatCode(() -> policy.validate(file("document.pdf", "application/pdf",
                new byte[] {0x25, 0x50, 0x44, 0x46, 0x2D})))
                .doesNotThrowAnyException();
    }

    @Test
    void 선언한_MIME과_실제_바이트_서명이_다르면_거절한다() {
        MockMultipartFile forgedPng = file("forged.png", "image/png",
                new byte[] {0x25, 0x50, 0x44, 0x46, 0x2D});

        assertThatThrownBy(() -> policy.validate(forgedPng))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_ATTACHMENT_TYPE);
    }

    @Test
    void 지원하지_않는_형식은_거절한다() {
        MockMultipartFile text = file("memo.txt", "text/plain", "memo".getBytes());

        assertThatThrownBy(() -> policy.validate(text))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_ATTACHMENT_TYPE);
    }

    @Test
    void 파일당_10MB를_초과하면_거절한다() {
        MockMultipartFile oversized = file("large.pdf", "application/pdf",
                new byte[10 * 1024 * 1024 + 1]);

        assertThatThrownBy(() -> policy.validate(oversized))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.ATTACHMENT_TOO_LARGE);
    }

    private static MockMultipartFile file(String name, String contentType, byte[] content) {
        return new MockMultipartFile("file", name, contentType, content);
    }
}
