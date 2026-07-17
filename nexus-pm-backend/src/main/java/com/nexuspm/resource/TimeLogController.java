package com.nexuspm.resource;

import com.nexuspm.resource.dto.CreateTimeLogRequest;
import com.nexuspm.resource.dto.TimeLogResponse;
import com.nexuspm.resource.dto.WeeklyTimeSummaryResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/time-logs")
@RequiredArgsConstructor
public class TimeLogController {

    private final TimeLogService timeLogService;

    @GetMapping
    @PreAuthorize("@perm.can('ALLOCATIONS_VIEW')")
    public List<TimeLogResponse> listTimeLogs(
            @RequestParam(required = false) UUID employeeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return timeLogService.listTimeLogs(employeeId, from, to);
    }

    @GetMapping("/weekly-summary")
    @PreAuthorize("@perm.can('ALLOCATIONS_VIEW')")
    public WeeklyTimeSummaryResponse getWeeklySummary(
            @RequestParam(required = false) UUID employeeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return timeLogService.getWeeklySummary(employeeId, weekStart);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ALLOCATIONS_VIEW')")
    public TimeLogResponse createTimeLog(@Valid @RequestBody CreateTimeLogRequest request) {
        return timeLogService.createTimeLog(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ALLOCATIONS_VIEW')")
    public void deleteTimeLog(@PathVariable UUID id) {
        timeLogService.deleteTimeLog(id);
    }
}
