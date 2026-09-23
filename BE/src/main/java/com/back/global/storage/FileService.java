package com.back.global.storage;

import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 파일 저장 파사드. key 생성 → {@link FileStorage} 저장 → {@link FileMetadata} 영속화를 한 트랜잭션으로 묶는다.
 * 도메인 서비스는 {@link FileStorage}가 아니라 이 클래스를 사용한다.
 *
 * <p>허용 contentType·최대 크기 같은 도메인별 정책은 검증하지 않는다.
 * 프로필 이미지가 이미지 타입만 받는지는 MEMBER 도메인이 판단할 일이다.
 * 전역 상한은 {@code spring.servlet.multipart.max-file-size}로 건다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FileService {

    private static final String ATTACHMENT_DIRECTORY = "attachments";
    private static final int MAX_ATTACHMENT_COUNT = 5;

    private final FileStorage fileStorage;
    private final FileMetadataRepository fileMetadataRepository;
    private final AttachmentFilePolicy attachmentFilePolicy;

    @Transactional
    public StoredFile upload(MultipartFile file, String directory, Long uploaderId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_FILE);
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_FILE);
        }
        String key = generateKey(directory, originalName);

        try (InputStream content = file.getInputStream()) {
            fileStorage.upload(key, content, file.getSize(), file.getContentType());
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED, e);
        }

        FileMetadata saved = fileMetadataRepository.save(FileMetadata.createAttached(
                key, originalName, file.getContentType(), file.getSize(), uploaderId));

        return new StoredFile(saved.getId(), key, fileStorage.getUrl(key));
    }

    @Transactional
    public StoredFile upload(byte[] content, String contentType, String originalName,
            String directory, long uploaderId) {
        if (content == null || content.length == 0 || contentType == null
                || !contentType.startsWith("image/") || originalName == null || originalName.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_FILE);
        }
        String key = generateKey(directory, originalName);
        try (InputStream input = new ByteArrayInputStream(content)) {
            fileStorage.upload(key, input, content.length, contentType);
        } catch (IOException | RuntimeException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED, e);
        }
        FileMetadata saved = fileMetadataRepository.save(FileMetadata.createAttached(
                key, originalName, contentType, content.length, uploaderId));
        return new StoredFile(saved.getId(), key, fileStorage.getUrl(key));
    }

    /**
     * 피드·구인 작성 화면에서 먼저 저장하는 첨부 파일을 만든다.
     * 이 파일은 도메인 엔티티가 {@link #claimTemporaryFiles(List, Long)}로 귀속하기 전까지
     * {@link AttachmentState#TEMPORARY} 상태로 남는다.
     */
    @Transactional
    public StoredFile uploadTemporary(MultipartFile file, Long uploaderId) {
        if (uploaderId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        attachmentFilePolicy.validate(file);

        String originalName = file.getOriginalFilename();
        String key = generateKey(ATTACHMENT_DIRECTORY, originalName);
        try (InputStream content = file.getInputStream()) {
            fileStorage.upload(key, content, file.getSize(), file.getContentType());
        } catch (IOException | RuntimeException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED, e);
        }

        try {
            FileMetadata saved = fileMetadataRepository.saveAndFlush(FileMetadata.createTemporary(
                    key, originalName, file.getContentType(), file.getSize(), uploaderId));
            return new StoredFile(saved.getId(), key, fileStorage.getUrl(key));
        } catch (RuntimeException e) {
            deleteStorageQuietly(key);
            throw e;
        }
    }

    /**
     * 작성자가 선택한 임시 첨부를 검증한 뒤 귀속 상태로 전환한다.
     * 관계 엔티티 생성은 호출 도메인이 담당해 global-storage가 feed/recruitment를 알 필요가 없다.
     */
    @Transactional
    public List<FileMetadata> claimTemporaryFiles(List<Long> attachmentIds, Long uploaderId) {
        List<Long> ids = attachmentIds == null ? List.of() : List.copyOf(attachmentIds);
        if (ids.size() > MAX_ATTACHMENT_COUNT) {
            throw new BusinessException(ErrorCode.ATTACHMENT_LIMIT_EXCEEDED);
        }
        if (ids.stream().anyMatch(Objects::isNull) || new HashSet<>(ids).size() != ids.size()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }
        if (ids.isEmpty()) {
            return List.of();
        }

        Map<Long, FileMetadata> filesById = new HashMap<>();
        for (FileMetadata metadata : fileMetadataRepository.findAllById(ids)) {
            filesById.put(metadata.getId(), metadata);
        }
        if (filesById.size() != ids.size()) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }

        List<FileMetadata> files = ids.stream().map(filesById::get).toList();
        for (FileMetadata metadata : files) {
            if (!Objects.equals(metadata.getUploaderId(), uploaderId)) {
                throw new BusinessException(ErrorCode.ATTACHMENT_NOT_OWNED);
            }
            if (!metadata.isTemporary()) {
                throw new BusinessException(ErrorCode.ATTACHMENT_NOT_TEMPORARY);
            }
        }
        files.forEach(FileMetadata::attach);
        return files;
    }

    /**
     * 게시글에 귀속되지 않은 만료 임시 첨부를 정리한다.
     * 파일별로 실패를 격리해 하나의 스토리지 오류가 나머지 고아 파일 정리를 막지 않는다.
     */
    public int deleteExpiredTemporaryFiles(LocalDateTime cutoff) {
        int deletedCount = 0;
        for (FileMetadata metadata : fileMetadataRepository
                .findByStateAndCreatedAtBefore(AttachmentState.TEMPORARY, cutoff)) {
            try {
                fileStorage.delete(metadata.getStorageKey());
                fileMetadataRepository.delete(metadata);
                deletedCount++;
            } catch (RuntimeException e) {
                log.warn("만료 임시 첨부 정리에 실패했습니다. fileMetadataId={}", metadata.getId(), e);
            }
        }
        return deletedCount;
    }

    /**
     * 저장된 파일을 지운다. 메타데이터에 없는 key는 호출 측 실수이므로 알린다.
     * 반면 그 아래 {@link FileStorage#delete}는 물리 파일이 이미 없어도 조용히 넘어간다(멱등).
     */
    @Transactional
    public void delete(String storageKey) {
        FileMetadata metadata = fileMetadataRepository.findByStorageKey(storageKey)
                .orElseThrow(() -> new BusinessException(ErrorCode.FILE_NOT_FOUND));

        fileStorage.delete(storageKey);
        fileMetadataRepository.delete(metadata);
    }

    public String getUrl(String storageKey) {
        return fileStorage.getUrl(storageKey);
    }

    /**
     * key 형식: {@code {디렉터리}/{yyyy}/{MM}/{dd}/{UUID}.{확장자}}
     *
     * <p>날짜를 접두사로 넣어 나중에 오래된 파일을 접두사로 골라낼 수 있게 한다.
     * 원본 파일명은 key에 넣지 않는다 — 한글·공백·특수문자가 URL로 새어나가기 때문이다.
     */
    private static String generateKey(String directory, String originalName) {
        LocalDate today = LocalDate.now();
        return "%s/%04d/%02d/%02d/%s%s".formatted(
                directory,
                today.getYear(), today.getMonthValue(), today.getDayOfMonth(),
                UUID.randomUUID(), extensionOf(originalName));
    }

    /** 확장자를 점을 포함해 반환한다(예: {@code .png}). 확장자가 없으면 빈 문자열. */
    private static String extensionOf(String originalName) {
        if (originalName == null) {
            return "";
        }
        int dot = originalName.lastIndexOf('.');
        if (dot <= 0 || dot == originalName.length() - 1) {
            return "";
        }
        return originalName.substring(dot).toLowerCase(Locale.ROOT);
    }

    private void deleteStorageQuietly(String key) {
        try {
            fileStorage.delete(key);
        } catch (RuntimeException ignored) {
            // 메타데이터 저장 실패를 가리지는 않는다. 고아 파일은 이후 정리 작업의 대상이 된다.
        }
    }
}
