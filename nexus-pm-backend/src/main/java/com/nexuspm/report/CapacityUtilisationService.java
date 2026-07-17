package com.nexuspm.report;

import com.nexuspm.report.dto.CapacityUtilisationDashboard;
import com.nexuspm.report.dto.CapacityUtilisationDashboard.AllocationHeatmap;
import com.nexuspm.report.dto.CapacityUtilisationDashboard.AvailablePerson;
import com.nexuspm.report.dto.CapacityUtilisationDashboard.Band;
import com.nexuspm.report.dto.CapacityUtilisationDashboard.GroupMember;
import com.nexuspm.report.dto.CapacityUtilisationDashboard.GroupUtilisationBar;
import com.nexuspm.report.dto.CapacityUtilisationDashboard.HeatmapRow;
import com.nexuspm.report.dto.CapacityUtilisationDashboard.OverAllocatedPerson;
import com.nexuspm.report.dto.CapacityUtilisationDashboard.UtilisationBands;
import com.nexuspm.resource.AllocationService;
import com.nexuspm.resource.dto.AllocationResponse;
import com.nexuspm.resource.dto.CapacityResponse;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CapacityUtilisationService {

    private static final int DEFAULT_HEATMAP_WEEKS = 12;
    private static final int MIN_HEATMAP_WEEKS = 1;
    private static final int MAX_HEATMAP_WEEKS = 52;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE;

    private final AllocationService allocationService;

    @Transactional(readOnly = true)
    public CapacityUtilisationDashboard getDashboard(Integer weeksParam) {
        if (!SecurityUtils.isManagerOrAbove()) {
            throw new BusinessException("ACCESS_DENIED", "Only managers can view capacity utilisation", 403);
        }

        int heatmapWeeks = normalizeWeeks(weeksParam);
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate heatmapEnd = weekStart.plusWeeks(heatmapWeeks).minusDays(1);

        List<CapacityResponse> capacity = allocationService.getCapacity(
                weekStart, heatmapEnd, today, null, null, null, null);

        List<WeekWindow> weeks = buildWeeks(weekStart, heatmapWeeks);

        return CapacityUtilisationDashboard.builder()
                .bands(buildBands(capacity, weeks))
                .overAllocated(buildOverAllocated(capacity))
                .available(buildAvailable(capacity))
                .byEngineeringManager(buildGroupBars(capacity, true, weeks))
                .byTeam(buildGroupBars(capacity, false, weeks))
                .heatmap(buildHeatmap(capacity, weeks))
                .peopleCount(capacity.size())
                .asOf(ISO.format(today))
                .heatmapFrom(ISO.format(weekStart))
                .heatmapTo(ISO.format(heatmapEnd))
                .build();
    }

    private static int normalizeWeeks(Integer weeksParam) {
        if (weeksParam == null) {
            return DEFAULT_HEATMAP_WEEKS;
        }
        return Math.max(MIN_HEATMAP_WEEKS, Math.min(MAX_HEATMAP_WEEKS, weeksParam));
    }

    private UtilisationBands buildBands(List<CapacityResponse> capacity, List<WeekWindow> weeks) {
        int total = Math.max(1, capacity.size());
        int zero = 0;
        int low = 0;
        int mid = 0;
        int full = 0;
        int over = 0;

        for (CapacityResponse row : capacity) {
            int pct = periodAveragePct(row, weeks);
            if (pct <= 0) {
                zero++;
            } else if (pct <= 50) {
                low++;
            } else if (pct < 100) {
                mid++;
            } else if (pct == 100) {
                full++;
            } else {
                over++;
            }
        }

        return UtilisationBands.builder()
                .zero(band("zero", "0%", zero, total))
                .low(band("low", "1–50%", low, total))
                .mid(band("mid", "51–99%", mid, total))
                .full(band("full", "100%", full, total))
                .over(band("over", ">100%", over, total))
                .build();
    }

    private static Band band(String key, String label, int count, int totalPeople) {
        return Band.builder()
                .key(key)
                .label(label)
                .count(count)
                .pctOfPeople((int) Math.round(count * 100.0 / totalPeople))
                .build();
    }

    private List<OverAllocatedPerson> buildOverAllocated(List<CapacityResponse> capacity) {
        return capacity.stream()
                .filter(row -> snapshotPct(row) > 100)
                .sorted(Comparator.comparingInt(CapacityUtilisationService::snapshotPct).reversed())
                .limit(20)
                .map(row -> OverAllocatedPerson.builder()
                        .employeeId(row.getEmployeeId())
                        .employeeName(row.getEmployeeName())
                        .engineeringManagerName(row.getEngineeringManagerName())
                        .teamName(row.getDepartmentName())
                        .totalPct(snapshotPct(row))
                        .projects(snapshotAllocations(row).stream()
                                .map(AllocationResponse::getProjectName)
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList())
                        .build())
                .toList();
    }

    private List<AvailablePerson> buildAvailable(List<CapacityResponse> capacity) {
        return capacity.stream()
                .map(row -> {
                    int allocated = snapshotPct(row);
                    int free = Math.max(0, 100 - allocated);
                    return AvailablePerson.builder()
                            .employeeId(row.getEmployeeId())
                            .employeeName(row.getEmployeeName())
                            .engineeringManagerName(row.getEngineeringManagerName())
                            .teamName(row.getDepartmentName())
                            .allocatedPct(allocated)
                            .freePct(free)
                            .build();
                })
                .filter(person -> person.getFreePct() > 0)
                .sorted(Comparator.comparingInt(AvailablePerson::getFreePct).reversed()
                        .thenComparing(AvailablePerson::getEmployeeName, String.CASE_INSENSITIVE_ORDER))
                .limit(20)
                .toList();
    }

    private List<GroupUtilisationBar> buildGroupBars(
            List<CapacityResponse> capacity, boolean byEm, List<WeekWindow> weeks) {
        Map<String, List<CapacityResponse>> grouped = capacity.stream()
                .collect(Collectors.groupingBy(
                        row -> {
                            String name = byEm ? row.getEngineeringManagerName() : row.getDepartmentName();
                            if (name == null || name.isBlank()) {
                                return byEm ? "Unassigned EM" : "Unassigned team";
                            }
                            return name.trim();
                        },
                        LinkedHashMap::new,
                        Collectors.toList()));

        return grouped.entrySet().stream()
                .map(entry -> {
                    List<CapacityResponse> people = entry.getValue();
                    int avg = (int) Math.round(people.stream()
                            .mapToInt(row -> periodAveragePct(row, weeks))
                            .average()
                            .orElse(0));
                    int over = (int) people.stream()
                            .filter(row -> periodPeakPct(row, weeks) > 100)
                            .count();

                    List<GroupMember> allocated = people.stream()
                            .filter(row -> periodAveragePct(row, weeks) > 0 || hasPeriodAllocation(row))
                            .sorted(Comparator
                                    .comparingInt((CapacityResponse row) -> periodAveragePct(row, weeks))
                                    .reversed()
                                    .thenComparing(CapacityResponse::getEmployeeName, String.CASE_INSENSITIVE_ORDER))
                            .map(row -> toGroupMember(row, weeks))
                            .toList();
                    List<GroupMember> unallocated = people.stream()
                            .filter(row -> periodAveragePct(row, weeks) <= 0 && !hasPeriodAllocation(row))
                            .sorted(Comparator.comparing(CapacityResponse::getEmployeeName, String.CASE_INSENSITIVE_ORDER))
                            .map(row -> toGroupMember(row, weeks))
                            .toList();

                    return GroupUtilisationBar.builder()
                            .name(entry.getKey())
                            .avgPct(avg)
                            .peopleCount(people.size())
                            .overAllocatedCount(over)
                            .allocatedMembers(allocated)
                            .unallocatedMembers(unallocated)
                            .build();
                })
                .sorted(Comparator.comparingInt(GroupUtilisationBar::getAvgPct).reversed()
                        .thenComparing(GroupUtilisationBar::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private GroupMember toGroupMember(CapacityResponse row, List<WeekWindow> weeks) {
        int allocated = periodAveragePct(row, weeks);
        List<AllocationResponse> period = periodAllocations(row);
        return GroupMember.builder()
                .employeeId(row.getEmployeeId())
                .employeeName(row.getEmployeeName())
                .teamName(row.getDepartmentName())
                .engineeringManagerName(row.getEngineeringManagerName())
                .allocatedPct(allocated)
                .freePct(Math.max(0, 100 - allocated))
                .projects(period.stream()
                        .map(AllocationResponse::getProjectName)
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList())
                .build();
    }

    private AllocationHeatmap buildHeatmap(List<CapacityResponse> capacity, List<WeekWindow> weeks) {
        Map<String, List<CapacityResponse>> byEm = capacity.stream()
                .collect(Collectors.groupingBy(
                        row -> {
                            String em = row.getEngineeringManagerName();
                            return em == null || em.isBlank() ? "Unassigned EM" : em.trim();
                        },
                        LinkedHashMap::new,
                        Collectors.toList()));

        List<HeatmapRow> rows = new ArrayList<>();
        rows.add(HeatmapRow.builder()
                .label("All")
                .values(weeks.stream()
                        .map(week -> averageWeekPct(capacity, week))
                        .toList())
                .build());

        byEm.entrySet().stream()
                .sorted(Comparator.comparing(Map.Entry::getKey, String.CASE_INSENSITIVE_ORDER))
                .forEach(entry -> rows.add(HeatmapRow.builder()
                        .label(entry.getKey())
                        .values(weeks.stream()
                                .map(week -> averageWeekPct(entry.getValue(), week))
                                .toList())
                        .build()));

        return AllocationHeatmap.builder()
                .weekLabels(weeks.stream().map(WeekWindow::label).toList())
                .weekStarts(weeks.stream().map(w -> ISO.format(w.start())).toList())
                .rows(rows)
                .build();
    }

    private static int periodAveragePct(CapacityResponse row, List<WeekWindow> weeks) {
        if (weeks == null || weeks.isEmpty()) {
            return snapshotPct(row);
        }
        return (int) Math.round(weeks.stream()
                .mapToInt(week -> weekPct(row, week))
                .average()
                .orElse(0));
    }

    private static int periodPeakPct(CapacityResponse row, List<WeekWindow> weeks) {
        if (weeks == null || weeks.isEmpty()) {
            return snapshotPct(row);
        }
        return weeks.stream().mapToInt(week -> weekPct(row, week)).max().orElse(0);
    }

    private static boolean hasPeriodAllocation(CapacityResponse row) {
        return !periodAllocations(row).isEmpty();
    }

    private static int averageWeekPct(List<CapacityResponse> people, WeekWindow week) {
        if (people.isEmpty()) {
            return 0;
        }
        return (int) Math.round(people.stream()
                .mapToInt(row -> weekPct(row, week))
                .average()
                .orElse(0));
    }

    private static int weekPct(CapacityResponse row, WeekWindow week) {
        return periodAllocations(row).stream()
                .filter(allocation -> overlaps(allocation, week.start(), week.end()))
                .mapToInt(a -> a.getPercentage() != null ? a.getPercentage() : 0)
                .sum();
    }

    private static boolean overlaps(AllocationResponse allocation, LocalDate weekStart, LocalDate weekEnd) {
        LocalDate from = allocation.getFromDate();
        LocalDate to = allocation.getToDate();
        if (from == null) {
            return false;
        }
        if (from.isAfter(weekEnd)) {
            return false;
        }
        return to == null || !to.isBefore(weekStart);
    }

    private static List<WeekWindow> buildWeeks(LocalDate weekStart, int count) {
        List<WeekWindow> weeks = new ArrayList<>();
        LocalDate cursor = weekStart;
        for (int i = 0; i < count; i++) {
            LocalDate end = cursor.plusDays(6);
            String label = cursor.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                    + " " + cursor.getDayOfMonth();
            weeks.add(new WeekWindow(cursor, end, label));
            cursor = cursor.plusWeeks(1);
        }
        return weeks;
    }

    private static int snapshotPct(CapacityResponse row) {
        return row.getTotalPercentage();
    }

    private static List<AllocationResponse> snapshotAllocations(CapacityResponse row) {
        return row.getAllocations() != null ? row.getAllocations() : List.of();
    }

    private static List<AllocationResponse> periodAllocations(CapacityResponse row) {
        if (row.getPeriodAllocations() != null && !row.getPeriodAllocations().isEmpty()) {
            return row.getPeriodAllocations();
        }
        return snapshotAllocations(row);
    }

    private record WeekWindow(LocalDate start, LocalDate end, String label) {
    }
}
