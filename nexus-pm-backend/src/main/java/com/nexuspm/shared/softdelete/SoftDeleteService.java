package com.nexuspm.shared.softdelete;

import com.nexuspm.organisation.entity.Client;
import com.nexuspm.organisation.entity.Country;
import com.nexuspm.organisation.entity.Region;
import com.nexuspm.organisation.repository.ClientRepository;
import com.nexuspm.organisation.repository.CountryRepository;
import com.nexuspm.organisation.repository.RegionRepository;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SoftDeleteService {

    private final EntityManager entityManager;
    private final RegionRepository regionRepository;
    private final CountryRepository countryRepository;
    private final ClientRepository clientRepository;
    private final ProjectRepository projectRepository;
    private final AuditLogService auditLogService;

    @Transactional
    public void softDeleteRegion(UUID regionId) {
        Region region = loadActiveRegion(regionId);
        softDeleteAllocationsByRegion(regionId);
        softDeleteIssuesByRegion(regionId);
        softDeleteProjectsByRegion(regionId);
        softDeleteClientsByRegion(regionId);
        softDeleteCountriesByRegion(regionId);
        region.setDeleted(true);
        regionRepository.save(region);
        audit("SOFT_DELETE", "REGION", regionId, region.getName());
    }

    @Transactional
    public void restoreRegion(UUID regionId) {
        requireSuperAdmin();
        Region region = regionRepository.findById(regionId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Region not found", 404));
        region.setDeleted(false);
        regionRepository.save(region);
        restoreCountriesByRegion(regionId);
        restoreClientsByRegion(regionId);
        restoreProjectsByRegion(regionId);
        restoreIssuesByRegion(regionId);
        restoreAllocationsByRegion(regionId);
        audit("RESTORE", "REGION", regionId, region.getName());
    }

    @Transactional
    public void softDeleteCountry(UUID countryId) {
        Country country = loadActiveCountry(countryId);
        softDeleteAllocationsByCountry(countryId);
        softDeleteIssuesByCountry(countryId);
        softDeleteProjectsByCountry(countryId);
        softDeleteClientsByCountry(countryId);
        country.setDeleted(true);
        countryRepository.save(country);
        audit("SOFT_DELETE", "COUNTRY", countryId, country.getName());
    }

    @Transactional
    public void restoreCountry(UUID countryId) {
        requireSuperAdmin();
        Country country = countryRepository.findById(countryId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Country not found", 404));
        country.setDeleted(false);
        countryRepository.save(country);
        restoreClientsByCountry(countryId);
        restoreProjectsByCountry(countryId);
        restoreIssuesByCountry(countryId);
        restoreAllocationsByCountry(countryId);
        audit("RESTORE", "COUNTRY", countryId, country.getName());
    }

    @Transactional
    public void softDeleteClient(UUID clientId) {
        Client client = loadActiveClient(clientId);
        softDeleteAllocationsByClient(clientId);
        softDeleteIssuesByClient(clientId);
        softDeleteProjectsByClient(clientId);
        client.setDeleted(true);
        client.setStatus("DELETED");
        clientRepository.save(client);
        audit("SOFT_DELETE", "CLIENT", clientId, client.getName());
    }

    @Transactional
    public void restoreClient(UUID clientId) {
        requireSuperAdmin();
        Client client = clientRepository.findDetailedById(clientId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Client not found", 404));
        client.setDeleted(false);
        client.setStatus("ACTIVE");
        clientRepository.save(client);
        restoreProjectsByClient(clientId);
        restoreIssuesByClient(clientId);
        restoreAllocationsByClient(clientId);
        audit("RESTORE", "CLIENT", clientId, client.getName());
    }

    @Transactional
    public void softDeleteProject(UUID projectId) {
        Project project = loadActiveProject(projectId);
        softDeleteAllocationsByProject(projectId);
        softDeleteIssuesByProject(projectId);
        project.setDeleted(true);
        project.setArchived(true);
        project.setStatus("ARCHIVED");
        projectRepository.save(project);
        audit("SOFT_DELETE", "PROJECT", projectId, project.getName());
    }

    @Transactional
    public void restoreProject(UUID projectId) {
        requireSuperAdmin();
        Project project = projectRepository.findDetailedById(projectId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project not found", 404));
        project.setDeleted(false);
        project.setArchived(false);
        project.setStatus("ACTIVE");
        projectRepository.save(project);
        restoreIssuesByProject(projectId);
        restoreAllocationsByProject(projectId);
        audit("RESTORE", "PROJECT", projectId, project.getName());
    }

    @Transactional
    public void softDeleteIssue(UUID issueId) {
        softDeleteAllocationsByIssue(issueId);
        int updated = nativeUpdate("""
                UPDATE rd_issue SET deleted = 1
                WHERE id = ? AND deleted = 0
                """, issueId);
        if (updated == 0) {
            throw new BusinessException("NOT_FOUND", "Issue not found or already deleted", 404);
        }
        audit("SOFT_DELETE", "ISSUE", issueId, issueId.toString());
    }

    @Transactional
    public void restoreIssue(UUID issueId) {
        requireSuperAdmin();
        int updated = nativeUpdate("""
                UPDATE rd_issue SET deleted = 0
                WHERE id = ?
                """, issueId);
        if (updated == 0) {
            throw new BusinessException("NOT_FOUND", "Issue not found", 404);
        }
        restoreAllocationsByIssue(issueId);
        audit("RESTORE", "ISSUE", issueId, issueId.toString());
    }

    private Region loadActiveRegion(UUID id) {
        return regionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Region not found", 404));
    }

    private Country loadActiveCountry(UUID id) {
        return countryRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Country not found", 404));
    }

    private Client loadActiveClient(UUID id) {
        return clientRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Client not found", 404));
    }

    private Project loadActiveProject(UUID id) {
        return projectRepository.findDetailedByIdAndDeletedFalse(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project not found", 404));
    }

    private void requireSuperAdmin() {
        if (!SecurityUtils.isSuperAdmin()) {
            throw new BusinessException("ACCESS_DENIED", "Only Super Admin can restore deleted records", 403);
        }
    }

    private void audit(String action, String entityType, UUID entityId, String details) {
        auditLogService.log(SecurityUtils.currentUserId(), action, entityType, entityId, details, null);
    }

    private int nativeUpdate(String sql, UUID id) {
        return entityManager.createNativeQuery(sql)
                .setParameter(1, id.toString())
                .executeUpdate();
    }

    private void softDeleteAllocationsByRegion(UUID regionId) {
        nativeUpdate("""
                UPDATE allocation a
                INNER JOIN rd_issue i ON i.id = a.issue_id
                INNER JOIN project p ON p.id = i.project_id
                INNER JOIN client cl ON cl.id = p.client_id
                INNER JOIN country co ON co.id = cl.country_id
                SET a.deleted = 1
                WHERE a.deleted = 0 AND co.region_id = ?
                """, regionId);
    }

    private void softDeleteIssuesByRegion(UUID regionId) {
        nativeUpdate("""
                UPDATE rd_issue i
                INNER JOIN project p ON p.id = i.project_id
                INNER JOIN client cl ON cl.id = p.client_id
                INNER JOIN country co ON co.id = cl.country_id
                SET i.deleted = 1
                WHERE i.deleted = 0 AND co.region_id = ?
                """, regionId);
    }

    private void softDeleteProjectsByRegion(UUID regionId) {
        nativeUpdate("""
                UPDATE project p
                INNER JOIN client cl ON cl.id = p.client_id
                INNER JOIN country co ON co.id = cl.country_id
                SET p.deleted = 1, p.archived = 1, p.status = 'ARCHIVED'
                WHERE p.deleted = 0 AND co.region_id = ?
                """, regionId);
    }

    private void softDeleteClientsByRegion(UUID regionId) {
        nativeUpdate("""
                UPDATE client cl
                INNER JOIN country co ON co.id = cl.country_id
                SET cl.deleted = 1, cl.status = 'DELETED'
                WHERE cl.deleted = 0 AND co.region_id = ?
                """, regionId);
    }

    private void softDeleteCountriesByRegion(UUID regionId) {
        nativeUpdate("""
                UPDATE country SET deleted = 1
                WHERE deleted = 0 AND region_id = ?
                """, regionId);
    }

    private void restoreCountriesByRegion(UUID regionId) {
        nativeUpdate("UPDATE country SET deleted = 0 WHERE region_id = ?", regionId);
    }

    private void restoreClientsByRegion(UUID regionId) {
        nativeUpdate("""
                UPDATE client cl
                INNER JOIN country co ON co.id = cl.country_id
                SET cl.deleted = 0, cl.status = 'ACTIVE'
                WHERE co.region_id = ?
                """, regionId);
    }

    private void restoreProjectsByRegion(UUID regionId) {
        nativeUpdate("""
                UPDATE project p
                INNER JOIN client cl ON cl.id = p.client_id
                INNER JOIN country co ON co.id = cl.country_id
                SET p.deleted = 0, p.archived = 0, p.status = 'ACTIVE'
                WHERE co.region_id = ?
                """, regionId);
    }

    private void restoreIssuesByRegion(UUID regionId) {
        nativeUpdate("""
                UPDATE rd_issue i
                INNER JOIN project p ON p.id = i.project_id
                INNER JOIN client cl ON cl.id = p.client_id
                INNER JOIN country co ON co.id = cl.country_id
                SET i.deleted = 0
                WHERE co.region_id = ?
                """, regionId);
    }

    private void restoreAllocationsByRegion(UUID regionId) {
        nativeUpdate("""
                UPDATE allocation a
                INNER JOIN rd_issue i ON i.id = a.issue_id
                INNER JOIN project p ON p.id = i.project_id
                INNER JOIN client cl ON cl.id = p.client_id
                INNER JOIN country co ON co.id = cl.country_id
                SET a.deleted = 0
                WHERE co.region_id = ?
                """, regionId);
    }

    private void softDeleteAllocationsByCountry(UUID countryId) {
        nativeUpdate("""
                UPDATE allocation a
                INNER JOIN rd_issue i ON i.id = a.issue_id
                INNER JOIN project p ON p.id = i.project_id
                INNER JOIN client cl ON cl.id = p.client_id
                SET a.deleted = 1
                WHERE a.deleted = 0 AND cl.country_id = ?
                """, countryId);
    }

    private void softDeleteIssuesByCountry(UUID countryId) {
        nativeUpdate("""
                UPDATE rd_issue i
                INNER JOIN project p ON p.id = i.project_id
                INNER JOIN client cl ON cl.id = p.client_id
                SET i.deleted = 1
                WHERE i.deleted = 0 AND cl.country_id = ?
                """, countryId);
    }

    private void softDeleteProjectsByCountry(UUID countryId) {
        nativeUpdate("""
                UPDATE project p
                INNER JOIN client cl ON cl.id = p.client_id
                SET p.deleted = 1, p.archived = 1, p.status = 'ARCHIVED'
                WHERE p.deleted = 0 AND cl.country_id = ?
                """, countryId);
    }

    private void softDeleteClientsByCountry(UUID countryId) {
        nativeUpdate("""
                UPDATE client SET deleted = 1, status = 'DELETED'
                WHERE deleted = 0 AND country_id = ?
                """, countryId);
    }

    private void restoreClientsByCountry(UUID countryId) {
        nativeUpdate("""
                UPDATE client SET deleted = 0, status = 'ACTIVE'
                WHERE country_id = ?
                """, countryId);
    }

    private void restoreProjectsByCountry(UUID countryId) {
        nativeUpdate("""
                UPDATE project p
                INNER JOIN client cl ON cl.id = p.client_id
                SET p.deleted = 0, p.archived = 0, p.status = 'ACTIVE'
                WHERE cl.country_id = ?
                """, countryId);
    }

    private void restoreIssuesByCountry(UUID countryId) {
        nativeUpdate("""
                UPDATE rd_issue i
                INNER JOIN project p ON p.id = i.project_id
                INNER JOIN client cl ON cl.id = p.client_id
                SET i.deleted = 0
                WHERE cl.country_id = ?
                """, countryId);
    }

    private void restoreAllocationsByCountry(UUID countryId) {
        nativeUpdate("""
                UPDATE allocation a
                INNER JOIN rd_issue i ON i.id = a.issue_id
                INNER JOIN project p ON p.id = i.project_id
                INNER JOIN client cl ON cl.id = p.client_id
                SET a.deleted = 0
                WHERE cl.country_id = ?
                """, countryId);
    }

    private void softDeleteAllocationsByClient(UUID clientId) {
        nativeUpdate("""
                UPDATE allocation a
                INNER JOIN rd_issue i ON i.id = a.issue_id
                INNER JOIN project p ON p.id = i.project_id
                SET a.deleted = 1
                WHERE a.deleted = 0 AND p.client_id = ?
                """, clientId);
    }

    private void softDeleteIssuesByClient(UUID clientId) {
        nativeUpdate("""
                UPDATE rd_issue i
                INNER JOIN project p ON p.id = i.project_id
                SET i.deleted = 1
                WHERE i.deleted = 0 AND p.client_id = ?
                """, clientId);
    }

    private void softDeleteProjectsByClient(UUID clientId) {
        nativeUpdate("""
                UPDATE project SET deleted = 1, archived = 1, status = 'ARCHIVED'
                WHERE deleted = 0 AND client_id = ?
                """, clientId);
    }

    private void restoreProjectsByClient(UUID clientId) {
        nativeUpdate("""
                UPDATE project SET deleted = 0, archived = 0, status = 'ACTIVE'
                WHERE client_id = ?
                """, clientId);
    }

    private void restoreIssuesByClient(UUID clientId) {
        nativeUpdate("""
                UPDATE rd_issue i
                INNER JOIN project p ON p.id = i.project_id
                SET i.deleted = 0
                WHERE p.client_id = ?
                """, clientId);
    }

    private void restoreAllocationsByClient(UUID clientId) {
        nativeUpdate("""
                UPDATE allocation a
                INNER JOIN rd_issue i ON i.id = a.issue_id
                INNER JOIN project p ON p.id = i.project_id
                SET a.deleted = 0
                WHERE p.client_id = ?
                """, clientId);
    }

    private void softDeleteAllocationsByProject(UUID projectId) {
        nativeUpdate("""
                UPDATE allocation a
                INNER JOIN rd_issue i ON i.id = a.issue_id
                SET a.deleted = 1
                WHERE a.deleted = 0 AND i.project_id = ?
                """, projectId);
    }

    private void softDeleteIssuesByProject(UUID projectId) {
        nativeUpdate("""
                UPDATE rd_issue SET deleted = 1
                WHERE deleted = 0 AND project_id = ?
                """, projectId);
    }

    private void restoreIssuesByProject(UUID projectId) {
        nativeUpdate("UPDATE rd_issue SET deleted = 0 WHERE project_id = ?", projectId);
    }

    private void restoreAllocationsByProject(UUID projectId) {
        nativeUpdate("""
                UPDATE allocation a
                INNER JOIN rd_issue i ON i.id = a.issue_id
                SET a.deleted = 0
                WHERE i.project_id = ?
                """, projectId);
    }

    private void softDeleteAllocationsByIssue(UUID issueId) {
        nativeUpdate("""
                UPDATE allocation SET deleted = 1
                WHERE deleted = 0 AND issue_id = ?
                """, issueId);
    }

    private void restoreAllocationsByIssue(UUID issueId) {
        nativeUpdate("UPDATE allocation SET deleted = 0 WHERE issue_id = ?", issueId);
    }
}
