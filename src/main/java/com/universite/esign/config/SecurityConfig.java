package com.universite.esign.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Les applications clientes s'authentifient en OAuth2 (client_credentials) auprès du fournisseur
 * d'identité de l'université (Keycloak…) ; l'API valide les jetons JWT et contrôle les scopes.
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // API sans session ni cookie : jetons Bearer uniquement
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Vérification publique (employeurs, ambassades… qui scannent le QR code)
                        .requestMatchers("/verify/**", "/api/v1/verify/**").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/documents/*/revoke")
                        .hasAnyAuthority("SCOPE_documents:revoke", CallerContext.ADMIN_AUTHORITY)
                        .requestMatchers(HttpMethod.POST, "/api/v1/documents")
                        .hasAnyAuthority("SCOPE_documents:write", CallerContext.ADMIN_AUTHORITY)
                        .requestMatchers(HttpMethod.GET, "/api/v1/documents/**")
                        .hasAnyAuthority("SCOPE_documents:read", CallerContext.ADMIN_AUTHORITY)
                        .requestMatchers("/api/v1/audit/**").hasAuthority("SCOPE_audit:read")
                        .requestMatchers("/api/v1/templates").authenticated()
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
