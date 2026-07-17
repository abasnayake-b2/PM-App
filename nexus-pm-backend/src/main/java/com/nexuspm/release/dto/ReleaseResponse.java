package com.nexuspm.release.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class ReleaseResponse {

    private UUID id;
    private UUID projectId;
    private String projectName;
    private String name;
    private String version;
    private String status;
    private LocalDate targetDate;
}
