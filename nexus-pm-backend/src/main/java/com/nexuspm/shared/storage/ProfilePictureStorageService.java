package com.nexuspm.shared.storage;

import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.util.ImageUploadValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.UUID;

/**
 * Stores employee profile pictures under a configurable Pic/ directory
 * (same relative-path style as logs/).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProfilePictureStorageService {

    private final DfnPmProperties properties;

    /**
     * Relative authenticated API path for an employee's roster photo, or null if none.
     */
    public static String memberPhotoUrl(UUID employeeId, String filename, Instant updatedAt) {
        if (employeeId == null || filename == null || filename.isBlank()) {
            return null;
        }
        String version = filename;
        if (updatedAt != null) {
            version = filename + "-" + updatedAt.toEpochMilli();
        }
        return "/team-roster/members/" + employeeId + "/photo?v=" + version;
    }

    public Path picDirectory() {
        return Path.of(properties.getStorage().getPicDir()).toAbsolutePath().normalize();
    }

    public String store(UUID employeeId, MultipartFile file) {
        ImageUploadValidator.validate(file, properties);
        String ext = ImageUploadValidator.extensionOf(file.getOriginalFilename());
        if (ext == null) {
            throw new BusinessException("VALIDATION", "Image file must have an extension", 400);
        }
        if ("jpeg".equals(ext)) {
            ext = "jpg";
        }

        Path dir = picDirectory();
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            log.error("Failed to create Pic directory {}", dir, e);
            throw new BusinessException("STORAGE", "Could not create Pic directory", 500);
        }

        String filename = employeeId + "." + ext;
        Path target = dir.resolve(filename).normalize();
        if (!target.startsWith(dir)) {
            throw new BusinessException("VALIDATION", "Invalid profile picture path", 400);
        }

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("Failed to store profile picture {}", target, e);
            throw new BusinessException("STORAGE", "Could not save profile picture", 500);
        }
        return filename;
    }

    public void deleteIfPresent(String filename) {
        if (filename == null || filename.isBlank()) {
            return;
        }
        Path dir = picDirectory();
        Path target = dir.resolve(filename).normalize();
        if (!target.startsWith(dir)) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException e) {
            log.warn("Failed to delete profile picture {}", target, e);
        }
    }

    public Path resolveExisting(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new BusinessException("NOT_FOUND", "Profile picture not found", 404);
        }
        Path dir = picDirectory();
        Path target = dir.resolve(filename).normalize();
        if (!target.startsWith(dir) || !Files.isRegularFile(target)) {
            throw new BusinessException("NOT_FOUND", "Profile picture not found", 404);
        }
        return target;
    }
}
