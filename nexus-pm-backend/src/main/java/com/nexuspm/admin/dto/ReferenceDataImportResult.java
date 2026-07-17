package com.nexuspm.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class ReferenceDataImportResult {

    private String fileName;
    private int departmentsCreated;
    private int departmentsUpdated;
    private int departmentsSkipped;
    private int streamsCreated;
    private int streamsUpdated;
    private int streamsSkipped;
    private int designationsCreated;
    private int designationsUpdated;
    private int designationsSkipped;
    private int skillsCreated;
    private int skillsUpdated;
    private int skillsSkipped;
    private List<String> errors;
    private String importedByName;
    private Instant importedAt;
}
