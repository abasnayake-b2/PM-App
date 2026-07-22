package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class EmCapacityPlanDashboard {
    private int weeks;
    private String windowFrom;
    private String windowTo;
    private List<EmColumn> engineeringManagers;
    private List<MetricRow> rows;
    private EmColumnTotals totals;

    @Data
    @Builder
    public static class EmColumn {
        private UUID emId;
        private String emName;
        private String shortName;
        private int projectCount;
        private int existingResources;
        private int additionalResources;
        private int notChargeableCr;
        private double notChargeableEffort;
        private int chargeableCr;
        private double chargeableEffort;
        private int chargeableCrByExisting;
        private int chargeableCrByNew;
        private int totalCr;
        private double totalManDays;
    }

    @Data
    @Builder
    public static class MetricRow {
        private String key;
        private String label;
        private boolean summary;
        private boolean editable;
        private List<MetricCell> values;
        private MetricCell total;
    }

    @Data
    @Builder
    public static class MetricCell {
        private UUID emId;
        private Number value;
        private boolean blank;
    }

    @Data
    @Builder
    public static class EmColumnTotals {
        private int projectCount;
        private int existingResources;
        private int additionalResources;
        private int notChargeableCr;
        private double notChargeableEffort;
        private int chargeableCr;
        private double chargeableEffort;
        private int chargeableCrByExisting;
        private int chargeableCrByNew;
        private int totalCr;
        private double totalManDays;
    }
}
