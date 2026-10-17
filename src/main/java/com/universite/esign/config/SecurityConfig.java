package com.universite.esign.config;

import java.util.List;

import com.universite.esign.identity.EsignAuthoritiesConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

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
    SecurityFilterChain securityFilterChain(HttpSecurity http, EsignProperties properties) throws Exception {
        String student = "ROLE_" + properties.student().role();
        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(new EsignAuthoritiesConverter());

        http
                .csrf(csrf -> csrf.disable()) // API sans session ni cookie : jetons Bearer uniquement
                .cors(cors -> cors.configurationSource(corsConfiguration(properties.cors().allowedOrigins())))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Vérification publique (employeurs, ambassades… qui scannent le QR code)
                        .requestMatchers("/verify/**", "/api/v1/verify/**").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        // Portail étudiant (pages statiques ; l'authentification se fait auprès du SSO)
                        .requestMatchers("/etudiant", "/etudiant/**", "/demandes", "/demandes/**").permitAll()
                        .requestMatchers("/branding/**").permitAll()
                        // Espace étudiant : uniquement ses propres documents (CNE du jeton)
                        .requestMatchers("/api/v1/me", "/api/v1/me/**").hasAuthority(student)
                        // File des demandes étudiantes, traitée par le service de scolarité
                        .requestMatchers("/api/v1/student-requests/**")
                        .hasAnyAuthority("SCOPE_documents:write", AGENT, CallerContext.ADMIN_AUTHORITY)
                        .requestMatchers(HttpMethod.POST, "/api/v1/documents/*/revoke")
                        .hasAnyAuthority("SCOPE_documents:revoke", AGENT, CallerContext.ADMIN_AUTHORITY)
                        .requestMatchers(HttpMethod.POST, "/api/v1/documents")
                        .hasAnyAuthority("SCOPE_documents:write", AGENT, CallerContext.ADMIN_AUTHORITY)
                        // État de la vue Apogée : aussi utile à l'administrateur (mode AUTO des demandes)
                        .requestMatchers(HttpMethod.GET, "/api/v1/apogee/status")
                        .hasAnyAuthority("SCOPE_documents:write", AGENT, CallerContext.ADMIN_AUTHORITY, ESIGN_ADMIN)
                        // Établissement depuis Apogée (fichier, vue Oracle) et traitements en masse
                        .requestMatchers("/api/v1/batches/**", "/api/v1/apogee/**")
                        .hasAnyAuthority("SCOPE_documents:write", AGENT, CallerContext.ADMIN_AUTHORITY)
                        .requestMatchers(HttpMethod.GET, "/api/v1/documents/**")
                        .hasAnyAuthority("SCOPE_documents:read", AGENT, CallerContext.ADMIN_AUTHORITY)
                        // Le rôle exigé dépend de l'étape en cours : contrôlé par ApprovalService
                        .requestMatchers("/api/v1/approvals/**").authenticated()
                        .requestMatchers("/api/v1/admin/**").hasAnyAuthority("SCOPE_workflow:admin", ESIGN_ADMIN)
                        .requestMatchers(HttpMethod.GET, "/api/v1/audit/documents/**")
                        .hasAnyAuthority("SCOPE_audit:read", ESIGN_ADMIN, AGENT)
                        .requestMatchers("/api/v1/audit/**").hasAnyAuthority("SCOPE_audit:read", ESIGN_ADMIN)
                        .requestMatchers("/api/v1/templates").authenticated()
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtConverter)));
        return http.build();
    }

    /** Applications web de la fac (ENT…) autorisées à appeler l'API depuis le navigateur. */
    private static CorsConfigurationSource corsConfiguration(List<String> allowedOrigins) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        if (!allowedOrigins.isEmpty()) {
            CorsConfiguration cors = new CorsConfiguration();
            cors.setAllowedOrigins(allowedOrigins);
            cors.setAllowedMethods(List.of("GET", "POST", "PUT"));
            cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
            cors.setExposedHeaders(List.of("Location", "Content-Disposition"));
            cors.setMaxAge(3600L);
            source.registerCorsConfiguration("/api/**", cors);
        }
        return source;
    }
}
