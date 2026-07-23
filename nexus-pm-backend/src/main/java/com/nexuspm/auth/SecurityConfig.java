package com.nexuspm.auth;

import com.nexuspm.auth.JwtAuthenticationFilter;
import com.nexuspm.auth.RateLimitFilter;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.logging.RequestLoggingFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RequestLoggingFilter requestLoggingFilter;
    private final ObjectProvider<RateLimitFilter> rateLimitFilter;
    private final DfnPmProperties properties;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> {
                    headers.contentTypeOptions(with -> {});
                    headers.frameOptions(frame -> frame.deny());
                    headers.referrerPolicy(referrer -> referrer
                            .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN));
                    if (properties.getSecurity().isCookieSecure()) {
                        headers.httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31_536_000));
                    }
                })
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers("/auth/login", "/auth/refresh", "/auth/password-reset/**").permitAll();
                    auth.requestMatchers("/actuator/health").permitAll();
                    if (properties.getSecurity().isSwaggerEnabled()) {
                        auth.requestMatchers("/swagger-ui/**", "/api-docs/**", "/swagger-ui.html").permitAll();
                    }
                    auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                    auth.anyRequest().authenticated();
                });

        rateLimitFilter.ifAvailable(filter ->
                http.addFilterBefore(filter, UsernamePasswordAuthenticationFilter.class));
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        // After JWT so authenticated user is available when the response is logged.
        http.addFilterAfter(requestLoggingFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.getCors().getAllowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of(
                "Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Request-Id"));
        configuration.setExposedHeaders(List.of("X-Request-Id"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
