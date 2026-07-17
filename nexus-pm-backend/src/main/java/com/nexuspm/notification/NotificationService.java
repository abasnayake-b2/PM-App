package com.nexuspm.notification;

import com.nexuspm.notification.dto.NotificationResponse;
import com.nexuspm.notification.dto.UnreadCountResponse;
import com.nexuspm.notification.entity.Notification;
import com.nexuspm.notification.repository.NotificationRepository;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final EmployeeRepository employeeRepository;

    @Transactional(readOnly = true)
    public List<NotificationResponse> listForCurrentUser() {
        UUID userId = SecurityUtils.currentUserId();
        return notificationRepository.findByEmployee_IdOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse unreadCount() {
        long count = notificationRepository.countByEmployee_IdAndReadFlagFalse(SecurityUtils.currentUserId());
        return UnreadCountResponse.builder().count(count).build();
    }

    @Transactional
    public NotificationResponse markRead(UUID id) {
        Notification notification = loadOwned(id);
        notification.setReadFlag(true);
        return toResponse(notificationRepository.save(notification));
    }

    @Transactional
    public void markAllRead() {
        notificationRepository.markAllRead(SecurityUtils.currentUserId());
    }

    @Transactional
    public void notifyEmployee(UUID employeeId, String title, String body, String type) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        Notification notification = new Notification();
        notification.setId(UUID.randomUUID());
        notification.setEmployee(employee);
        notification.setTitle(title);
        notification.setBody(body);
        notification.setType(type);
        notification.setReadFlag(false);
        notificationRepository.save(notification);
    }

    private Notification loadOwned(UUID id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Notification not found", 404));
        if (!notification.getEmployee().getId().equals(SecurityUtils.currentUserId())) {
            throw new BusinessException("ACCESS_DENIED", "Not your notification", 403);
        }
        return notification;
    }

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .title(n.getTitle())
                .body(n.getBody())
                .type(n.getType())
                .read(n.isReadFlag())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
