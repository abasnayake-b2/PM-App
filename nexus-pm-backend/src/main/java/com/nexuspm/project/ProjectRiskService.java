package com.nexuspm.project;

import com.nexuspm.project.entity.Project;
import com.nexuspm.project.entity.ProjectRisk;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.project.repository.ProjectRiskRepository;
import com.nexuspm.risk.RiskValidation;
import com.nexuspm.risk.dto.CreateRiskRequest;
import com.nexuspm.risk.dto.RiskResponse;
import com.nexuspm.risk.dto.UpdateRiskRequest;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectRiskService {

    private final ProjectRiskRepository riskRepository;
    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<RiskResponse> listRisks(UUID projectId) {
        loadProjectWithAccess(projectId);
        return riskRepository.findActiveByProjectId(projectId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public RiskResponse createRisk(UUID projectId, CreateRiskRequest request) {
        Project project = loadProjectEntity(projectId);
        RiskValidation.validateDates(request.getCreatedDate(), request.getClosedDate());
        RiskValidation.validateStatus(request.getStatus());
        RiskValidation.validateImpact(request.getImpact());

        ProjectRisk risk = new ProjectRisk();
        risk.setId(UUID.randomUUID());
        risk.setProject(project);
        risk.setRiskNumber(riskRepository.findMaxRiskNumber(projectId) + 1);
        risk.setDescription(RiskValidation.trimToNull(request.getDescription()));
        risk.setCreatedDate(request.getCreatedDate());
        risk.setOwner(RiskValidation.trimToNull(request.getOwner()));
        risk.setStatus(RiskValidation.trimToNull(request.getStatus()));
        risk.setImpact(RiskValidation.trimToNull(request.getImpact()));
        risk.setClosedDate(request.getClosedDate());
        risk.setMitigation(RiskValidation.trimToNull(request.getMitigation()));

        riskRepository.save(risk);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "CREATE",
                "PROJECT_RISK",
                risk.getId(),
                risk.getDisplayKey() + " on " + project.getName(),
                null);
        return toResponse(risk);
    }

    @Transactional
    public RiskResponse updateRisk(UUID riskId, UpdateRiskRequest request) {
        ProjectRisk risk = loadRiskWithAccess(riskId);
        applyUpdate(risk, request);
        RiskValidation.validateDates(risk.getCreatedDate(), risk.getClosedDate());
        riskRepository.save(risk);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "UPDATE",
                "PROJECT_RISK",
                risk.getId(),
                risk.getDisplayKey(),
                null);
        return toResponse(risk);
    }

    @Transactional
    public void deleteRisk(UUID riskId) {
        ProjectRisk risk = loadRiskWithAccess(riskId);
        risk.setDeleted(true);
        riskRepository.save(risk);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "DELETE",
                "PROJECT_RISK",
                risk.getId(),
                risk.getDisplayKey(),
                null);
    }

    private void loadProjectWithAccess(UUID projectId) {
        projectService.getProject(projectId);
    }

    private Project loadProjectEntity(UUID projectId) {
        projectService.getProject(projectId);
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project not found", 404));
    }

    private ProjectRisk loadRiskWithAccess(UUID riskId) {
        ProjectRisk risk = riskRepository.findActiveDetailedById(riskId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Risk not found", 404));
        projectService.getProject(risk.getProject().getId());
        return risk;
    }

    private void applyUpdate(ProjectRisk risk, UpdateRiskRequest request) {
        if (request.getDescription() != null) {
            risk.setDescription(RiskValidation.trimToNull(request.getDescription()));
        }
        if (Boolean.TRUE.equals(request.getClearCreatedDate())) {
            risk.setCreatedDate(null);
        } else if (request.getCreatedDate() != null) {
            risk.setCreatedDate(request.getCreatedDate());
        }
        if (Boolean.TRUE.equals(request.getClearOwner())) {
            risk.setOwner(null);
        } else if (request.getOwner() != null) {
            risk.setOwner(RiskValidation.trimToNull(request.getOwner()));
        }
        if (Boolean.TRUE.equals(request.getClearStatus())) {
            risk.setStatus(null);
        } else if (request.getStatus() != null) {
            RiskValidation.validateStatus(request.getStatus());
            risk.setStatus(RiskValidation.trimToNull(request.getStatus()));
        }
        if (Boolean.TRUE.equals(request.getClearImpact())) {
            risk.setImpact(null);
        } else if (request.getImpact() != null) {
            RiskValidation.validateImpact(request.getImpact());
            risk.setImpact(RiskValidation.trimToNull(request.getImpact()));
        }
        if (Boolean.TRUE.equals(request.getClearClosedDate())) {
            risk.setClosedDate(null);
        } else if (request.getClosedDate() != null) {
            risk.setClosedDate(request.getClosedDate());
        }
        if (Boolean.TRUE.equals(request.getClearMitigation())) {
            risk.setMitigation(null);
        } else if (request.getMitigation() != null) {
            risk.setMitigation(RiskValidation.trimToNull(request.getMitigation()));
        }
    }

    private RiskResponse toResponse(ProjectRisk risk) {
        return RiskResponse.builder()
                .id(risk.getId())
                .parentId(risk.getProject().getId())
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
}
