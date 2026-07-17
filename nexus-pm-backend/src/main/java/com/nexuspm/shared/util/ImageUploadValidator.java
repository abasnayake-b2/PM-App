package com.nexuspm.shared.util;

import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.Set;

public final class ImageUploadValidator {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
    );

    private ImageUploadValidator() {
    }

    public static void validate(MultipartFile file, DfnPmProperties properties) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("VALIDATION", "Image file is required", 400);
        }

        long maxBytes = properties.getStorage().getMaxPicBytes();
        if (file.getSize() > maxBytes) {
            long maxMb = Math.max(1, maxBytes / (1024 * 1024));
            throw new BusinessException("VALIDATION", "Image exceeds maximum size of " + maxMb + " MB", 400);
        }

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        String ext = extensionOf(fileName);
        if (ext == null || !ALLOWED_EXTENSIONS.contains(ext)) {
            throw new BusinessException("VALIDATION", "Only JPG, PNG, WEBP, or GIF images are supported", 400);
        }

        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";
        if (!contentType.isBlank() && !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new BusinessException("VALIDATION", "File must be an image (JPG, PNG, WEBP, or GIF)", 400);
        }
    }

    public static String extensionOf(String fileName) {
        if (fileName == null) {
            return null;
        }
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return null;
        }
        return fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public static String contentTypeForExtension(String ext) {
        if (ext == null) {
            return "application/octet-stream";
        }
        return switch (ext.toLowerCase(Locale.ROOT)) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            default -> "application/octet-stream";
        };
    }
}
