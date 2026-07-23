package com.nexuspm.shared.exception;

import com.nexuspm.resource.exception.OverAllocationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(OverAllocationException.class)
    public ProblemDetail handleOverAllocation(OverAllocationException ex) {
        log.warn("Over-allocation rejected: {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setTitle("OVER_ALLOCATION");
        problem.setType(URI.create("about:blank"));
        problem.setProperty("timestamp", Instant.now());
        problem.setProperty("existingTotal", ex.getExistingTotal());
        problem.setProperty("totalWouldBe", ex.getTotalWouldBe());
        problem.setProperty("breakdown", ex.getBreakdown());
        return problem;
    }

    @ExceptionHandler(BusinessException.class)
    public ProblemDetail handleBusiness(BusinessException ex) {
        log.warn("Business exception code={} status={} message={}", ex.getErrorCode(), ex.getStatus(), ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.valueOf(ex.getStatus()), ex.getMessage());
        problem.setTitle(ex.getErrorCode());
        problem.setType(URI.create("about:blank"));
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ProblemDetail handleBadCredentials(BadCredentialsException ex) {
        log.warn("Authentication failed: {}", ex.getMessage());
        return problem(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", ex.getMessage());
    }

    @ExceptionHandler(LockedException.class)
    public ProblemDetail handleLocked(LockedException ex) {
        log.warn("Account locked: {}", ex.getMessage());
        ProblemDetail problem = problem(HttpStatus.LOCKED, "ACCOUNT_LOCKED", ex.getMessage());
        problem.setStatus(HttpStatus.LOCKED);
        return problem;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return problem(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "You do not have permission to perform this action");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        log.warn("Validation failed fields={}", errors.keySet());
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Request validation failed");
        problem.setProperty("errors", errors);
        return problem;
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex) {
        String detail = "This value conflicts with an existing record";
        String message = ex.getMostSpecificCause().getMessage();
        if (message != null) {
            if (message.contains("designation.name")) {
                detail = "A designation with this name already exists";
            } else if (message.contains("designation.code")) {
                detail = "A designation with this code already exists";
            } else if (message.contains("fk_issue_assignee") || message.contains("assigned_to")) {
                detail = "This employee is assigned to one or more issues. "
                        + "Reassign or clear those issues before deleting.";
            } else if (message.contains("employee_role") || message.contains("fk_er_role")) {
                detail = "Role is assigned to employees and cannot be deleted";
            } else if (message.contains("fk_employee_management") || message.contains("team_management_id")) {
                detail = "This management person is linked to a login account. "
                        + "Deactivate the user under Admin → User management before replacing or deleting the roster.";
            } else if (message.contains("fk_project_vp") || message.contains("fk_project_em")
                    || message.contains("vp_management_id") || message.contains("engineering_manager_management_id")) {
                detail = "This management person is assigned as VP or Engineering Manager on one or more projects. "
                        + "Remove or reassign them on those projects before deleting.";
            } else if (message.contains("Duplicate entry")) {
                int start = message.indexOf('\'');
                int end = message.indexOf('\'', start + 1);
                if (start >= 0 && end > start) {
                    detail = "Duplicate value: " + message.substring(start + 1, end);
                }
            }
        }
        log.warn("Data integrity violation: {}", detail);
        return problem(HttpStatus.BAD_REQUEST, "DUPLICATE", detail);
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An unexpected error occurred");
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setType(URI.create("about:blank"));
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }
}
