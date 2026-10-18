package com.nexuspm.issue.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class EmProjectRdSummaryResponse {

    private List<ProjectRow> projects;

    @Data
    @Builder
    public static class ProjectRow {
        private UUID projectId;
        private String projectName;
        private String emName;
        private UUID workCategoryId;
        private String workCategoryName;
        private List<Bucket> buckets;
        private long totalRd;
        private double totalEffort;
    }

    @Data
    @Builder
    public static class Bucket {
        private String key;
        private String label;
        private long rdCount;
        private double effort;
        private List<RdItem> rds;
    }

    @Data
    @Builder
    public static class RdItem {
        private UUID issueId;
        private String displayKey;
        private String title;
        private int statusSequence;
        private String statusName;
        private double effort;
    }
}
