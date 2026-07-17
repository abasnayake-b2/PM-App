package com.nexuspm.auth;

import com.nexuspm.auth.dto.*;
import com.nexuspm.auth.entity.PasswordResetToken;
import com.nexuspm.auth.entity.RefreshToken;
import com.nexuspm.auth.entity.UserAuth;
import com.nexuspm.auth.repository.PasswordResetTokenRepository;
import com.nexuspm.auth.repository.RefreshTokenRepository;
import com.nexuspm.auth.repository.UserAuthRepository;
import com.nexuspm.auth.security.UserPrincipal;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.PermissionRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String REFRESH_COOKIE = "refreshToken";

    private final UserAuthRepository userAuthRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;
    private final AuditLogService auditLogService;
    private final DfnPmProperties properties;
    private final JavaMailSender mailSender;
    private final PermissionRepository permissionRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public LoginResult login(LoginRequest request, HttpServletRequest httpRequest) {
        UserAuth auth = userAuthRepository.findByEmployeeEmail(request.getEmail().toLowerCase())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!auth.isActive()) {
            throw new BusinessException("ACCOUNT_INACTIVE", "Account inactive. Contact administrator.", 403);
        }

        if (auth.getLockedUntil() != null && auth.getLockedUntil().isAfter(Instant.now())) {
            throw new LockedException(
                    "Account locked after too many failed login attempts. Contact your administrator.");
        }
        if (auth.getLockedUntil() != null) {
            auth.setLockedUntil(null);
        }

        if (!passwordEncoder.matches(request.getPassword(), auth.getPasswordHash())) {
            auth.setFailedAttempts(auth.getFailedAttempts() + 1);
            if (auth.getFailedAttempts() >= properties.getApp().getMaxFailedLoginAttempts()) {
                auth.setLockedUntil(Instant.now().plus(1, ChronoUnit.HOURS));
            }
            userAuthRepository.save(auth);
            throw new BadCredentialsException("Invalid email or password");
        }

        auth.setFailedAttempts(0);
        auth.setLockedUntil(null);
        if (auth.getPasswordChangedAt() == null) {
            auth.setPasswordChangedAt(auth.getCreatedAt() != null ? auth.getCreatedAt() : Instant.now());
        }
        userAuthRepository.save(auth);

        Employee employee = auth.getEmployee();
        String accessToken = jwtService.generateAccessToken(
                employee.getId(),
                employee.getEmail(),
                employee.getFullName(),
                employee.getPrimaryRoleCode(),
                employee.getDepartment() != null ? employee.getDepartment().getId() : null
        );

        String rawRefresh = generateSecureToken();
        saveRefreshToken(employee, rawRefresh);

        auditLogService.logLogin(employee.getId(), resolveClientIp(httpRequest));

        return LoginResult.builder()
                .refreshToken(rawRefresh)
                .tokenResponse(buildTokenResponse(accessToken, employee, auth))
                .build();
    }

    @Transactional
    public TokenResponse refresh(String rawRefreshToken) {
        String hash = hashToken(rawRefreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));

        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new BadCredentialsException("Refresh token expired or revoked");
        }

        Employee employee = stored.getEmployee();
        UserAuth auth = userAuthRepository.findByEmployeeId(employee.getId()).orElse(null);
        String accessToken = jwtService.generateAccessToken(
                employee.getId(),
                employee.getEmail(),
                employee.getFullName(),
                employee.getPrimaryRoleCode(),
                employee.getDepartment() != null ? employee.getDepartment().getId() : null
        );

        return buildTokenResponse(accessToken, employee, auth);
    }

    @Transactional(readOnly = true)
    public TokenResponse currentUser(UUID employeeId) {
        UserAuth auth = userAuthRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "User not found", 404));

        if (!auth.isActive()) {
            throw new BusinessException("ACCOUNT_INACTIVE", "Account inactive. Contact administrator.", 403);
        }

        Employee employee = auth.getEmployee();
        String accessToken = jwtService.generateAccessToken(
                employee.getId(),
                employee.getEmail(),
                employee.getFullName(),
                employee.getPrimaryRoleCode(),
                employee.getDepartment() != null ? employee.getDepartment().getId() : null
        );

        return buildTokenResponse(accessToken, employee, auth);
    }

    @Transactional
    public void logout(UserPrincipal principal, String accessToken, HttpServletRequest request) {
        if (accessToken != null && !accessToken.isBlank()) {
            try {
                var claims = jwtService.parseToken(accessToken);
                tokenBlacklistService.blacklistToken(accessToken, claims.getExpiration().toInstant());
            } catch (Exception ignored) {
                // token may already be invalid
            }
        }
        refreshTokenRepository.revokeAllForEmployee(principal.getId());
        auditLogService.logLogout(principal.getId(), resolveClientIp(request));
    }

    @Transactional
    public void requestPasswordReset(PasswordResetRequestDto request) {
        userAuthRepository.findByEmployeeEmail(request.getEmail().toLowerCase()).ifPresent(auth -> {
            String rawToken = generateSecureToken();
            PasswordResetToken resetToken = new PasswordResetToken();
            resetToken.setId(UUID.randomUUID());
            resetToken.setEmployee(auth.getEmployee());
            resetToken.setTokenHash(hashToken(rawToken));
            resetToken.setExpiresAt(Instant.now().plus(properties.getApp().getPasswordResetTtlHours(), ChronoUnit.HOURS));
            passwordResetTokenRepository.save(resetToken);

            String resetUrl = properties.getApp().getBaseUrl() + "/reset-password?token=" + rawToken;
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(auth.getEmployee().getEmail());
            message.setSubject("DFN-PlaniX — Password Reset");
            message.setText(
                    "You requested a password reset for DFN-PlaniX.\n\n"
                            + "Use this link to set a new password (valid for "
                            + properties.getApp().getPasswordResetTtlHours()
                            + " hour(s)):\n"
                            + resetUrl
                            + "\n\nIf you did not request this, you can ignore this email.");
            mailSender.send(message);
        });
    }

    @Transactional
    public void confirmPasswordReset(PasswordResetConfirmDto request) {
        PasswordResetToken token = passwordResetTokenRepository.findByTokenHash(hashToken(request.getToken()))
                .orElseThrow(() -> new BusinessException("INVALID_TOKEN", "Invalid or expired reset token", 400));

        if (token.isUsed() || token.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("INVALID_TOKEN", "Invalid or expired reset token", 400);
        }

        validatePasswordComplexity(request.getNewPassword());

        UserAuth auth = userAuthRepository.findByEmployeeId(token.getEmployee().getId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "User not found", 404));

        applyNewPassword(auth, request.getNewPassword());
        auth.setFailedAttempts(0);
        auth.setLockedUntil(null);
        userAuthRepository.save(auth);

        token.setUsed(true);
        passwordResetTokenRepository.save(token);
        refreshTokenRepository.revokeAllForEmployee(auth.getEmployee().getId());
    }

    @Transactional
    public LoginResult changePassword(UserPrincipal principal, ChangePasswordRequest request) {
        UserAuth auth = userAuthRepository.findByEmployeeId(principal.getId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "User not found", 404));

        if (!passwordEncoder.matches(request.getCurrentPassword(), auth.getPasswordHash())) {
            throw new BusinessException("INVALID_PASSWORD", "Current password is incorrect", 400);
        }

        if (passwordEncoder.matches(request.getNewPassword(), auth.getPasswordHash())) {
            throw new BusinessException("VALIDATION", "New password must be different from the current password", 400);
        }

        validatePasswordComplexity(request.getNewPassword());
        applyNewPassword(auth, request.getNewPassword());
        userAuthRepository.save(auth);
        refreshTokenRepository.revokeAllForEmployee(auth.getEmployee().getId());

        Employee employee = auth.getEmployee();
        String accessToken = jwtService.generateAccessToken(
                employee.getId(),
                employee.getEmail(),
                employee.getFullName(),
                employee.getPrimaryRoleCode(),
                employee.getDepartment() != null ? employee.getDepartment().getId() : null
        );
        String rawRefresh = generateSecureToken();
        saveRefreshToken(employee, rawRefresh);

        return LoginResult.builder()
                .refreshToken(rawRefresh)
                .tokenResponse(buildTokenResponse(accessToken, employee, auth))
                .build();
    }

    public static String getRefreshCookieName() {
        return REFRESH_COOKIE;
    }

    public static void applyNewPassword(UserAuth auth, String rawPassword, PasswordEncoder passwordEncoder) {
        auth.setPasswordHash(passwordEncoder.encode(rawPassword));
        auth.setPasswordChangedAt(Instant.now());
    }

    private void applyNewPassword(UserAuth auth, String rawPassword) {
        applyNewPassword(auth, rawPassword, passwordEncoder);
    }

    private TokenResponse buildTokenResponse(String accessToken, Employee employee, UserAuth auth) {
        int ageDays = passwordAgeDays(auth);
        int maxAgeDays = properties.getApp().getPasswordMaxAgeDays();
        boolean changeDue = ageDays >= maxAgeDays;

        return TokenResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresIn(jwtService.getAccessTokenTtlSeconds())
                .userId(employee.getId())
                .email(employee.getEmail())
                .name(employee.getFullName())
                .role(employee.getPrimaryRoleCode())
                .departmentId(employee.getDepartment() != null ? employee.getDepartment().getId() : null)
                .passwordChangeDue(changeDue)
                .passwordAgeDays(ageDays)
                .permissionCodes(List.copyOf(permissionRepository.findPermissionCodesByEmployeeId(employee.getId())))
                .orgWideVisibility(employee.isOrgWideVisibility())
                .build();
    }

    private int passwordAgeDays(UserAuth auth) {
        if (auth == null) {
            return 0;
        }
        Instant changedAt = auth.getPasswordChangedAt();
        if (changedAt == null) {
            changedAt = auth.getCreatedAt() != null ? auth.getCreatedAt() : Instant.now();
        }
        return (int) ChronoUnit.DAYS.between(changedAt, Instant.now());
    }

    private void saveRefreshToken(Employee employee, String rawRefresh) {
        RefreshToken token = new RefreshToken();
        token.setId(UUID.randomUUID());
        token.setEmployee(employee);
        token.setTokenHash(hashToken(rawRefresh));
        token.setExpiresAt(Instant.now().plus(properties.getJwt().getRefreshTokenTtlDays(), ChronoUnit.DAYS));
        refreshTokenRepository.save(token);
    }

    private String generateSecureToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to hash token", e);
        }
    }

    private void validatePasswordComplexity(String password) {
        if (password.length() < 8
                || !password.matches(".*[A-Z].*")
                || !password.matches(".*[a-z].*")
                || !password.matches(".*\\d.*")
                || !password.matches(".*[@#$%^&+=!].*")) {
            throw new BusinessException("WEAK_PASSWORD",
                    "Password must be at least 8 characters with upper, lower, digit, and special character", 400);
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
