package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CapacityUtilisationDashboard {

    private UtilisationBands bands;
    private List<OverAllocatedPerson> overAllocated;
    private List<AvailablePerson> available;
    private List<GroupUtilisationBar> byEngineeringManager;
    private List<GroupUtilisationBar> byTeam;
    private AllocationHeatmap heatmap;
    private int peopleCount;
    private String asOf;
    private String heatmapFrom;
    private String heatmapTo;

    @Data
    @Builder
    public static class UtilisationBands {
        private Band zero;
        private Band low;
        private Band mid;
        private Band full;
        private Band over;
    }

    @Data
    @Builder
    public static class Band {
        private String key;
        private String label;
        private int count;
        private int pctOfPeople;
    }

    @Data
    @Builder
    public static class OverAllocatedPerson {
        private UUID employeeId;
        private String employeeName;
        private String engineeringManagerName;
        private String teamName;
        private int totalPct;
        private List<String> projects;
    }

    @Data
    @Builder
    public static class AvailablePerson {
        private UUID employeeId;
        private String employeeName;
        private String engineeringManagerName;
        private String teamName;
        private int allocatedPct;
        private int freePct;
    }

    @Data
    @Builder
    public static class GroupUtilisationBar {
        private String name;
        private int avgPct;
        private int peopleCount;
        private int overAllocatedCount;
        private List<GroupMember> allocatedMembers;
        private List<GroupMember> unallocatedMembers;
    }

    @Data
    @Builder
    public static class GroupMember {
        private UUID employeeId;
        private String employeeName;
        private String teamName;
        private String engineeringManagerName;
        private int allocatedPct;
        private int freePct;
        private List<String> projects;
    }

    @Data
    @Builder
    public static class AllocationHeatmap {
        private List<String> weekLabels;
        private List<String> weekStarts;
        private List<HeatmapRow> rows;
    }

    @Data
    @Builder
    public static class HeatmapRow {
        private String label;
        private List<Integer> values;
    }
}
