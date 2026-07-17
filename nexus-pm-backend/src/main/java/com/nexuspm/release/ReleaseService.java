package com.nexuspm.release;

import com.nexuspm.project.ProjectService;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.release.dto.CreateReleaseRequest;
import com.nexuspm.release.dto.ReleaseResponse;
import com.nexuspm.release.entity.Release;
import com.nexuspm.release.repository.ReleaseRepository;
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
public class ReleaseService {

    private final ReleaseRepository releaseRepository;
    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<ReleaseResponse> listReleases(UUID projectId) {
        if (projectId != null) {
            projectService.getProject(projectId);
            return releaseRepository.findByProject(projectId).stream()
                    .map(this::toResponse)
                    .toList();
        }
        if (SecurityUtils.isAdmin()) {
            return releaseRepository.findByProject(null).stream()
                    .map(this::toResponse)
                    .toList();
        }
        List<UUID> projectIds = projectService.getAccessibleProjectIds();
        if (projectIds == null || projectIds.isEmpty()) {
            return List.of();
        }
        return releaseRepository.findByProjectIds(projectIds).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ReleaseResponse createRelease(CreateReleaseRequest request) {
        projectService.getProject(request.getProjectId());
        if (!SecurityUtils.isManagerOrAbove()) {
            throw new BusinessException("ACCESS_DENIED", "Only managers can create releases", 403);
        }
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project not found", 404));

        Release release = new Release();
        release.setId(UUID.randomUUID());
        release.setProject(project);
        release.setName(request.getName());
        release.setVersion(request.getVersion());
        release.setStatus(request.getStatus() != null ? request.getStatus().toUpperCase() : "PLANNED");
        release.setTargetDate(request.getTargetDate());
        releaseRepository.save(release);

        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "RELEASE", release.getId(), release.getName(), null);
        return toResponse(release);
    }

    private ReleaseResponse toResponse(Release release) {
        return ReleaseResponse.builder()
                .id(release.getId())
                .projectId(release.getProject().getId())
                .projectName(release.getProject().getName())
                .name(release.getName())
                .version(release.getVersion())
                .status(release.getStatus())
                .targetDate(release.getTargetDate())
                .build();
    }
}
