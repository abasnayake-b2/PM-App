package com.nexuspm.resource;

import com.nexuspm.resource.dto.AllocationResponse;
import com.nexuspm.resource.dto.CapacityResponse;
import com.nexuspm.resource.dto.CreateAllocationRequest;
import com.nexuspm.resource.dto.RosterAllocationResourceResponse;
import com.nexuspm.resource.dto.UpdateAllocationRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/allocations")
@RequiredArgsConstructor
public class AllocationController {

    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private final AllocationService allocationService;
    private final AllocationTimelineExportService allocationTimelineExportService;

    @GetMapping
    @PreAuthorize("@perm.can('ALLOCATIONS_VIEW')")
    public List<AllocationResponse> listAllocations(
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) UUID issueId,
            @RequestParam(required = false) UUID employeeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return allocationService.listAllocations(projectId, issueId, employeeId, asOf, from, to);
    }

    @GetMapping("/capacity")
    @PreAuthorize("@perm.can('ALLOCATIONS_VIEW')")
    public List<CapacityResponse> getCapacity(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf,
            @RequestParam(required = false) String team,
            @RequestParam(required = false) String designationCode,
            @RequestParam(required = false) String engineeringManager,
            @RequestParam(required = false) String name) {
        return allocationService.getCapacity(from, to, asOf, team, designationCode, engineeringManager, name);
    }

    @GetMapping("/capacity/timeline/export")
    @PreAuthorize("@perm.can('ALLOCATIONS_VIEW')")
    public ResponseEntity<byte[]> exportTimeline(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf,
            @RequestParam(required = false) String team,
            @RequestParam(required = false) String designationCode,
            @RequestParam(required = false) String engineeringManager,
            @RequestParam(required = false) String name) throws IOException {
        byte[] body = allocationTimelineExportService.exportTimeline(
                from, to, asOf, team, designationCode, engineeringManager, name);

        String fromLabel = from != null ? FILE_DATE.format(from) : "start";
        String toLabel = to != null ? FILE_DATE.format(to) : "end";
        String filename = "resource-utilization-timeline-" + fromLabel + "-to-" + toLabel + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }

    @GetMapping("/roster-resources")
    @PreAuthorize("@perm.can('ALLOCATIONS_VIEW')")
    public List<RosterAllocationResourceResponse> listRosterResources() {
        return allocationService.listRosterAllocationResources();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ALLOCATIONS_CREATE')")
    public AllocationResponse createAllocation(@Valid @RequestBody CreateAllocationRequest request) {
        return allocationService.createAllocation(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.can('ALLOCATIONS_UPDATE')")
    public AllocationResponse updateAllocation(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAllocationRequest request) {
        return allocationService.updateAllocation(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ALLOCATIONS_DELETE')")
    public void deleteAllocation(@PathVariable UUID id) {
        allocationService.deleteAllocation(id);
    }
}
