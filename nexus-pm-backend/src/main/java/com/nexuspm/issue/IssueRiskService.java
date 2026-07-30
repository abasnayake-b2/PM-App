package com.nexuspm.issue;

import com.nexuspm.issue.dto.CreateIssueRiskRequest;
import com.nexuspm.issue.dto.IssueRiskResponse;
import com.nexuspm.issue.dto.UpdateIssueRiskRequest;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.entity.RdIssueRisk;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.issue.repository.RdIssueRiskRepository;
import com.nexuspm.project.ProjectService;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IssueRiskService {

    private static final Set<String> STATUSES = Set.of("Open", "Closed", "Hold", "Rejected");
    private static final Set<String> IMPACTS = Set.of("Low", "Mid", "High");

    private final RdIssueRiskRepository riskRepository;
    private final RdIssueRepository issueRepository;
    private final ProjectService projectService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<IssueRiskResponse> listRisks(UUID issueId) {
        loadIssueWithAccess(issueId);
        return riskRepository.findActiveByIssueId(issueId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public IssueRiskResponse createRisk(UUID issueId, CreateIssueRiskRequest request) {
        RdIssue issue = loadIssueWithAccess(issueId);
        validateDates(request.getCreatedDate(), request.getClosedDate());
        validateStatus(request.getStatus());
        validateImpact(request.getImpact());

        RdIssueRisk risk = new RdIssueRisk();
        risk.setId(UUID.randomUUID());
        risk.setIssue(issue);
        risk.setRiskNumber(riskRepository.findMaxRiskNumber(issueId) + 1);
        risk.setDescription(trimToNull(request.getDescription()));
        risk.setCreatedDate(request.getCreatedDate());
        risk.setOwner(trimToNull(request.getOwner()));
        risk.setStatus(trimToNull(request.getStatus()));
        risk.setImpact(trimToNull(request.getImpact()));
        risk.setClosedDate(request.getClosedDate());
        risk.setMitigation(trimToNull(request.getMitigation()));

        riskRepository.save(risk);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "CREATE",
                "ISSUE_RISK",
                risk.getId(),
                risk.getDisplayKey() + " on " + issue.getDisplayKey(),
                null);
        return toResponse(risk);
    }

    @Transactional
    public IssueRiskResponse updateRisk(UUID riskId, UpdateIssueRiskRequest request) {
        RdIssueRisk risk = loadRiskWithAccess(riskId);

        if (request.getDescription() != null) {
            risk.setDescription(trimToNull(request.getDescription()));
        }
        if (Boolean.TRUE.equals(request.getClearCreatedDate())) {
            risk.setCreatedDate(null);
        } else if (request.getCreatedDate() != null) {
            risk.setCreatedDate(request.getCreatedDate());
        }
        if (Boolean.TRUE.equals(request.getClearOwner())) {
            risk.setOwner(null);
        } else if (request.getOwner() != null) {
            risk.setOwner(trimToNull(request.getOwner()));
        }
        if (Boolean.TRUE.equals(request.getClearStatus())) {
            risk.setStatus(null);
        } else if (request.getStatus() != null) {
            validateStatus(request.getStatus());
            risk.setStatus(trimToNull(request.getStatus()));
        }
        if (Boolean.TRUE.equals(request.getClearImpact())) {
            risk.setImpact(null);
        } else if (request.getImpact() != null) {
            validateImpact(request.getImpact());
            risk.setImpact(trimToNull(request.getImpact()));
        }
        if (Boolean.TRUE.equals(request.getClearClosedDate())) {
            risk.setClosedDate(null);
        } else if (request.getClosedDate() != null) {
            risk.setClosedDate(request.getClosedDate());
        }
        if (Boolean.TRUE.equals(request.getClearMitigation())) {
            risk.setMitigation(null);
        } else if (request.getMitigation() != null) {
            risk.setMitigation(trimToNull(request.getMitigation()));
        }

        validateDates(risk.getCreatedDate(), risk.getClosedDate());
        riskRepository.save(risk);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "UPDATE",
                "ISSUE_RISK",
                risk.getId(),
                risk.getDisplayKey(),
                null);
        return toResponse(risk);
    }

    @Transactional
    public void deleteRisk(UUID riskId) {
        RdIssueRisk risk = loadRiskWithAccess(riskId);
        risk.setDeleted(true);
        riskRepository.save(risk);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "DELETE",
                "ISSUE_RISK",
                risk.getId(),
                risk.getDisplayKey(),
                null);
    }

    private RdIssue loadIssueWithAccess(UUID issueId) {
        RdIssue issue = issueRepository.findDetailedById(issueId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue not found", 404));
        projectService.getProject(issue.getProject().getId());
        return issue;
    }

    private RdIssueRisk loadRiskWithAccess(UUID riskId) {
        RdIssueRisk risk = riskRepository.findActiveDetailedById(riskId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Risk not found", 404));
        projectService.getProject(risk.getIssue().getProject().getId());
        return risk;
    }

    private void validateDates(LocalDate created, LocalDate closed) {
        if (created != null && closed != null && closed.isBefore(created)) {
            throw new BusinessException(
                    "VALIDATION",
                    "Risk Closed Date cannot be before Risk Created Date",
                    400);
        }
    }

    private void validateStatus(String status) {
        if (status == null || status.isBlank()) {
            return;
        }
        if (!STATUSES.contains(status.trim())) {
            throw new BusinessException(
                    "VALIDATION",
                    "Risk Status must be one of: Open, Closed, Hold, Rejected",
                    400);
        }
    }

    private void validateImpact(String impact) {
        if (impact == null || impact.isBlank()) {
            return;
        }
        if (!IMPACTS.contains(impact.trim())) {
            throw new BusinessException(
                    "VALIDATION",
                    "Risk Impact must be one of: Low, Mid, High",
                    400);
        }
    }

    private IssueRiskResponse toResponse(RdIssueRisk risk) {
        return IssueRiskResponse.builder()
                .id(risk.getId())
                .issueId(risk.getIssue().getId())
                .riskNumber(risk.getRiskNumber())
                .displayKey(risk.getDisplayKey())
                .description(risk.getDescription())
                .createdDate(risk.getCreatedDate())
                .owner(risk.getOwner())
                .status(risk.getStatus())
                .impact(risk.getImpact())
                .closedDate(risk.getClosedDate())
                .mitigation(risk.getMitigation())
                .createdAt(risk.getCreatedAt())
                .updatedAt(risk.getUpdatedAt())
                .build();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
