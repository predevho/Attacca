package com.back.global.storage;

import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/** 게시글 첨부의 형식·크기·바이트 서명 검증만 담당한다. */
@Component
public class AttachmentFilePolicy {

    public static final long MAX_FILE_SIZE_BYTES = 10L * 1024 * 1024;

    private static final byte[] JPEG_SIGNATURE = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_SIGNATURE = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    };
    private static final byte[] PDF_SIGNATURE = {0x25, 0x50, 0x44, 0x46, 0x2D};
    private static final byte[] RIFF_SIGNATURE = {0x52, 0x49, 0x46, 0x46};
    private static final byte[] WEBP_SIGNATURE = {0x57, 0x45, 0x42, 0x50};

    public void validate(MultipartFile file) {
        if (file == null || file.isEmpty() || isBlank(file.getOriginalFilename())) {
            throw new BusinessException(ErrorCode.INVALID_FILE);
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new BusinessException(ErrorCode.ATTACHMENT_TOO_LARGE);
        }

        AttachmentType type = AttachmentType.from(file.getContentType(), file.getOriginalFilename())
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_ATTACHMENT_TYPE));

        try (InputStream input = file.getInputStream()) {
            if (!type.hasMatchingSignature(input.readNBytes(12))) {
                throw new BusinessException(ErrorCode.INVALID_ATTACHMENT_TYPE);
            }
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED, e);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private enum AttachmentType {
        JPEG("image/jpeg", Set.of(".jpg", ".jpeg")),
        PNG("image/png", Set.of(".png")),
        WEBP("image/webp", Set.of(".webp")),
        PDF("application/pdf", Set.of(".pdf"));

        private final String contentType;
        private final Set<String> extensions;

        AttachmentType(String contentType, Set<String> extensions) {
            this.contentType = contentType;
            this.extensions = extensions;
        }

        static java.util.Optional<AttachmentType> from(String rawContentType, String originalName) {
            if (rawContentType == null || originalName == null) {
                return java.util.Optional.empty();
            }
            String contentType = rawContentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
            String extension = extensionOf(originalName);
            for (AttachmentType type : values()) {
                if (type.contentType.equals(contentType) && type.extensions.contains(extension)) {
                    return java.util.Optional.of(type);
                }
            }
            return java.util.Optional.empty();
        }

        boolean hasMatchingSignature(byte[] prefix) {
            return switch (this) {
                case JPEG -> startsWith(prefix, JPEG_SIGNATURE);
                case PNG -> startsWith(prefix, PNG_SIGNATURE);
                case PDF -> startsWith(prefix, PDF_SIGNATURE);
                case WEBP -> startsWith(prefix, RIFF_SIGNATURE)
                        && hasBytesAt(prefix, 8, WEBP_SIGNATURE);
            };
        }

        private static String extensionOf(String originalName) {
            int dot = originalName.lastIndexOf('.');
            if (dot <= 0 || dot == originalName.length() - 1) {
                return "";
            }
            return originalName.substring(dot).toLowerCase(Locale.ROOT);
        }

        private static boolean startsWith(byte[] value, byte[] prefix) {
            return hasBytesAt(value, 0, prefix);
        }

        private static boolean hasBytesAt(byte[] value, int start, byte[] expected) {
            if (value.length < start + expected.length) {
                return false;
            }
            for (int i = 0; i < expected.length; i++) {
                if (value[start + i] != expected[i]) {
                    return false;
                }
            }
            return true;
        }
    }
}
