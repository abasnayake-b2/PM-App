package com.nexuspm.lookup.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class WorkCategoryResponse {

    private UUID id;
    private String name;
    private String description;
    private Integer sortOrder;
    private UUID functionalUnitCategoryId;
    private String functionalUnitCategoryName;
    private List<ManagerItem> engineeringManagers;
    private String createdByName;
    private String updatedByName;

    @Data
    @Builder
    public static class ManagerItem {
        private UUID id;
        private String name;
        private String roleTitle;
    }
}
