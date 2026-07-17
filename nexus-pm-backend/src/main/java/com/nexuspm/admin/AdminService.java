package com.nexuspm.admin;

import com.nexuspm.admin.dto.*;
import com.nexuspm.admin.entity.*;
import com.nexuspm.admin.repository.*;
import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.repository.IssueStatusRepository;
import com.nexuspm.lookup.repository.IssueTypeRepository;
import com.nexuspm.organisation.entity.Country;
import com.nexuspm.organisation.repository.CountryRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.audit.entity.AuditLog;
import com.nexuspm.shared.audit.repository.AuditLogRepository;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AuditLogRepository auditLogRepository;
    private final EmployeeRepository employeeRepository;
    private final HolidayCalendarRepository holidayCalendarRepository;
    private final CountryRepository countryRepository;
    private final WorkflowRuleRepository workflowRuleRepository;
    private final IssueTypeRepository issueTypeRepository;
    private final IssueStatusRepository issueStatusRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final NotificationTemplateRepository notificationTemplateRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> listAuditLogs(String search, Pageable pageable) {
        String term = search != null && !search.isBlank() ? search.trim() : null;
        Page<AuditLog> page = term == null
                ? auditLogRepository.findAllByOrderByCreatedAtDesc(pageable)
                : auditLogRepository.search(term, pageable);
        Set<UUID> employeeIds = page.getContent().stream()
                .map(AuditLog::getEmployeeId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, String> names = loadEmployeeNames(employeeIds);
        return page.map(log -> toAuditResponse(log, names.get(log.getEmployeeId())));
    }

    @Transactional(readOnly = true)
    public List<HolidayResponse> listHolidays() {
        return holidayCalendarRepository.findAllWithCountry().stream()
                .map(this::toHolidayResponse)
                .toList();
    }

    @Transactional
    public HolidayResponse createHoliday(CreateHolidayRequest request) {
        HolidayCalendar holiday = new HolidayCalendar();
        holiday.setId(UUID.randomUUID());
        holiday.setName(request.getName().trim());
        holiday.setHolidayDate(request.getHolidayDate());
        if (request.getCountryId() != null) {
            Country country = countryRepository.findById(request.getCountryId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Country not found", 404));
            holiday.setCountry(country);
        }
        holidayCalendarRepository.save(holiday);
        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "HOLIDAY", holiday.getId(), holiday.getName(), null);
        return toHolidayResponse(holiday);
    }

    @Transactional
    public void deleteHoliday(UUID id) {
        HolidayCalendar holiday = holidayCalendarRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Holiday not found", 404));
        holidayCalendarRepository.delete(holiday);
        auditLogService.log(SecurityUtils.currentUserId(), "DELETE", "HOLIDAY", id, holiday.getName(), null);
    }

    @Transactional(readOnly = true)
    public List<WorkflowRuleResponse> listWorkflowRules() {
        return workflowRuleRepository.findAllDetailed().stream()
                .map(this::toWorkflowResponse)
                .toList();
    }

    @Transactional
    public WorkflowRuleResponse createWorkflowRule(CreateWorkflowRuleRequest request) {
        IssueType issueType = issueTypeRepository.findById(request.getIssueTypeId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue type not found", 404));
        IssueStatus from = issueStatusRepository.findById(request.getFromStatusId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "From status not found", 404));
        IssueStatus to = issueStatusRepository.findById(request.getToStatusId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "To status not found", 404));

        WorkflowRule rule = new WorkflowRule();
        rule.setId(UUID.randomUUID());
        rule.setIssueType(issueType);
        rule.setFromStatus(from);
        rule.setToStatus(to);
        workflowRuleRepository.save(rule);
        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "WORKFLOW_RULE", rule.getId(),
                issueType.getName() + ": " + from.getName() + " → " + to.getName(), null);
        return toWorkflowResponse(workflowRuleRepository.findAllDetailed().stream()
                .filter(r -> r.getId().equals(rule.getId()))
                .findFirst()
                .orElseThrow());
    }

    @Transactional
    public void deleteWorkflowRule(UUID id) {
        WorkflowRule rule = workflowRuleRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Workflow rule not found", 404));
        workflowRuleRepository.delete(rule);
        auditLogService.log(SecurityUtils.currentUserId(), "DELETE", "WORKFLOW_RULE", id, null, null);
    }

    @Transactional(readOnly = true)
    public List<SystemSettingResponse> listSettings() {
        return systemSettingRepository.findAllByOrderBySettingKeyAsc().stream()
                .map(this::toSettingResponse)
                .toList();
    }

    @Transactional
    public SystemSettingResponse updateSetting(UUID id, UpdateSettingRequest request) {
        SystemSetting setting = systemSettingRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Setting not found", 404));
        setting.setSettingValue(request.getSettingValue());
        setting.setUpdatedBy(SecurityUtils.currentUserId());
        systemSettingRepository.save(setting);
        auditLogService.log(SecurityUtils.currentUserId(), "UPDATE", "SYSTEM_SETTING", setting.getId(),
                setting.getSettingKey(), null);
        return toSettingResponse(setting);
    }

    @Transactional(readOnly = true)
    public List<NotificationTemplateResponse> listNotificationTemplates() {
        return notificationTemplateRepository.findAllByOrderByCodeAsc().stream()
                .map(t -> NotificationTemplateResponse.builder()
                        .id(t.getId())
                        .code(t.getCode())
                        .subject(t.getSubject())
                        .bodyTemplate(t.getBodyTemplate())
                        .build())
                .toList();
    }

    private Map<UUID, String> loadEmployeeNames(Set<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> names = new HashMap<>();
        employeeRepository.findAllById(ids).forEach(e ->
                names.put(e.getId(), e.getFirstName() + " " + e.getLastName()));
        return names;
    }

    private AuditLogResponse toAuditResponse(AuditLog log, String employeeName) {
        return AuditLogResponse.builder()
                .id(log.getId())
                .employeeId(log.getEmployeeId())
                .employeeName(employeeName)
                .action(log.getAction())
                .entityType(log.getEntityType())
                .entityId(log.getEntityId())
                .details(log.getDetails())
                .ipAddress(log.getIpAddress())
                .createdAt(log.getCreatedAt())
                .build();
    }

    private HolidayResponse toHolidayResponse(HolidayCalendar h) {
        Country country = h.getCountry();
        return HolidayResponse.builder()
                .id(h.getId())
                .name(h.getName())
                .holidayDate(h.getHolidayDate())
                .countryId(country != null ? country.getId() : null)
                .countryName(country != null ? country.getName() : null)
                .build();
    }

    private WorkflowRuleResponse toWorkflowResponse(WorkflowRule w) {
        return WorkflowRuleResponse.builder()
                .id(w.getId())
                .issueTypeId(w.getIssueType().getId())
                .issueTypeName(w.getIssueType().getName())
                .fromStatusId(w.getFromStatus().getId())
                .fromStatusName(w.getFromStatus().getName())
                .toStatusId(w.getToStatus().getId())
                .toStatusName(w.getToStatus().getName())
                .build();
    }

    private SystemSettingResponse toSettingResponse(SystemSetting s) {
        return SystemSettingResponse.builder()
                .id(s.getId())
                .settingKey(s.getSettingKey())
                .settingValue(s.getSettingValue())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
