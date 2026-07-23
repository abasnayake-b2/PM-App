package com.nexuspm.shared.logging;

import com.nexuspm.auth.security.UserPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Logs each HTTP request/response at INFO: method, path, status, duration, user, IP.
 * Does not log bodies, Authorization headers, cookies, or query strings (token-safe).
 * Registered only via SecurityFilterChain (not as a servlet Filter bean).
 */
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);
    public static final String MDC_REQUEST_ID = "requestId";
    public static final String MDC_USER = "user";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = normalizePath(request);
        return path.startsWith("/actuator/health")
                || path.startsWith("/swagger-ui")
                || path.startsWith("/api-docs")
                || path.equals("/swagger-ui.html")
                || path.endsWith(".css")
                || path.endsWith(".js")
                || path.endsWith(".ico");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString().substring(0, 8);
        }

        long start = System.currentTimeMillis();
        MDC.put(MDC_REQUEST_ID, requestId);
        response.setHeader("X-Request-Id", requestId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = System.currentTimeMillis() - start;
            String user = resolveUser();
            if (user != null) {
                MDC.put(MDC_USER, user);
            }
            String path = normalizePath(request);
            int status = response.getStatus();
            String ip = resolveClientIp(request);

            if (status >= 500) {
                log.error(
                        "HTTP {} {} -> {} ({} ms) user={} ip={}",
                        request.getMethod(), path, status, durationMs, user != null ? user : "-", ip);
            } else if (status >= 400) {
                log.warn(
                        "HTTP {} {} -> {} ({} ms) user={} ip={}",
                        request.getMethod(), path, status, durationMs, user != null ? user : "-", ip);
            } else {
                log.info(
                        "HTTP {} {} -> {} ({} ms) user={} ip={}",
                        request.getMethod(), path, status, durationMs, user != null ? user : "-", ip);
            }

            MDC.remove(MDC_REQUEST_ID);
            MDC.remove(MDC_USER);
        }
    }

    private static String resolveUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserPrincipal user) {
            return user.getEmail();
        }
        String name = authentication.getName();
        return name != null && !"anonymousUser".equals(name) ? name : null;
    }

    private static String normalizePath(HttpServletRequest request) {
        String path = request.getRequestURI();
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && path.startsWith(context)) {
            path = path.substring(context.length());
        }
        return path.isEmpty() ? "/" : path;
    }

    private static String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
