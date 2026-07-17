package com.nexuspm.resource;

import com.nexuspm.resource.dto.AllocationResponse;
import com.nexuspm.resource.dto.CapacityResponse;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.ClientAnchor;
import org.apache.poi.ss.usermodel.Comment;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.Drawing;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.DefaultIndexedColorMap;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AllocationTimelineExportService {

    private static final int COL_EM = 0;
    private static final int COL_RESOURCE = 1;
    private static final int COL_DESIGNATION = 2;
    private static final int COL_TEAM = 3;
    private static final int COL_ROLE = 4;
    private static final int FIRST_WEEK_COL = 5;
    private static final int HEADER_ROWS = 2;

    private static final IndexedColors[] BAR_COLORS = {
            IndexedColors.ROYAL_BLUE,
            IndexedColors.GREEN,
            IndexedColors.ORCHID,
            IndexedColors.GOLD,
            IndexedColors.ORANGE,
            IndexedColors.TEAL,
            IndexedColors.PINK,
            IndexedColors.GREY_50_PERCENT,
            IndexedColors.BROWN,
    };

    private final AllocationService allocationService;

    @Transactional(readOnly = true)
    public byte[] exportTimeline(
            LocalDate from,
            LocalDate to,
            LocalDate asOf,
            String team,
            String designationCode,
            String engineeringManager,
            String name) throws IOException {

        LocalDate rangeStart = from != null ? from : LocalDate.now().withDayOfMonth(1);
        LocalDate rangeEnd = to != null
                ? to
                : rangeStart.plusMonths(5).withDayOfMonth(rangeStart.plusMonths(5).lengthOfMonth());

        List<CapacityResponse> capacity = allocationService.getCapacity(
                rangeStart, rangeEnd, asOf, team, designationCode, engineeringManager, name);

        List<CapacityResponse> sorted = capacity.stream()
                .sorted(Comparator
                        .comparing((CapacityResponse r) -> nullToEmpty(r.getVpName()).toUpperCase(Locale.ROOT))
                        .thenComparing(r -> nullToEmpty(r.getEngineeringManagerName()).toUpperCase(Locale.ROOT))
                        .thenComparing(r -> nullToEmpty(r.getEmployeeName()), String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<WeekColumn> weeks = buildWeeks(rangeStart, rangeEnd);

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            writeGanttSheet((XSSFWorkbook) workbook, sorted, weeks, rangeStart, rangeEnd);
            writeDetailSheet(workbook, sorted);
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private void writeGanttSheet(
            XSSFWorkbook workbook,
            List<CapacityResponse> capacity,
            List<WeekColumn> weeks,
            LocalDate rangeStart,
            LocalDate rangeEnd) {

        Sheet sheet = workbook.createSheet("Timeline");
        Styles styles = new Styles(workbook);

        writeMonthAndWeekHeaders(sheet, weeks, styles);
        Drawing<?> drawing = sheet.createDrawingPatriarch();
        CreationHelper creationHelper = workbook.getCreationHelper();
        writeDataRows(sheet, capacity, weeks, rangeStart, rangeEnd, styles, drawing, creationHelper);

        sheet.setColumnWidth(COL_EM, 16 * 256);
        sheet.setColumnWidth(COL_RESOURCE, 28 * 256);
        sheet.setColumnWidth(COL_DESIGNATION, 24 * 256);
        sheet.setColumnWidth(COL_TEAM, 10 * 256);
        sheet.setColumnWidth(COL_ROLE, 12 * 256);
        for (int i = 0; i < weeks.size(); i++) {
            sheet.setColumnWidth(FIRST_WEEK_COL + i, 11 * 256);
        }

        sheet.createFreezePane(FIRST_WEEK_COL, HEADER_ROWS);
        List<PersonRowBlock> blocks = writeDataRows(
                sheet, capacity, weeks, rangeStart, rangeEnd, styles, drawing, creationHelper);
        mergeIdentityColumns(sheet, blocks);
    }

    private void writeMonthAndWeekHeaders(Sheet sheet, List<WeekColumn> weeks, Styles styles) {
        Row monthRow = sheet.createRow(0);
        Row weekRow = sheet.createRow(1);
        monthRow.setHeightInPoints(22);
        weekRow.setHeightInPoints(28);

        String[] leftHeaders = {"EM Unit", "Resource", "Designation", "Team", "Role"};
        for (int i = 0; i < leftHeaders.length; i++) {
            Cell monthCell = monthRow.createCell(i);
            monthCell.setCellValue(leftHeaders[i]);
            monthCell.setCellStyle(styles.leftHeader);
            Cell weekCell = weekRow.createCell(i);
            weekCell.setCellValue("");
            weekCell.setCellStyle(styles.leftHeader);
            sheet.addMergedRegion(new CellRangeAddress(0, 1, i, i));
        }

        int col = FIRST_WEEK_COL;
        int i = 0;
        while (i < weeks.size()) {
            String monthKey = weeks.get(i).monthKey();
            String monthLabel = weeks.get(i).monthLabel();
            int start = i;
            while (i < weeks.size() && weeks.get(i).monthKey().equals(monthKey)) {
                i++;
            }
            int end = i - 1;
            int startCol = FIRST_WEEK_COL + start;
            int endCol = FIRST_WEEK_COL + end;

            Cell monthCell = monthRow.createCell(startCol);
            monthCell.setCellValue(monthLabel);
            monthCell.setCellStyle(styles.monthHeader);
            for (int c = startCol + 1; c <= endCol; c++) {
                Cell filler = monthRow.createCell(c);
                filler.setCellStyle(styles.monthHeader);
            }
            if (endCol > startCol) {
                sheet.addMergedRegion(new CellRangeAddress(0, 0, startCol, endCol));
            }
        }

        for (int w = 0; w < weeks.size(); w++) {
            WeekColumn week = weeks.get(w);
            Cell cell = weekRow.createCell(FIRST_WEEK_COL + w);
            cell.setCellValue(week.label());
            cell.setCellStyle(styles.weekHeader);
        }
    }

    private List<PersonRowBlock> writeDataRows(
            Sheet sheet,
            List<CapacityResponse> capacity,
            List<WeekColumn> weeks,
            LocalDate rangeStart,
            LocalDate rangeEnd,
            Styles styles,
            Drawing<?> drawing,
            CreationHelper creationHelper) {

        List<PersonRowBlock> blocks = new ArrayList<>();
        int rowIdx = HEADER_ROWS;

        for (CapacityResponse person : capacity) {
            List<AllocationResponse> period = periodAllocations(person);
            List<LaneBar> laneBars = packAllocationLanes(period, weeks, rangeStart, rangeEnd);
            int laneCount = Math.max(1, laneBars.stream().mapToInt(LaneBar::lane).max().orElse(-1) + 1);
            int firstRow = rowIdx;
            int lastRow = rowIdx + laneCount - 1;

            for (int lane = 0; lane < laneCount; lane++) {
                Row row = sheet.createRow(rowIdx);
                row.setHeightInPoints(24);

                if (lane == 0) {
                    setStyledString(
                            row,
                            COL_EM,
                            nullToEmpty(person.getEngineeringManagerName()).toUpperCase(Locale.ROOT),
                            styles.emCell);
                    setStyledString(row, COL_RESOURCE, person.getEmployeeName(), styles.resourceCell);
                    setStyledString(row, COL_DESIGNATION, nullToEmpty(person.getDesignationName()), styles.textCell);
                    setStyledString(row, COL_TEAM, shortTeam(person.getDepartmentName()), styles.textCell);
                    setStyledString(row, COL_ROLE, primaryRole(period), styles.textCell);
                } else {
                    setStyledString(row, COL_EM, "", styles.emCell);
                    setStyledString(row, COL_RESOURCE, "", styles.resourceCell);
                    setStyledString(row, COL_DESIGNATION, "", styles.textCell);
                    setStyledString(row, COL_TEAM, "", styles.textCell);
                    setStyledString(row, COL_ROLE, "", styles.textCell);
                }

                for (int w = 0; w < weeks.size(); w++) {
                    Cell cell = row.createCell(FIRST_WEEK_COL + w);
                    cell.setCellStyle(styles.emptyWeek);
                }

                rowIdx++;
            }

            if (period.isEmpty()) {
                Row row = sheet.getRow(firstRow);
                if (row != null && !weeks.isEmpty()) {
                    Cell bench = row.getCell(FIRST_WEEK_COL);
                    bench.setCellValue("— on bench —");
                    bench.setCellStyle(styles.benchCell);
                    if (weeks.size() > 1) {
                        addMergedRegionSafe(sheet, new CellRangeAddress(
                                firstRow, firstRow, FIRST_WEEK_COL, FIRST_WEEK_COL + weeks.size() - 1));
                        for (int w = 1; w < weeks.size(); w++) {
                            row.getCell(FIRST_WEEK_COL + w).setCellStyle(styles.benchCell);
                        }
                    }
                }
            } else {
                for (LaneBar bar : laneBars) {
                    int excelRow = firstRow + bar.lane();
                    Row row = sheet.getRow(excelRow);
                    paintBar(sheet, row, excelRow, bar, styles, drawing, creationHelper);
                }
            }

            blocks.add(new PersonRowBlock(
                    nullToEmpty(person.getEngineeringManagerName()).toUpperCase(Locale.ROOT),
                    firstRow,
                    lastRow));
        }

        return blocks;
    }

    private void paintBar(
            Sheet sheet,
            Row row,
            int rowIdx,
            LaneBar bar,
            Styles styles,
            Drawing<?> drawing,
            CreationHelper creationHelper) {
        AllocationResponse allocation = bar.allocation();
        int startCol = FIRST_WEEK_COL + bar.startWeek();
        int endCol = FIRST_WEEK_COL + bar.endWeek();
        if (startCol < FIRST_WEEK_COL || row == null) {
            return;
        }

        CellRangeAddress region = new CellRangeAddress(rowIdx, rowIdx, startCol, endCol);
        CellStyle barStyle = styles.barStyle(projectColorIndex(allocation));
        String label = barLabel(allocation);

        for (int c = startCol; c <= endCol; c++) {
            Cell cell = row.getCell(c);
            if (cell == null) {
                cell = row.createCell(c);
            }
            if (c == startCol) {
                cell.setCellValue(label);
            } else {
                cell.setCellValue("");
            }
            cell.setCellStyle(barStyle);
        }

        addMergedRegionSafe(sheet, region);

        Cell startCell = row.getCell(startCol);
        if (startCell != null) {
            // Ensure label survives merge (top-left owns visible text).
            startCell.setCellValue(label);
            startCell.setCellStyle(barStyle);
            addAllocationComment(drawing, creationHelper, startCell, startCol, endCol, rowIdx, allocation);
        }
    }

    private static List<LaneBar> packAllocationLanes(
            List<AllocationResponse> period,
            List<WeekColumn> weeks,
            LocalDate rangeStart,
            LocalDate rangeEnd) {
        Map<String, WeekSpan> uniqueSpans = new LinkedHashMap<>();
        for (AllocationResponse allocation : period) {
            int[] span = weekSpan(allocation, weeks, rangeStart, rangeEnd);
            if (span == null) {
                continue;
            }
            String key = allocation.getId() != null
                    ? allocation.getId().toString()
                    : allocation.getProjectId() + "|" + allocation.getIssueId() + "|" + span[0] + "|" + span[1];
            uniqueSpans.putIfAbsent(key, new WeekSpan(allocation, span[0], span[1]));
        }

        List<WeekSpan> spans = new ArrayList<>(uniqueSpans.values());
        spans.sort(Comparator
                .comparingInt(WeekSpan::startWeek)
                .thenComparing((a, b) -> Integer.compare(b.endWeek() - b.startWeek(), a.endWeek() - a.startWeek()))
                .thenComparing(a -> nullToEmpty(a.allocation().getProjectName()), String.CASE_INSENSITIVE_ORDER));

        List<List<WeekSpan>> lanes = new ArrayList<>();
        List<LaneBar> packed = new ArrayList<>();
        for (WeekSpan span : spans) {
            int lane = -1;
            for (int i = 0; i < lanes.size(); i++) {
                boolean overlaps = false;
                for (WeekSpan existing : lanes.get(i)) {
                    if (spansOverlap(existing, span)) {
                        overlaps = true;
                        break;
                    }
                }
                if (!overlaps) {
                    lane = i;
                    break;
                }
            }
            if (lane < 0) {
                lane = lanes.size();
                lanes.add(new ArrayList<>());
            }
            lanes.get(lane).add(span);
            packed.add(new LaneBar(span.allocation(), span.startWeek(), span.endWeek(), lane));
        }
        return packed;
    }

    private static boolean spansOverlap(WeekSpan a, WeekSpan b) {
        return a.startWeek() <= b.endWeek() && b.startWeek() <= a.endWeek();
    }

    private static int[] weekSpan(
            AllocationResponse allocation,
            List<WeekColumn> weeks,
            LocalDate rangeStart,
            LocalDate rangeEnd) {
        int start = -1;
        int end = -1;
        for (int i = 0; i < weeks.size(); i++) {
            if (overlapsWeek(allocation, weeks.get(i), rangeStart, rangeEnd)) {
                if (start < 0) {
                    start = i;
                }
                end = i;
            }
        }
        return start < 0 ? null : new int[]{start, end};
    }

    private void addAllocationComment(
            Drawing<?> drawing,
            CreationHelper creationHelper,
            Cell cell,
            int startCol,
            int endCol,
            int rowIdx,
            AllocationResponse allocation) {
        String tooltip = allocationTooltip(allocation);
        Comment existing = cell.getCellComment();
        if (existing != null) {
            String previous = existing.getString() != null ? existing.getString().getString() : "";
            if (!previous.contains(tooltip)) {
                String combined = previous.isBlank() ? tooltip : previous + "\n\n---\n\n" + tooltip;
                existing.setString(creationHelper.createRichTextString(combined));
            }
            return;
        }

        ClientAnchor anchor = creationHelper.createClientAnchor();
        anchor.setCol1(startCol);
        anchor.setCol2(Math.min(endCol + 3, startCol + 6));
        anchor.setRow1(rowIdx);
        anchor.setRow2(rowIdx + 6);

        Comment comment = drawing.createCellComment(anchor);
        comment.setString(creationHelper.createRichTextString(tooltip));
        comment.setAuthor("DFN-PlaniX");
        comment.setVisible(false);
        cell.setCellComment(comment);
    }

    private static String allocationTooltip(AllocationResponse allocation) {
        String startDate = allocation.getFromDate() != null ? allocation.getFromDate().toString() : "—";
        String endDate = allocation.getToDate() != null ? allocation.getToDate().toString() : "ongoing";
        return """
                Project: %s
                Issue: %s
                Role: %s
                Allocated: %d%%
                Start date: %s
                End date: %s
                Billable: %s
                """.formatted(
                nullToEmpty(allocation.getProjectName()),
                nullToEmpty(allocation.getIssueTitle()),
                nullToEmpty(allocation.getRoleOnProject()).isBlank()
                        ? "Member"
                        : allocation.getRoleOnProject(),
                allocationPct(allocation),
                startDate,
                endDate,
                allocation.isBillable() ? "Yes" : "No"
        ).trim();
    }

    private void mergeIdentityColumns(Sheet sheet, List<PersonRowBlock> blocks) {
        for (PersonRowBlock block : blocks) {
            if (block.lastRow() > block.firstRow()) {
                mergeColumn(sheet, block.firstRow(), block.lastRow(), COL_RESOURCE);
                mergeColumn(sheet, block.firstRow(), block.lastRow(), COL_DESIGNATION);
                mergeColumn(sheet, block.firstRow(), block.lastRow(), COL_TEAM);
                mergeColumn(sheet, block.firstRow(), block.lastRow(), COL_ROLE);
            }
        }

        int start = 0;
        while (start < blocks.size()) {
            String em = blocks.get(start).emName();
            int end = start;
            while (end + 1 < blocks.size() && blocks.get(end + 1).emName().equals(em)) {
                end++;
            }
            int firstRow = blocks.get(start).firstRow();
            int lastRow = blocks.get(end).lastRow();
            if (lastRow > firstRow) {
                mergeColumn(sheet, firstRow, lastRow, COL_EM);
            }
            start = end + 1;
        }
    }

    private static void mergeColumn(Sheet sheet, int firstRow, int lastRow, int col) {
        addMergedRegionSafe(sheet, new CellRangeAddress(firstRow, lastRow, col, col));
        Row top = sheet.getRow(firstRow);
        if (top != null && top.getCell(col) != null) {
            top.getCell(col).getCellStyle().setVerticalAlignment(VerticalAlignment.CENTER);
        }
    }

    private static void addMergedRegionSafe(Sheet sheet, CellRangeAddress region) {
        if (region.getNumberOfCells() <= 1) {
            return;
        }
        if (findIntersectingMerge(sheet, region) != null) {
            return;
        }
        sheet.addMergedRegion(region);
    }

    private static CellRangeAddress findIntersectingMerge(Sheet sheet, CellRangeAddress region) {
        for (int i = 0; i < sheet.getNumMergedRegions(); i++) {
            CellRangeAddress existing = sheet.getMergedRegion(i);
            if (existing.intersects(region)) {
                return existing;
            }
        }
        return null;
    }

    private void writeDetailSheet(Workbook workbook, List<CapacityResponse> capacity) {
        Sheet sheet = workbook.createSheet("Allocations Detail");
        CellStyle headerStyle = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        headerStyle.setFont(font);

        String[] headers = {
                "EM Unit", "Resource", "Designation", "Team", "Project", "Issue",
                "Role", "Allocated %", "From", "To", "Billable"
        };
        Row header = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = header.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        int rowIdx = 1;
        for (CapacityResponse person : capacity) {
            List<AllocationResponse> period = periodAllocations(person);
            if (period.isEmpty()) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nullToEmpty(person.getEngineeringManagerName()));
                row.createCell(1).setCellValue(person.getEmployeeName());
                row.createCell(2).setCellValue(nullToEmpty(person.getDesignationName()));
                row.createCell(3).setCellValue(nullToEmpty(person.getDepartmentName()));
                row.createCell(4).setCellValue("— on bench —");
                continue;
            }
            for (AllocationResponse allocation : period) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nullToEmpty(person.getEngineeringManagerName()));
                row.createCell(1).setCellValue(person.getEmployeeName());
                row.createCell(2).setCellValue(nullToEmpty(person.getDesignationName()));
                row.createCell(3).setCellValue(nullToEmpty(person.getDepartmentName()));
                row.createCell(4).setCellValue(nullToEmpty(allocation.getProjectName()));
                row.createCell(5).setCellValue(nullToEmpty(allocation.getIssueTitle()));
                row.createCell(6).setCellValue(nullToEmpty(allocation.getRoleOnProject()));
                row.createCell(7).setCellValue(allocationPct(allocation));
                row.createCell(8).setCellValue(allocation.getFromDate() != null ? allocation.getFromDate().toString() : "");
                row.createCell(9).setCellValue(
                        allocation.getToDate() != null ? allocation.getToDate().toString() : "ongoing");
                row.createCell(10).setCellValue(allocation.isBillable() ? "Yes" : "No");
            }
        }
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private static List<WeekColumn> buildWeeks(LocalDate from, LocalDate to) {
        List<WeekColumn> weeks = new ArrayList<>();
        LocalDate cursor = from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        Map<String, Integer> monthWeekCounter = new HashMap<>();

        while (!cursor.isAfter(to)) {
            LocalDate weekEnd = cursor.plusDays(6);
            LocalDate visibleStart = cursor.isBefore(from) ? from : cursor;
            LocalDate visibleEnd = weekEnd.isAfter(to) ? to : weekEnd;
            if (!visibleEnd.isBefore(from) && !visibleStart.isAfter(to)) {
                String monthKey = visibleStart.getYear() + "-" + visibleStart.getMonthValue();
                String monthLabel = visibleStart.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
                int weekInMonth = monthWeekCounter.merge(monthKey, 1, Integer::sum);
                String label = "W" + weekInMonth + "(" + visibleStart.getDayOfMonth()
                        + "-" + visibleEnd.getDayOfMonth() + ")";
                weeks.add(new WeekColumn(cursor, visibleStart, visibleEnd, monthKey, monthLabel, label));
            }
            cursor = cursor.plusWeeks(1);
        }
        return weeks;
    }

    private static boolean overlapsWeek(
            AllocationResponse allocation,
            WeekColumn week,
            LocalDate rangeStart,
            LocalDate rangeEnd) {
        LocalDate allocStart = allocation.getFromDate() != null ? allocation.getFromDate() : rangeStart;
        LocalDate allocEnd = allocation.getToDate() != null ? allocation.getToDate() : rangeEnd;
        return !allocEnd.isBefore(week.visibleStart()) && !allocStart.isAfter(week.visibleEnd());
    }

    private static String barLabel(AllocationResponse allocation) {
        String project = nullToEmpty(allocation.getProjectName());
        String issue = nullToEmpty(allocation.getIssueTitle());
        int pct = allocationPct(allocation);
        if (!issue.isBlank() && !issue.equalsIgnoreCase(project)) {
            return project + " — " + issue + " (" + pct + "%)";
        }
        return project + " (" + pct + "%)";
    }

    private static String primaryRole(List<AllocationResponse> period) {
        return period.stream()
                .map(AllocationResponse::getRoleOnProject)
                .filter(role -> role != null && !role.isBlank())
                .findFirst()
                .orElse("Member");
    }

    private static String shortTeam(String departmentName) {
        if (departmentName == null || departmentName.isBlank()) {
            return "";
        }
        String trimmed = departmentName.trim();
        if (trimmed.length() <= 6) {
            return trimmed.toUpperCase(Locale.ROOT);
        }
        String[] parts = trimmed.split("[\\s/_-]+");
        if (parts.length == 1) {
            return trimmed.substring(0, Math.min(3, trimmed.length())).toUpperCase(Locale.ROOT);
        }
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (!part.isBlank()) {
                sb.append(Character.toUpperCase(part.charAt(0)));
            }
        }
        return sb.toString();
    }

    private static IndexedColors projectColorIndex(AllocationResponse allocation) {
        String key = allocation.getProjectId() != null
                ? allocation.getProjectId().toString()
                : nullToEmpty(allocation.getProjectName());
        int hash = 0;
        for (int i = 0; i < key.length(); i++) {
            hash = key.charAt(i) + ((hash << 5) - hash);
        }
        return BAR_COLORS[Math.abs(hash) % BAR_COLORS.length];
    }

    private static List<AllocationResponse> periodAllocations(CapacityResponse row) {
        if (row.getPeriodAllocations() != null && !row.getPeriodAllocations().isEmpty()) {
            return row.getPeriodAllocations();
        }
        return row.getAllocations() != null ? row.getAllocations() : List.of();
    }

    private static int allocationPct(AllocationResponse allocation) {
        return allocation.getPercentage() != null ? allocation.getPercentage() : 0;
    }

    private static void setStyledString(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    private record WeekColumn(
            LocalDate weekStartMonday,
            LocalDate visibleStart,
            LocalDate visibleEnd,
            String monthKey,
            String monthLabel,
            String label) {
    }

    private record WeekSpan(AllocationResponse allocation, int startWeek, int endWeek) {
    }

    private record LaneBar(AllocationResponse allocation, int startWeek, int endWeek, int lane) {
    }

    private record PersonRowBlock(String emName, int firstRow, int lastRow) {
    }

    private static final class Styles {
        private final XSSFWorkbook workbook;
        private final CellStyle leftHeader;
        private final CellStyle monthHeader;
        private final CellStyle weekHeader;
        private final CellStyle emCell;
        private final CellStyle resourceCell;
        private final CellStyle textCell;
        private final CellStyle emptyWeek;
        private final CellStyle benchCell;
        private final Map<String, CellStyle> barStyles = new HashMap<>();

        private Styles(XSSFWorkbook workbook) {
            this.workbook = workbook;
            Font bold = workbook.createFont();
            bold.setBold(true);

            leftHeader = workbook.createCellStyle();
            leftHeader.setFont(bold);
            leftHeader.setAlignment(HorizontalAlignment.CENTER);
            leftHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            leftHeader.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            leftHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            applyThinBorder(leftHeader);
            leftHeader.setWrapText(true);

            monthHeader = workbook.createCellStyle();
            monthHeader.setFont(bold);
            monthHeader.setAlignment(HorizontalAlignment.CENTER);
            monthHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            monthHeader.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            monthHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            applyThinBorder(monthHeader);

            weekHeader = workbook.createCellStyle();
            weekHeader.setFont(bold);
            weekHeader.setAlignment(HorizontalAlignment.CENTER);
            weekHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            weekHeader.setWrapText(true);
            applyThinBorder(weekHeader);

            emCell = workbook.createCellStyle();
            emCell.setFont(bold);
            emCell.setAlignment(HorizontalAlignment.CENTER);
            emCell.setVerticalAlignment(VerticalAlignment.CENTER);
            emCell.setRotation((short) 90);
            applyThinBorder(emCell);

            resourceCell = workbook.createCellStyle();
            resourceCell.setVerticalAlignment(VerticalAlignment.CENTER);
            applyThinBorder(resourceCell);

            textCell = workbook.createCellStyle();
            textCell.setVerticalAlignment(VerticalAlignment.CENTER);
            applyThinBorder(textCell);

            emptyWeek = workbook.createCellStyle();
            applyThinBorder(emptyWeek);

            benchCell = workbook.createCellStyle();
            benchCell.setAlignment(HorizontalAlignment.CENTER);
            benchCell.setVerticalAlignment(VerticalAlignment.CENTER);
            benchCell.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            benchCell.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            applyThinBorder(benchCell);
        }

        private CellStyle barStyle(IndexedColors color) {
            String key = color.name();
            return barStyles.computeIfAbsent(key, ignored -> {
                XSSFCellStyle style = workbook.createCellStyle();
                Font white = workbook.createFont();
                white.setBold(true);
                white.setColor(IndexedColors.WHITE.getIndex());
                style.setFont(white);
                style.setAlignment(HorizontalAlignment.LEFT);
                style.setVerticalAlignment(VerticalAlignment.CENTER);
                // Use both indexed + explicit XSSF RGB so fills render in Excel.
                style.setFillForegroundColor(color.getIndex());
                java.awt.Color awt = indexedToAwt(color);
                style.setFillForegroundColor(new XSSFColor(awt, new DefaultIndexedColorMap()));
                style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                applyThinBorder(style);
                style.setWrapText(false);
                return style;
            });
        }

        private static java.awt.Color indexedToAwt(IndexedColors color) {
            return switch (color) {
                case ROYAL_BLUE -> new java.awt.Color(65, 105, 225);
                case GREEN -> new java.awt.Color(34, 139, 34);
                case ORCHID -> new java.awt.Color(218, 112, 214);
                case GOLD -> new java.awt.Color(255, 215, 0);
                case ORANGE -> new java.awt.Color(255, 140, 0);
                case TEAL -> new java.awt.Color(0, 128, 128);
                case PINK -> new java.awt.Color(255, 105, 180);
                case GREY_50_PERCENT -> new java.awt.Color(128, 128, 128);
                case BROWN -> new java.awt.Color(139, 69, 19);
                default -> new java.awt.Color(59, 130, 246);
            };
        }

        private static void applyThinBorder(CellStyle style) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
        }
    }
}
