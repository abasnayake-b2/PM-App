package com.nexuspm.project.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class ProjectImportResult {

    private String fileName;
    private int created;
    private int updated;
    private int skipped;
    private List<String> errors;
    private String importedByName;
    private Instant importedAt;
}
