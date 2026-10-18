package com.nexuspm.admin.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class WorkCategoryRequest {

    @NotBlank
    private String name;

    private String description;

    @Min(1)
    private Integer sortOrder;

    private List<UUID> engineeringManagerManagementIds;
}
