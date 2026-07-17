package com.nexuspm.shared.audit;

import com.nexuspm.shared.audit.entity.AuditLog;
import com.nexuspm.shared.audit.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void log(UUID employeeId, String action, String entityType, UUID entityId, String details, String ipAddress) {
        AuditLog entry = new AuditLog();
        entry.setId(UUID.randomUUID());
        entry.setEmployeeId(employeeId);
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setDetails(details);
        entry.setIpAddress(ipAddress);
        auditLogRepository.save(entry);
    }

    public void logLogin(UUID employeeId, String ipAddress) {
        log(employeeId, "LOGIN", "USER_AUTH", employeeId, "User logged in", ipAddress);
    }

    public void logLogout(UUID employeeId, String ipAddress) {
        log(employeeId, "LOGOUT", "USER_AUTH", employeeId, "User logged out", ipAddress);
    }
}
