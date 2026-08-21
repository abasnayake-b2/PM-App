package com.nexuspm.issue;

import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.field.entity.IssueFieldValue;
import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.organisation.entity.Client;
import com.nexuspm.organisation.entity.Country;
import com.nexuspm.project.entity.Project;
import com.nexuspm.report.ManagementHierarchyUtils;
import com.nexuspm.teamroster.entity.TeamManagement;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Builds a multi-sheet backlog workbook: Summary tab + All RDs tab + one tab per project.
 */
@Service
public class BacklogExcelExportService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter STAMP_FMT = DateTimeFormatter.ofPattern("dd-MMM-yyyy HH:mm");

    private enum ValueType { TEXT, NUMBER, DATE, WRAP }

    private enum CoreField {
        PROJECT, EM, COUNTRY, VP,
        DISPLAY_KEY, JIRA_ID, BMS_ID, TITLE, DESCRIPTION, STATUS, PRIORITY, CAPITALIZABLE, ASSIGNEE
    }

    private record ColumnDef(String category, String header, CoreField core, String fieldKey, ValueType type) {
        static ColumnDef core(String category, String header, CoreField core, ValueType type) {
            return new ColumnDef(category, header, core, null, type);
        }

        static ColumnDef field(String category, String header, String fieldKey, ValueType type) {
            return new ColumnDef(category, header, null, fieldKey, type);
        }
    }

    /** Full RD column set — Core + custom fields in the same section order as Admin RD fields. */
    private static final List<ColumnDef> COLUMNS = List.of(
            ColumnDef.core("Core", "CR No / ID", CoreField.DISPLAY_KEY, ValueType.TEXT),
            ColumnDef.core("Core", "JIRA ID", CoreField.JIRA_ID, ValueType.TEXT),
            ColumnDef.core("Core", "BMS ID", CoreField.BMS_ID, ValueType.TEXT),
            ColumnDef.core("Core", "Change Request Name", CoreField.TITLE, ValueType.TEXT),
            ColumnDef.core("Core", "Description", CoreField.DESCRIPTION, ValueType.WRAP),
            ColumnDef.core("Core", "Current Stage", CoreField.STATUS, ValueType.TEXT),
            ColumnDef.core("Core", "Priority", CoreField.PRIORITY, ValueType.TEXT),
            ColumnDef.core("Core", "Capitalizable", CoreField.CAPITALIZABLE, ValueType.TEXT),
            ColumnDef.core("Core", "Assignee", CoreField.ASSIGNEE, ValueType.TEXT),

            ColumnDef.field("General", "SOW", "sow", ValueType.TEXT),
            ColumnDef.field("General", "Covered in Existing Resources", "covered_in_existing_resources", ValueType.TEXT),
            ColumnDef.field("General", "CR Type", "cr_type", ValueType.TEXT),
            ColumnDef.field("General", "Major CR", "major_cr", ValueType.TEXT),
            ColumnDef.field("General", "Delivery Quarter", "delivery_quarter", ValueType.TEXT),
            ColumnDef.field("General", "Delivery Year", "delivery_year", ValueType.TEXT),
            ColumnDef.field("General", "Percentage Completion", "percentage_completion", ValueType.TEXT),
            ColumnDef.field("General", "RAG Status", "rag_status", ValueType.TEXT),

            ColumnDef.field("Dates", "Requirement Initiated Date", "requirement_initiated_date", ValueType.DATE),
            ColumnDef.field("Dates", "BRD Requested Date", "brd_requested_date", ValueType.DATE),
            ColumnDef.field("Dates", "BRD Received Date", "brd_received_date", ValueType.DATE),
            ColumnDef.field("Dates", "BA Ballpark Effort", "ba_ballpark_effort", ValueType.NUMBER),
            ColumnDef.field("Dates", "BP Effort ETA", "bp_effort_eta", ValueType.DATE),
            ColumnDef.field("Dates", "BP Effort", "bp_effort", ValueType.NUMBER),
            ColumnDef.field("Dates", "BP Effort Accepted Date", "bp_effort_accepted_date", ValueType.DATE),
            ColumnDef.field("Dates", "Total Effort ETA", "total_effort_eta", ValueType.DATE),
            ColumnDef.field("Dates", "RD Start Date", "rd_start_date", ValueType.DATE),
            ColumnDef.field("Dates", "RD Delivery ETA", "rd_delivery_eta", ValueType.DATE),
            ColumnDef.field("Dates", "RD Sign Off Date", "rd_sign_off_date", ValueType.DATE),
            ColumnDef.field("Dates", "Highlevel RD Delivery ETA", "highlevel_rd_delivery_eta", ValueType.DATE),
            ColumnDef.field("Dates", "Pending Highlevel RD Signoff", "pending_highlevel_rd_signoff", ValueType.DATE),
            ColumnDef.field("Dates", "Requirement Audit Date", "requirement_audit_date", ValueType.DATE),

            ColumnDef.field("Financials", "Costing Done?", "costing_done", ValueType.TEXT),
            ColumnDef.field("Financials", "Quote Done?", "quote_done", ValueType.TEXT),
            ColumnDef.field("Financials", "Quotation", "quotation", ValueType.NUMBER),
            ColumnDef.field("Financials", "Quotation Shared Date", "quotation_shared_date", ValueType.DATE),
            ColumnDef.field("Financials", "Quotation Accepted Date", "quotation_approved_date", ValueType.DATE),
            ColumnDef.field("Financials", "Deal Desk Approval Status", "deal_desk_approval_status", ValueType.TEXT),
            ColumnDef.field("Financials", "Payment Status", "payment_status", ValueType.TEXT),

            ColumnDef.field("Man-days", "Man-days Planned", "md_planned", ValueType.NUMBER),
            ColumnDef.field("Man-days", "Man-days Additional", "md_additional", ValueType.NUMBER),
            ColumnDef.field("Man-days", "Man-days Total", "md_total", ValueType.NUMBER),
            ColumnDef.field("Man-days", "Man-days Actually Utilized", "md_actually_utilized", ValueType.NUMBER),
            ColumnDef.field("Man-days", "Man-days Remaining", "md_remaining", ValueType.NUMBER),
            ColumnDef.field("Man-days", "Over Utilization %", "over_utilization_pct", ValueType.NUMBER),
            ColumnDef.field("Man-days", "Completion based on Actual Effort", "completion_based_on_actual_effort", ValueType.NUMBER),
            ColumnDef.field("Man-days", "Latest client acknowledged percentage", "latest_client_acknowledged_percentage", ValueType.NUMBER),
            ColumnDef.field("Man-days", "70% of Completion based on Actual effort", "completion_70_pct_based_on_actual_effort", ValueType.NUMBER),

            ColumnDef.field("Milestones", "Dev Start Date", "dev_start_date", ValueType.DATE),
            ColumnDef.field("Milestones", "Dev End Date", "dev_end_date", ValueType.DATE),
            ColumnDef.field("Milestones", "SIT Start Date", "sit_start_date", ValueType.DATE),
            ColumnDef.field("Milestones", "SIT End Date", "sit_end_date", ValueType.DATE),
            ColumnDef.field("Milestones", "UAT Start Date", "uat_start_date", ValueType.DATE),
            ColumnDef.field("Milestones", "UAT End Date", "uat_end_date", ValueType.DATE),
            ColumnDef.field("Milestones", "Prod Date", "prod_date", ValueType.DATE),
            ColumnDef.field("Milestones", "Next UAT Release", "next_uat_release", ValueType.DATE),
            ColumnDef.field("Milestones", "Release Count", "release_count", ValueType.NUMBER),
            ColumnDef.field("Milestones", "UAT Defect Count", "uat_defect_count", ValueType.NUMBER),
            ColumnDef.field("Milestones", "Next Production Release", "next_production_release", ValueType.DATE),
            ColumnDef.field("Milestones", "Release Audit Date", "release_audit_date", ValueType.DATE),
            ColumnDef.field("Milestones", "Last Action date", "last_action_date", ValueType.DATE),

            ColumnDef.field("Risk", "Risk Count", "risk_count", ValueType.NUMBER),

            ColumnDef.field("Other", "Notes", "notes", ValueType.WRAP)
    );

    /** All RDs tab: project context columns + full RD detail set. */
    private static final List<ColumnDef> ALL_RD_COLUMNS;
    static {
        List<ColumnDef> all = new ArrayList<>();
        all.add(ColumnDef.core("Context", "Project", CoreField.PROJECT, ValueType.TEXT));
        all.add(ColumnDef.core("Context", "EM", CoreField.EM, ValueType.TEXT));
        all.add(ColumnDef.core("Context", "Country", CoreField.COUNTRY, ValueType.TEXT));
        all.add(ColumnDef.core("Context", "VP", CoreField.VP, ValueType.TEXT));
        all.addAll(COLUMNS);
        ALL_RD_COLUMNS = List.copyOf(all);
    }

    private static final String[] FIELD_KEYS = COLUMNS.stream()
            .map(ColumnDef::fieldKey)
            .filter(k -> k != null && !k.isBlank())
            .toArray(String[]::new);

    public byte[] export(
            List<RdIssue> issues,
            List<IssueStatus> statuses,
            Map<UUID, Map<String, FieldVal>> fieldsByIssueId) throws IOException {

        Map<String, List<RdIssue>> byProject = new LinkedHashMap<>();
        for (RdIssue issue : issues) {
            String projectName = issue.getProject() != null && issue.getProject().getName() != null
                    ? issue.getProject().getName().trim()
                    : "Unknown project";
            byProject.computeIfAbsent(projectName, ignored -> new ArrayList<>()).add(issue);
        }
        for (List<RdIssue> list : byProject.values()) {
            list.sort(Comparator
                    .comparing((RdIssue i) -> i.getRdNumber() != null ? i.getRdNumber() : Integer.MAX_VALUE)
                    .thenComparing(i -> nullToEmpty(i.getDisplayKey()), String.CASE_INSENSITIVE_ORDER)
                    .thenComparing(i -> nullToEmpty(i.getTitle()), String.CASE_INSENSITIVE_ORDER));
        }

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Styles styles = new Styles(workbook);
            writeSummarySheet(workbook, styles, byProject, statuses, fieldsByIssueId);
            Set<String> usedSheetNames = new HashSet<>();
            usedSheetNames.add("Summary");
            usedSheetNames.add("All RDs");
            writeAllRdsSheet(workbook, styles, issues, fieldsByIssueId);
            for (Map.Entry<String, List<RdIssue>> entry : byProject.entrySet()) {
                String sheetName = uniqueSheetName(entry.getKey(), usedSheetNames);
                writeProjectSheet(workbook, styles, sheetName, entry.getKey(), entry.getValue(), statuses, fieldsByIssueId);
            }
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private void writeSummarySheet(
            XSSFWorkbook workbook,
            Styles styles,
            Map<String, List<RdIssue>> byProject,
            List<IssueStatus> statuses,
            Map<UUID, Map<String, FieldVal>> fieldsByIssueId) {

        Sheet sheet = workbook.createSheet("Summary");
        int rowIdx = 0;

        Row title = sheet.createRow(rowIdx++);
        Cell titleCell = title.createCell(0);
        titleCell.setCellValue("Executive Summary — Backlog RDs by Project");
        titleCell.setCellStyle(styles.title);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 6));

        Row meta = sheet.createRow(rowIdx++);
        meta.createCell(0).setCellValue("Last updated");
        meta.getCell(0).setCellStyle(styles.label);
        meta.createCell(1).setCellValue(STAMP_FMT.format(LocalDateTime.now()));
        meta.getCell(1).setCellStyle(styles.text);

        rowIdx++;

        int totalCr = byProject.values().stream().mapToInt(List::size).sum();
        int activeCr = byProject.values().stream()
                .flatMap(List::stream)
                .mapToInt(i -> isActive(i) ? 1 : 0)
                .sum();
        int rdEstimated = countWithField(byProject, fieldsByIssueId, "rd_delivery_eta", "rd_start_date");
        int rdActual = countWithField(byProject, fieldsByIssueId, "rd_sign_off_date");

        rowIdx = writeStatBlock(sheet, styles, rowIdx, 0,
                "Total CR count", totalCr,
                "Total Active CR count", activeCr,
                "Total RDs count (Estimated)", rdEstimated,
                "Total RDs count (Actual)", rdActual);

        rowIdx++;
        Row stageTitle = sheet.createRow(rowIdx++);
        Cell stageTitleCell = stageTitle.createCell(0);
        stageTitleCell.setCellValue("Stage-wise breakdown (all projects)");
        stageTitleCell.setCellStyle(styles.section);

        Map<String, Integer> statusTotals = countByStatus(byProject.values().stream().flatMap(List::stream).toList());
        rowIdx = writeStatusGrid(sheet, styles, rowIdx, statuses, statusTotals);

        rowIdx += 2;
        Row projectTitle = sheet.createRow(rowIdx++);
        Cell projectTitleCell = projectTitle.createCell(0);
        projectTitleCell.setCellValue("Project summary");
        projectTitleCell.setCellStyle(styles.section);

        Row header = sheet.createRow(rowIdx++);
        String[] projectHeaders = {
                "Project", "Total CR", "Active CR", "RDs Estimated", "RDs Actual", "Man-days Planned", "Man-days Utilized"
        };
        for (int c = 0; c < projectHeaders.length; c++) {
            Cell cell = header.createCell(c);
            cell.setCellValue(projectHeaders[c]);
            cell.setCellStyle(styles.tableHeader);
        }

        for (Map.Entry<String, List<RdIssue>> entry : byProject.entrySet()) {
            List<RdIssue> list = entry.getValue();
            Row row = sheet.createRow(rowIdx++);
            int active = (int) list.stream().filter(BacklogExcelExportService::isActive).count();
            int estimated = (int) list.stream().filter(i -> hasAnyField(fieldsByIssueId.get(i.getId()),
                    "rd_delivery_eta", "rd_start_date")).count();
            int actual = (int) list.stream().filter(i -> hasAnyField(fieldsByIssueId.get(i.getId()),
                    "rd_sign_off_date")).count();
            double mdPlanned = sumNumber(list, fieldsByIssueId, "md_planned");
            double mdUtilized = sumNumber(list, fieldsByIssueId, "md_actually_utilized");

            setText(row, 0, entry.getKey(), styles.text);
            setInt(row, 1, list.size(), styles.intNumber);
            setInt(row, 2, active, styles.intNumber);
            setInt(row, 3, estimated, styles.intNumber);
            setInt(row, 4, actual, styles.intNumber);
            setNumber(row, 5, mdPlanned, styles.number);
            setNumber(row, 6, mdUtilized, styles.number);
        }

        for (int c = 0; c < projectHeaders.length; c++) {
            sheet.setColumnWidth(c, (c == 0 ? 28 : 16) * 256);
        }
        sheet.createFreezePane(0, 1);
    }

    private void writeAllRdsSheet(
            XSSFWorkbook workbook,
            Styles styles,
            List<RdIssue> issues,
            Map<UUID, Map<String, FieldVal>> fieldsByIssueId) {

        Sheet sheet = workbook.createSheet("All RDs");
        int rowIdx = 0;

        Row title = sheet.createRow(rowIdx++);
        Cell titleCell = title.createCell(0);
        titleCell.setCellValue("All RDs — Project / EM / Country / VP");
        titleCell.setCellStyle(styles.title);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 6));

        Row meta = sheet.createRow(rowIdx++);
        meta.createCell(0).setCellValue("Last updated");
        meta.getCell(0).setCellStyle(styles.label);
        meta.createCell(1).setCellValue(STAMP_FMT.format(LocalDateTime.now()));
        meta.getCell(1).setCellStyle(styles.text);
        meta.createCell(3).setCellValue("Total RDs");
        meta.getCell(3).setCellStyle(styles.label);
        meta.createCell(4).setCellValue(issues.size());
        meta.getCell(4).setCellStyle(styles.intNumber);

        rowIdx++;
        int headerStart = rowIdx;
        writeDetailHeaders(sheet, styles, headerStart, ALL_RD_COLUMNS);
        rowIdx = headerStart + 2;

        List<RdIssue> sorted = new ArrayList<>(issues);
        sorted.sort(Comparator
                .comparing((RdIssue i) -> nullToEmpty(projectName(i)), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(i -> i.getRdNumber() != null ? i.getRdNumber() : Integer.MAX_VALUE)
                .thenComparing(i -> nullToEmpty(i.getDisplayKey()), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(i -> nullToEmpty(i.getTitle()), String.CASE_INSENSITIVE_ORDER));

        for (RdIssue issue : sorted) {
            Map<String, FieldVal> fields = fieldsByIssueId.getOrDefault(issue.getId(), Map.of());
            Row row = sheet.createRow(rowIdx++);
            for (int c = 0; c < ALL_RD_COLUMNS.size(); c++) {
                writeDetailCell(row, c, ALL_RD_COLUMNS.get(c), issue, fields, styles);
            }
        }

        applyDetailColumnWidths(sheet, ALL_RD_COLUMNS);
        sheet.createFreezePane(5, headerStart + 2);
    }

    private void writeProjectSheet(
            XSSFWorkbook workbook,
            Styles styles,
            String sheetName,
            String projectName,
            List<RdIssue> issues,
            List<IssueStatus> statuses,
            Map<UUID, Map<String, FieldVal>> fieldsByIssueId) {

        Sheet sheet = workbook.createSheet(sheetName);
        int rowIdx = 0;

        int totalCr = issues.size();
        int activeCr = (int) issues.stream().filter(BacklogExcelExportService::isActive).count();
        int rdEstimated = (int) issues.stream().filter(i -> hasAnyField(fieldsByIssueId.get(i.getId()),
                "rd_delivery_eta", "rd_start_date")).count();
        int rdActual = (int) issues.stream().filter(i -> hasAnyField(fieldsByIssueId.get(i.getId()),
                "rd_sign_off_date")).count();

        rowIdx = writeStatBlock(sheet, styles, rowIdx, 0,
                "Total CR count", totalCr,
                "Total Active CR count", activeCr,
                "Total RDs count (Estimated)", rdEstimated,
                "Total RDs count (Actual)", rdActual);

        Row titleRow = sheet.getRow(0);
        if (titleRow == null) {
            titleRow = sheet.createRow(0);
        }
        Cell projectTitle = titleRow.createCell(3);
        projectTitle.setCellValue("Project Summary — " + projectName);
        projectTitle.setCellStyle(styles.title);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 3, 8));

        Row updated = sheet.getRow(1);
        if (updated == null) {
            updated = sheet.createRow(1);
        }
        updated.createCell(3).setCellValue("Last updated");
        updated.getCell(3).setCellStyle(styles.label);
        updated.createCell(4).setCellValue(STAMP_FMT.format(LocalDateTime.now()));
        updated.getCell(4).setCellStyle(styles.text);

        rowIdx = Math.max(rowIdx, 5);
        Row stageTitle = sheet.createRow(rowIdx++);
        Cell stageTitleCell = stageTitle.createCell(0);
        stageTitleCell.setCellValue("Stage-wise breakdown");
        stageTitleCell.setCellStyle(styles.section);

        Map<String, Integer> statusCounts = countByStatus(issues);
        rowIdx = writeStatusGrid(sheet, styles, rowIdx, statuses, statusCounts);

        rowIdx += 2;
        int headerStart = rowIdx;
        writeDetailHeaders(sheet, styles, headerStart, COLUMNS);
        rowIdx = headerStart + 2;

        for (RdIssue issue : issues) {
            Map<String, FieldVal> fields = fieldsByIssueId.getOrDefault(issue.getId(), Map.of());
            Row row = sheet.createRow(rowIdx++);
            for (int c = 0; c < COLUMNS.size(); c++) {
                writeDetailCell(row, c, COLUMNS.get(c), issue, fields, styles);
            }
        }

        applyDetailColumnWidths(sheet, COLUMNS);
        sheet.createFreezePane(2, headerStart + 2);
    }

    private void applyDetailColumnWidths(Sheet sheet, List<ColumnDef> columns) {
        for (int c = 0; c < columns.size(); c++) {
            ColumnDef col = columns.get(c);
            int width;
            if (col.core == CoreField.PROJECT) {
                width = 28;
            } else if (col.core == CoreField.TITLE || col.core == CoreField.DESCRIPTION) {
                width = col.core == CoreField.TITLE ? 42 : 36;
            } else if (col.core == CoreField.DISPLAY_KEY) {
                width = 22;
            } else if (col.core == CoreField.JIRA_ID || col.core == CoreField.BMS_ID) {
                width = 16;
            } else if (col.type == ValueType.WRAP
                    || "Notes".equals(col.header)) {
                width = 32;
            } else if (col.core == CoreField.EM || col.core == CoreField.VP || col.core == CoreField.COUNTRY) {
                width = 20;
            } else {
                width = 16;
            }
            sheet.setColumnWidth(c, width * 256);
        }
    }

    private void writeDetailHeaders(Sheet sheet, Styles styles, int startRow, List<ColumnDef> columns) {
        Row categoryRow = sheet.createRow(startRow);
        Row headerRow = sheet.createRow(startRow + 1);

        int col = 0;
        while (col < columns.size()) {
            String category = columns.get(col).category;
            CategoryPalette palette = styles.paletteFor(category);
            int start = col;
            while (col < columns.size() && columns.get(col).category.equals(category)) {
                col++;
            }
            int end = col - 1;

            Cell categoryCell = categoryRow.createCell(start);
            categoryCell.setCellValue(category);
            categoryCell.setCellStyle(palette.banner);
            for (int c = start + 1; c <= end; c++) {
                Cell fill = categoryRow.createCell(c);
                fill.setCellStyle(palette.banner);
            }
            if (end > start) {
                sheet.addMergedRegion(new CellRangeAddress(startRow, startRow, start, end));
            }

            for (int c = start; c <= end; c++) {
                Cell cell = headerRow.createCell(c);
                cell.setCellValue(columns.get(c).header);
                cell.setCellStyle(palette.fieldHeader);
            }
        }
    }

    private void writeDetailCell(
            Row row,
            int col,
            ColumnDef def,
            RdIssue issue,
            Map<String, FieldVal> fields,
            Styles styles) {
        CategoryPalette palette = styles.paletteFor(def.category);
        if (def.core != null) {
            switch (def.core) {
                case PROJECT -> setText(row, col, projectName(issue), palette.text);
                case EM -> setText(row, col, engineeringManagerName(issue), palette.text);
                case COUNTRY -> setText(row, col, countryName(issue), palette.text);
                case VP -> setText(row, col, vpName(issue), palette.text);
                case DISPLAY_KEY -> setText(row, col, displayKey(issue), palette.text);
                case JIRA_ID -> setText(row, col, issue.getJiraId(), palette.text);
                case BMS_ID -> setText(row, col, issue.getBmsId(), palette.text);
                case TITLE -> setText(row, col, issue.getTitle(), palette.text);
                case DESCRIPTION -> setText(row, col, issue.getDescription(), palette.wrap);
                case STATUS -> setText(row, col,
                        issue.getStatus() != null ? issue.getStatus().getName() : null, palette.text);
                case PRIORITY -> setText(row, col,
                        issue.getPriority() != null ? issue.getPriority().getLabel() : null, palette.text);
                case CAPITALIZABLE -> setText(row, col, yesNo(issue.getCapitalizable()), palette.text);
                case ASSIGNEE -> setText(row, col, assigneeName(issue), palette.text);
            }
            return;
        }

        FieldVal val = fields.get(def.fieldKey);
        switch (def.type) {
            case DATE -> setDate(row, col, val, palette.date);
            case NUMBER -> setFieldNumber(row, col, val, palette.number);
            case WRAP -> setText(row, col, textOrNumber(val), palette.wrap);
            case TEXT -> setText(row, col, textOrNumber(val), palette.text);
        }
    }

    private int writeStatBlock(
            Sheet sheet,
            Styles styles,
            int startRow,
            int startCol,
            String label1, int value1,
            String label2, int value2,
            String label3, int value3,
            String label4, int value4) {

        String[] labels = {label1, label2, label3, label4};
        int[] values = {value1, value2, value3, value4};
        for (int i = 0; i < labels.length; i++) {
            Row row = sheet.getRow(startRow + i);
            if (row == null) {
                row = sheet.createRow(startRow + i);
            }
            Cell label = row.createCell(startCol);
            label.setCellValue(labels[i]);
            label.setCellStyle(styles.statLabel);
            Cell value = row.createCell(startCol + 1);
            value.setCellValue(values[i]);
            value.setCellStyle(styles.statValue);
        }
        return startRow + labels.length;
    }

    private int writeStatusGrid(
            Sheet sheet,
            Styles styles,
            int startRow,
            List<IssueStatus> statuses,
            Map<String, Integer> counts) {

        List<IssueStatus> flow = statuses.stream()
                .filter(s -> s.getName() != null && !isParkedStatus(s.getName()))
                .sorted(Comparator.comparingInt(IssueStatus::getSequence))
                .toList();
        List<IssueStatus> parked = statuses.stream()
                .filter(s -> s.getName() != null && isParkedStatus(s.getName()))
                .sorted(Comparator.comparingInt(IssueStatus::getSequence))
                .toList();

        int rowIdx = startRow;
        int col = 0;
        final int colsPerRow = 6;
        for (IssueStatus status : flow) {
            if (col == 0) {
                sheet.createRow(rowIdx);
            }
            Row row = sheet.getRow(rowIdx);
            int count = counts.getOrDefault(normalizeStatus(status.getName()), 0);
            Cell cell = row.createCell(col);
            cell.setCellValue(String.format("%02d. %s (%d)", status.getSequence(), status.getName(), count));
            cell.setCellStyle(styles.stageChip);
            col++;
            if (col >= colsPerRow) {
                col = 0;
                rowIdx++;
            }
        }
        if (col != 0) {
            rowIdx++;
        }

        if (!parked.isEmpty()) {
            Row parkedLabel = sheet.createRow(rowIdx++);
            Cell parkedCell = parkedLabel.createCell(0);
            parkedCell.setCellValue("PARKED");
            parkedCell.setCellStyle(styles.section);
            Row parkedRow = sheet.createRow(rowIdx++);
            int pCol = 0;
            for (IssueStatus status : parked) {
                int count = counts.getOrDefault(normalizeStatus(status.getName()), 0);
                Cell cell = parkedRow.createCell(pCol++);
                cell.setCellValue(status.getName() + " (" + count + ")");
                cell.setCellStyle(styles.parkedChip);
            }
        }
        return rowIdx;
    }

    static String[] fieldKeys() {
        return FIELD_KEYS;
    }

    private static Map<String, Integer> countByStatus(List<RdIssue> issues) {
        Map<String, Integer> counts = new HashMap<>();
        for (RdIssue issue : issues) {
            if (issue.getStatus() == null || issue.getStatus().getName() == null) {
                continue;
            }
            String key = normalizeStatus(issue.getStatus().getName());
            counts.merge(key, 1, Integer::sum);
        }
        return counts;
    }

    private static int countWithField(
            Map<String, List<RdIssue>> byProject,
            Map<UUID, Map<String, FieldVal>> fieldsByIssueId,
            String... keys) {
        return (int) byProject.values().stream()
                .flatMap(List::stream)
                .filter(i -> hasAnyField(fieldsByIssueId.get(i.getId()), keys))
                .count();
    }

    private static double sumNumber(
            List<RdIssue> issues,
            Map<UUID, Map<String, FieldVal>> fieldsByIssueId,
            String key) {
        double sum = 0;
        for (RdIssue issue : issues) {
            FieldVal val = fieldsByIssueId.getOrDefault(issue.getId(), Map.of()).get(key);
            if (val != null && val.number != null) {
                sum += val.number.doubleValue();
            }
        }
        return sum;
    }

    private static boolean hasAnyField(Map<String, FieldVal> fields, String... keys) {
        if (fields == null || fields.isEmpty()) {
            return false;
        }
        for (String key : keys) {
            FieldVal val = fields.get(key);
            if (val == null) {
                continue;
            }
            if (val.date != null || val.number != null || (val.text != null && !val.text.isBlank())) {
                return true;
            }
        }
        return false;
    }

    private static boolean isActive(RdIssue issue) {
        if (issue.getStatus() == null) {
            return false;
        }
        if (issue.getStatus().isTerminal()) {
            return false;
        }
        String name = issue.getStatus().getName();
        return name == null || !isParkedStatus(name);
    }

    private static boolean isParkedStatus(String name) {
        String n = normalizeStatus(name);
        return "cancelled".equals(n) || "on hold".equals(n) || "onhold".equals(n);
    }

    private static String normalizeStatus(String name) {
        return name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static String uniqueSheetName(String projectName, Set<String> used) {
        String base = projectName.replaceAll("[\\\\/*?\\[\\]:]", "_").trim();
        if (base.isEmpty()) {
            base = "Project";
        }
        if (base.length() > 28) {
            base = base.substring(0, 28);
        }
        String candidate = base;
        int i = 1;
        while (!used.add(candidate)) {
            String suffix = " (" + i++ + ")";
            int max = 31 - suffix.length();
            candidate = base.substring(0, Math.min(base.length(), max)) + suffix;
        }
        return candidate;
    }

    private static String displayKey(RdIssue issue) {
        if (issue.getDisplayKey() != null && !issue.getDisplayKey().isBlank()) {
            return issue.getDisplayKey();
        }
        return issue.getId() != null ? issue.getId().toString() : "";
    }

    private static String assigneeName(RdIssue issue) {
        if (issue.getAssignedTo() == null) {
            return "Unassigned";
        }
        String first = issue.getAssignedTo().getFirstName() != null ? issue.getAssignedTo().getFirstName() : "";
        String last = issue.getAssignedTo().getLastName() != null ? issue.getAssignedTo().getLastName() : "";
        String name = (first + " " + last).trim();
        return name.isEmpty() ? "Unassigned" : name;
    }

    private static String projectName(RdIssue issue) {
        Project project = issue.getProject();
        if (project == null || project.getName() == null || project.getName().isBlank()) {
            return "Unknown project";
        }
        return project.getName().trim();
    }

    private static String engineeringManagerName(RdIssue issue) {
        Project project = issue.getProject();
        if (project == null) {
            return "";
        }
        TeamManagement em = project.getEngineeringManagerManagement();
        return em != null ? em.getFullName() : "";
    }

    private static String countryName(RdIssue issue) {
        Project project = issue.getProject();
        if (project == null) {
            return "";
        }
        Client client = project.getClient();
        if (client == null) {
            return "";
        }
        Country country = client.getCountry();
        return country != null && country.getName() != null ? country.getName() : "";
    }

    private static String vpName(RdIssue issue) {
        Project project = issue.getProject();
        if (project == null) {
            return "";
        }
        TeamManagement vp = ManagementHierarchyUtils.resolveVpFromEngineeringManager(
                project.getEngineeringManagerManagement());
        return vp != null ? vp.getFullName() : "";
    }

    private static String yesNo(Boolean value) {
        if (value == null) {
            return "";
        }
        return value ? "Yes" : "No";
    }

    private static void setText(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

    private static void setInt(Row row, int col, int value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    private static void setNumber(Row row, int col, double value, CellStyle style) {
        Cell cell = row.createCell(col);
        // Avoid "12." from formats like 0.## — write whole numbers as ints
        if (value == Math.rint(value) && !Double.isInfinite(value)) {
            cell.setCellValue((long) value);
        } else {
            cell.setCellValue(value);
        }
        cell.setCellStyle(style);
    }

    private static void setDate(Row row, int col, FieldVal val, CellStyle style) {
        Cell cell = row.createCell(col);
        if (val != null && val.date != null) {
            cell.setCellValue(DATE_FMT.format(val.date));
        } else {
            cell.setCellValue("");
        }
        cell.setCellStyle(style);
    }

    private static void setFieldNumber(Row row, int col, FieldVal val, CellStyle style) {
        Cell cell = row.createCell(col);
        if (val != null && val.number != null) {
            double value = val.number.doubleValue();
            if (value == Math.rint(value) && !Double.isInfinite(value)) {
                cell.setCellValue(val.number.longValue());
            } else {
                cell.setCellValue(value);
            }
        } else {
            cell.setCellValue("");
        }
        cell.setCellStyle(style);
    }

    private static String textOrNumber(FieldVal val) {
        if (val == null) {
            return "";
        }
        if (val.text != null && !val.text.isBlank()) {
            return val.text;
        }
        if (val.number != null) {
            return val.number.stripTrailingZeros().toPlainString();
        }
        if (val.date != null) {
            return DATE_FMT.format(val.date);
        }
        if (val.bool != null) {
            return val.bool ? "Yes" : "No";
        }
        return "";
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    public record FieldVal(String text, BigDecimal number, LocalDate date, Boolean bool) {
        public static FieldVal from(IssueFieldValue value) {
            return new FieldVal(
                    value.getValueText(),
                    value.getValueNumber(),
                    value.getValueDate(),
                    value.getValueBool());
        }
    }

    private record CategoryPalette(
            CellStyle banner,
            CellStyle fieldHeader,
            CellStyle text,
            CellStyle wrap,
            CellStyle number,
            CellStyle date) {
    }

    private static final class Styles {
        final CellStyle title;
        final CellStyle section;
        final CellStyle label;
        final CellStyle text;
        final CellStyle wrap;
        final CellStyle number;
        final CellStyle intNumber;
        final CellStyle date;
        final CellStyle tableHeader;
        final CellStyle statLabel;
        final CellStyle statValue;
        final CellStyle stageChip;
        final CellStyle parkedChip;
        private final Map<String, CategoryPalette> categoryPalettes;
        private final CategoryPalette defaultPalette;

        Styles(XSSFWorkbook workbook) {
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);

            Font bold = workbook.createFont();
            bold.setBold(true);

            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(org.apache.poi.ss.usermodel.IndexedColors.WHITE.getIndex());

            Font darkHeaderFont = workbook.createFont();
            darkHeaderFont.setBold(true);
            darkHeaderFont.setColor(org.apache.poi.ss.usermodel.IndexedColors.BLACK.getIndex());

            title = workbook.createCellStyle();
            title.setFont(titleFont);
            title.setVerticalAlignment(VerticalAlignment.CENTER);

            section = workbook.createCellStyle();
            section.setFont(bold);

            label = workbook.createCellStyle();
            label.setFont(bold);

            text = workbook.createCellStyle();
            text.setVerticalAlignment(VerticalAlignment.CENTER);

            wrap = workbook.createCellStyle();
            wrap.setWrapText(true);
            wrap.setVerticalAlignment(VerticalAlignment.TOP);

            // General avoids trailing "." that custom 0.## can show for whole numbers
            number = workbook.createCellStyle();
            number.setDataFormat(workbook.createDataFormat().getFormat("General"));
            number.setAlignment(HorizontalAlignment.RIGHT);

            intNumber = workbook.createCellStyle();
            intNumber.setDataFormat(workbook.createDataFormat().getFormat("0"));
            intNumber.setAlignment(HorizontalAlignment.RIGHT);

            date = workbook.createCellStyle();
            date.setAlignment(HorizontalAlignment.CENTER);

            tableHeader = solid(workbook, rgb(31, 78, 121));
            tableHeader.setFont(headerFont);
            tableHeader.setAlignment(HorizontalAlignment.CENTER);
            tableHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            setThinBorder(tableHeader);

            statLabel = solid(workbook, rgb(217, 226, 243));
            statLabel.setFont(bold);
            setThinBorder(statLabel);

            statValue = workbook.createCellStyle();
            statValue.setFont(bold);
            statValue.setAlignment(HorizontalAlignment.CENTER);
            setThinBorder(statValue);

            stageChip = solid(workbook, rgb(198, 224, 180));
            stageChip.setAlignment(HorizontalAlignment.CENTER);
            stageChip.setWrapText(true);
            setThinBorder(stageChip);

            parkedChip = solid(workbook, rgb(252, 213, 180));
            parkedChip.setAlignment(HorizontalAlignment.CENTER);
            setThinBorder(parkedChip);

            // Light schema: soft banner + softer field header + very light data tint
            // Dark text on all header cells for contrast on light fills
            categoryPalettes = new LinkedHashMap<>();
            categoryPalettes.put("Context", buildPalette(workbook, darkHeaderFont,
                    rgb(186, 230, 253), rgb(224, 242, 254), rgb(240, 249, 255)));
            categoryPalettes.put("Core", buildPalette(workbook, darkHeaderFont,
                    rgb(203, 213, 225), rgb(226, 232, 240), rgb(248, 250, 252)));
            categoryPalettes.put("General", buildPalette(workbook, darkHeaderFont,
                    rgb(199, 210, 254), rgb(224, 231, 255), rgb(238, 242, 255)));
            categoryPalettes.put("Dates", buildPalette(workbook, darkHeaderFont,
                    rgb(153, 246, 228), rgb(204, 251, 241), rgb(240, 253, 250)));
            categoryPalettes.put("Financials", buildPalette(workbook, darkHeaderFont,
                    rgb(253, 230, 138), rgb(254, 243, 199), rgb(255, 251, 235)));
            categoryPalettes.put("Man-days", buildPalette(workbook, darkHeaderFont,
                    rgb(187, 247, 208), rgb(220, 252, 231), rgb(240, 253, 244)));
            categoryPalettes.put("Milestones", buildPalette(workbook, darkHeaderFont,
                    rgb(221, 214, 254), rgb(237, 233, 254), rgb(250, 245, 255)));
            categoryPalettes.put("Risk", buildPalette(workbook, darkHeaderFont,
                    rgb(254, 205, 211), rgb(255, 228, 230), rgb(255, 241, 242)));
            categoryPalettes.put("Other", buildPalette(workbook, darkHeaderFont,
                    rgb(231, 229, 228), rgb(245, 245, 244), rgb(250, 250, 249)));
            defaultPalette = categoryPalettes.get("Other");
        }

        CategoryPalette paletteFor(String category) {
            return categoryPalettes.getOrDefault(category, defaultPalette);
        }

        private static CategoryPalette buildPalette(
                XSSFWorkbook workbook,
                Font darkBold,
                XSSFColor bannerColor,
                XSSFColor fieldHeaderColor,
                XSSFColor dataTint) {

            XSSFCellStyle banner = solid(workbook, bannerColor);
            banner.setFont(darkBold);
            banner.setAlignment(HorizontalAlignment.CENTER);
            banner.setVerticalAlignment(VerticalAlignment.CENTER);
            setThinBorder(banner);

            XSSFCellStyle fieldHeader = solid(workbook, fieldHeaderColor);
            fieldHeader.setFont(darkBold);
            fieldHeader.setAlignment(HorizontalAlignment.CENTER);
            fieldHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            fieldHeader.setWrapText(true);
            setThinBorder(fieldHeader);

            XSSFCellStyle text = solid(workbook, dataTint);
            text.setVerticalAlignment(VerticalAlignment.CENTER);
            setThinBorder(text);

            XSSFCellStyle wrap = solid(workbook, dataTint);
            wrap.setWrapText(true);
            wrap.setVerticalAlignment(VerticalAlignment.TOP);
            setThinBorder(wrap);

            XSSFCellStyle number = solid(workbook, dataTint);
            number.setDataFormat(workbook.createDataFormat().getFormat("General"));
            number.setAlignment(HorizontalAlignment.RIGHT);
            setThinBorder(number);

            XSSFCellStyle date = solid(workbook, dataTint);
            date.setAlignment(HorizontalAlignment.CENTER);
            setThinBorder(date);

            return new CategoryPalette(banner, fieldHeader, text, wrap, number, date);
        }

        private static XSSFCellStyle solid(XSSFWorkbook workbook, XSSFColor color) {
            XSSFCellStyle style = workbook.createCellStyle();
            style.setFillForegroundColor(color);
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            return style;
        }

        private static XSSFColor rgb(int r, int g, int b) {
            return new XSSFColor(new byte[]{(byte) r, (byte) g, (byte) b}, null);
        }

        private static void setThinBorder(CellStyle style) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
        }
    }
}
