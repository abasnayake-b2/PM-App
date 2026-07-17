package com.nexuspm.issue.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class CrStatusMatrixResponse {
    private List<StatusColumn> statuses;
    private List<MatrixRow> rows;
    private MatrixTotals totals;

    @Data
    @Builder
    public static class StatusColumn {
        private UUID id;
        private String name;
        private int sequence;
        private boolean terminal;
        private String colour;
    }

    @Data
    @Builder
    public static class MatrixRow {
        private UUID projectId;
        private String projectName;
        private String emName;
        private String architectName;
        private String countryName;
        private String clientName;
        private String product;
        private String pmName;
        /** Delivery manager — not modelled yet; always null/empty. */
        private String dmName;
        private long totalCr;
        private long activeCr;
        /** statusId → count */
        private Map<UUID, Long> statusCounts;
    }

    @Data
    @Builder
    public static class MatrixTotals {
        private long totalCr;
        private long activeCr;
        private Map<UUID, Long> statusCounts;
    }
}
