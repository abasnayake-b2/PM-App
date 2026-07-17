package com.nexuspm.teamroster;

import com.nexuspm.teamroster.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/team-roster")
@RequiredArgsConstructor
public class TeamRosterController {

    private final TeamRosterService teamRosterService;

    @GetMapping("/management")
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public List<TeamManagementResponse> listManagement(@RequestParam(required = false) String search) {
        return teamRosterService.listManagement(search);
    }

    @PostMapping("/management")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('TEAM_CREATE')")
    public TeamManagementResponse createManagement(@Valid @RequestBody TeamManagementRequest request) {
        return teamRosterService.createManagement(request);
    }

    @PutMapping("/management/{id}")
    @PreAuthorize("@perm.can('TEAM_UPDATE')")
    public TeamManagementResponse updateManagement(
            @PathVariable UUID id,
            @Valid @RequestBody TeamManagementRequest request) {
        return teamRosterService.updateManagement(id, request);
    }

    @DeleteMapping("/management/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('TEAM_DELETE')")
    public void deleteManagement(@PathVariable UUID id) {
        teamRosterService.deleteManagement(id);
    }

    @PostMapping("/management/relink-supervisors")
    @PreAuthorize("@perm.can('TEAM_UPDATE')")
    public RelinkSupervisorsResult relinkManagementSupervisors() {
        return teamRosterService.relinkManagementSupervisors();
    }

    @GetMapping("/members")
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public List<TeamRosterMemberResponse> listMembers(@RequestParam(required = false) String search) {
        return teamRosterService.listMembers(search);
    }

    @GetMapping("/members/engineering-managers")
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public List<String> listEngineeringManagers() {
        return teamRosterService.listEngineeringManagers();
    }

    @PostMapping("/members")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('TEAM_CREATE')")
    public TeamRosterMemberResponse createMember(@Valid @RequestBody TeamRosterMemberRequest request) {
        return teamRosterService.createMember(request);
    }

    @PutMapping("/members/{id}")
    @PreAuthorize("@perm.can('TEAM_UPDATE')")
    public TeamRosterMemberResponse updateMember(
            @PathVariable UUID id,
            @Valid @RequestBody TeamRosterMemberRequest request) {
        return teamRosterService.updateMember(id, request);
    }

    @DeleteMapping("/members/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('TEAM_DELETE')")
    public void deleteMember(@PathVariable UUID id) {
        teamRosterService.deleteMember(id);
    }

    @GetMapping("/members/{id}/photo")
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public ResponseEntity<Resource> getMemberPhoto(@PathVariable UUID id) {
        TeamRosterService.ProfilePictureFile photo = teamRosterService.loadMemberPhoto(id);
        return ResponseEntity.ok()
                .contentType(photo.mediaType())
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(photo.resource());
    }

    @PostMapping(value = "/members/{id}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@perm.can('TEAM_UPDATE')")
    public TeamRosterMemberResponse uploadMemberPhoto(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) {
        return teamRosterService.uploadMemberPhoto(id, file);
    }

    @DeleteMapping("/members/{id}/photo")
    @PreAuthorize("@perm.can('TEAM_UPDATE')")
    public TeamRosterMemberResponse deleteMemberPhoto(@PathVariable UUID id) {
        return teamRosterService.deleteMemberPhoto(id);
    }

    @PostMapping(value = "/import/management", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@perm.can('IMPORT_CREATE')")
    public TeamImportResult importManagementExcel(@RequestParam("file") MultipartFile file) {
        return teamRosterService.importManagementExcel(file);
    }

    @PostMapping(value = "/import/members", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@perm.can('IMPORT_CREATE')")
    public TeamImportResult importMembersExcel(@RequestParam("file") MultipartFile file) {
        return teamRosterService.importMembersExcel(file);
    }

    @GetMapping("/import/management/latest")
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public TeamImportResult latestManagementImport() {
        return teamRosterService.latestManagementImport().orElse(null);
    }

    @GetMapping("/import/members/latest")
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public TeamImportResult latestMembersImport() {
        return teamRosterService.latestMembersImport().orElse(null);
    }
}
