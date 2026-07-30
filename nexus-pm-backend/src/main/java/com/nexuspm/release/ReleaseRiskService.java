package com.nexuspm.release;

import com.nexuspm.project.ProjectService;
import com.nexuspm.release.entity.Release;
import com.nexuspm.release.entity.ReleaseRisk;
import com.nexuspm.release.repository.ReleaseRepository;
import com.nexuspm.release.repository.ReleaseRiskRepository;
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
public class ReleaseRiskService {

    private final ReleaseRiskRepository riskRepository;
    private final ReleaseRepository releaseRepository;
    private final ProjectService projectService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<RiskResponse> listRisks(UUID releaseId) {
        loadReleaseWithAccess(releaseId);
        return riskRepository.findActiveByReleaseId(releaseId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public RiskResponse createRisk(UUID releaseId, CreateRiskRequest request) {
        Release release = loadReleaseWithAccess(releaseId);
        RiskValidation.validateDates(request.getCreatedDate(), request.getClosedDate());
        RiskValidation.validateStatus(request.getStatus());
        RiskValidation.validateImpact(request.getImpact());

        ReleaseRisk risk = new ReleaseRisk();
        risk.setId(UUID.randomUUID());
        risk.setRelease(release);
        risk.setRiskNumber(riskRepository.findMaxRiskNumber(releaseId) + 1);
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
                "RELEASE_RISK",
                risk.getId(),
                risk.getDisplayKey() + " on " + release.getName(),
                null);
        return toResponse(risk);
    }

    @Transactional
    public RiskResponse updateRisk(UUID riskId, UpdateRiskRequest request) {
        ReleaseRisk risk = loadRiskWithAccess(riskId);
        applyUpdate(risk, request);
        RiskValidation.validateDates(risk.getCreatedDate(), risk.getClosedDate());
        riskRepository.save(risk);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "UPDATE",
                "RELEASE_RISK",
                risk.getId(),
                risk.getDisplayKey(),
                null);
        return toResponse(risk);
    }

    @Transactional
    public void deleteRisk(UUID riskId) {
        ReleaseRisk risk = loadRiskWithAccess(riskId);
        risk.setDeleted(true);
        riskRepository.save(risk);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "DELETE",
                "RELEASE_RISK",
                risk.getId(),
                risk.getDisplayKey(),
                null);
    }

    private Release loadReleaseWithAccess(UUID releaseId) {
        Release detailed = releaseRepository.findWithProjectById(releaseId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Release not found", 404));
        projectService.getProject(detailed.getProject().getId());
        return detailed;
    }

    private ReleaseRisk loadRiskWithAccess(UUID riskId) {
        ReleaseRisk risk = riskRepository.findActiveDetailedById(riskId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Risk not found", 404));
        projectService.getProject(risk.getRelease().getProject().getId());
        return risk;
    }

    private void applyUpdate(ReleaseRisk risk, UpdateRiskRequest request) {
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

    private RiskResponse toResponse(ReleaseRisk risk) {
        return RiskResponse.builder()
                .id(risk.getId())
                .parentId(risk.getRelease().getId())
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
