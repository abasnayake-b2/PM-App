package com.nexuspm.shared.util;

import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;

public final class ExcelUploadValidator {

    private ExcelUploadValidator() {
    }

    public static void validate(MultipartFile file, DfnPmProperties properties) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("VALIDATION", "Excel file is required", 400);
        }

        long maxBytes = properties.getSecurity().getMaxUploadBytes();
        if (file.getSize() > maxBytes) {
            long maxMb = maxBytes / (1024 * 1024);
            throw new BusinessException("VALIDATION", "File exceeds maximum size of " + maxMb + " MB", 400);
        }

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
            throw new BusinessException("VALIDATION", "Only .xlsx or .xls files are supported", 400);
        }
    }
}
