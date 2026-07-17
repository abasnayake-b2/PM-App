package com.nexuspm.resource;

import com.nexuspm.resource.dto.*;
import com.nexuspm.resource.entity.Task;
import com.nexuspm.resource.entity.TimeLog;
import com.nexuspm.resource.mapper.ResourceMapper;
import com.nexuspm.resource.repository.TaskRepository;
import com.nexuspm.resource.repository.TimeLogRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TimeLogService {

    private final TimeLogRepository timeLogRepository;
    private final TaskRepository taskRepository;
    private final EmployeeRepository employeeRepository;
    private final ResourceMapper resourceMapper;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<TimeLogResponse> listTimeLogs(UUID employeeId, LocalDate from, LocalDate to) {
        UUID effectiveEmployeeId = resolveEmployeeId(employeeId);
        return timeLogRepository.search(effectiveEmployeeId, from, to).stream()
                .map(resourceMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public WeeklyTimeSummaryResponse getWeeklySummary(UUID employeeId, LocalDate weekStart) {
        UUID effectiveEmployeeId = resolveEmployeeId(employeeId);
        LocalDate start = weekStart != null
                ? weekStart.with(DayOfWeek.MONDAY)
                : LocalDate.now().with(DayOfWeek.MONDAY);
        LocalDate end = start.plusDays(7);

        List<Object[]> rows = timeLogRepository.sumHoursByDay(effectiveEmployeeId, start, end);
        BigDecimal total = BigDecimal.ZERO;
        List<WeeklyTimeSummaryResponse.DailyHours> days = new ArrayList<>();

        for (int i = 0; i < 7; i++) {
            LocalDate day = start.plusDays(i);
            BigDecimal hours = rows.stream()
                    .filter(r -> day.equals(r[0]))
                    .map(r -> (BigDecimal) r[1])
                    .findFirst()
                    .orElse(BigDecimal.ZERO);
            total = total.add(hours);
            days.add(WeeklyTimeSummaryResponse.DailyHours.builder().date(day).hours(hours).build());
        }

        return WeeklyTimeSummaryResponse.builder()
                .weekStart(start)
                .weekEnd(end.minusDays(1))
                .totalHours(total)
                .days(days)
                .build();
    }

    @Transactional
    public TimeLogResponse createTimeLog(CreateTimeLogRequest request) {
        Task task = taskRepository.findDetailedById(request.getTaskId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Task not found", 404));
        Employee employee = employeeRepository.findById(SecurityUtils.currentUserId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Current user not found", 404));

        TimeLog log = new TimeLog();
        log.setId(UUID.randomUUID());
        log.setEmployee(employee);
        log.setTask(task);
        log.setLogDate(request.getLogDate());
        log.setHours(request.getHours());
        log.setNotes(request.getNotes());

        timeLogRepository.save(log);
        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "TIME_LOG", log.getId(), task.getTitle(), null);
        return resourceMapper.toResponse(timeLogRepository.findDetailedById(log.getId()).orElseThrow());
    }

    @Transactional
    public void deleteTimeLog(UUID id) {
        TimeLog log = timeLogRepository.findDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Time log not found", 404));
        if (!SecurityUtils.isManagerOrAbove() && !log.getEmployee().getId().equals(SecurityUtils.currentUserId())) {
            throw new BusinessException("ACCESS_DENIED", "You can only delete your own time logs", 403);
        }
        timeLogRepository.delete(log);
        auditLogService.log(SecurityUtils.currentUserId(), "DELETE", "TIME_LOG", id, null, null);
    }

    private UUID resolveEmployeeId(UUID employeeId) {
        if (employeeId != null) {
            if (!SecurityUtils.isManagerOrAbove() && !employeeId.equals(SecurityUtils.currentUserId())) {
                throw new BusinessException("ACCESS_DENIED", "You can only view your own time logs", 403);
            }
            return employeeId;
        }
        return SecurityUtils.currentUserId();
    }
}
