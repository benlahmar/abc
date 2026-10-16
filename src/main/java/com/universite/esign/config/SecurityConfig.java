package com.universite.esign.config;

import com.universite.esign.identity.EsignAuthoritiesConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Deux types d'appelants, authentifiés par le fournisseur d'identité de l'université (Keycloak…) :
 * <ul>
 *   <li>les <b>applications</b> (Apogée, ENT…) en OAuth2 client_credentials, autorisées par <b>scopes</b> ;</li>
 *   <li>les <b>personnes</b> (agents, validateurs, administrateurs), autorisées par <b>rôles</b> du realm.</li>
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfig {

    static final String AGENT = "ROLE_AGENT_SCOLARITE";
    static final String ESIGN_ADMIN = "ROLE_ESIGN_ADMIN";

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(new EsignAuthoritiesConverter());

        http
                .csrf(csrf -> csrf.disable()) // API sans session ni cookie : jetons Bearer uniquement
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Vérification publique (employeurs, ambassades… qui scannent le QR code)
                        .requestMatchers("/verify/**", "/api/v1/verify/**").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/documents/*/revoke")
                        .hasAnyAuthority("SCOPE_documents:revoke", AGENT, CallerContext.ADMIN_AUTHORITY)
                        .requestMatchers(HttpMethod.POST, "/api/v1/documents")
                        .hasAnyAuthority("SCOPE_documents:write", AGENT, CallerContext.ADMIN_AUTHORITY)
                        .requestMatchers(HttpMethod.GET, "/api/v1/documents/**")
                        .hasAnyAuthority("SCOPE_documents:read", AGENT, CallerContext.ADMIN_AUTHORITY)
                        // Le rôle exigé dépend de l'étape en cours : contrôlé par ApprovalService
                        .requestMatchers("/api/v1/approvals/**").authenticated()
                        .requestMatchers("/api/v1/admin/**").hasAnyAuthority("SCOPE_workflow:admin", ESIGN_ADMIN)
                        .requestMatchers("/api/v1/audit/**").hasAnyAuthority("SCOPE_audit:read", ESIGN_ADMIN)
                        .requestMatchers("/api/v1/templates").authenticated()
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtConverter)));
        return http.build();
    }
}
