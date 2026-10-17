package com.universite.esign.registry;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.PageResponse;
import com.universite.esign.config.CallerContext;
import com.universite.esign.identity.AgentResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@Validated
@RequestMapping("/api/v1/registry")
@Tag(name = "Registre des inscrits", description = "Listes d'inscrits par filière, pour la délivrance immédiate "
        + "des attestations de scolarité demandées en ligne")
class RegistryController {

    private static final String YEAR = "\\d{4}-\\d{4}";

    record RegistryStudentView(long id, String cne, String nom, String prenom, LocalDate dateNaissance, String lieuNaissance,
                       String filiere, String niveau, boolean blocked, String blockedReason, String blockedBy,
                       Instant blockedAt) {
        static RegistryStudentView of(RegistryStudent s) {
            return new RegistryStudentView(s.getId(), s.getCne(), s.getNom(), s.getPrenom(), s.getDateNaissance(),
                    s.getLieuNaissance(), s.getFiliere(), s.getNiveau(), s.isBlocked(), s.getBlockedReason(),
                    s.getBlockedBy(), s.getBlockedAt());
        }
    }

    record RegistryOverview(String academicYear, String currentAcademicYear, List<RegistryService.RegistryFiliere> filieres) {
    }

    record BlockRequest(@NotBlank @Size(max = 500) String reason) {
    }

    private final RegistryService registry;
    private final AgentResolver agents;

    RegistryController(RegistryService registry, AgentResolver agents) {
        this.registry = registry;
        this.agents = agents;
    }

    @GetMapping
    @Operation(summary = "Filières de l'année : effectifs, étudiants bloqués, dernier import")
    RegistryOverview overview(@RequestParam(required = false) @jakarta.validation.constraints.Pattern(regexp = YEAR)
                      String academicYear) {
        String year = academicYear == null ? registry.currentAcademicYear() : academicYear;
        return new RegistryOverview(year, registry.currentAcademicYear(), registry.summary(year));
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importer une liste d'inscrits (CSV ou Excel)",
            description = "Une ligne par étudiant : CNE, nom, prénom, filière, niveau (date et lieu de naissance "
                    + "facultatifs). Pour chaque filière du fichier, la liste remplace celle de l'année. Avec "
                    + "dryRun=true, rien n'est modifié : la réponse détaille arrivées, départs et changements.")
    RegistryService.RegistryReport importFile(@RequestPart("file") MultipartFile file,
                                      @RequestParam @jakarta.validation.constraints.Pattern(regexp = YEAR)
                                      String academicYear,
                                      @RequestParam(defaultValue = "false") boolean dryRun,
                                      @AuthenticationPrincipal Jwt jwt) throws IOException {
        if (file.isEmpty()) {
            throw new BadRequestException("Fichier vide");
        }
        return dryRun
                ? registry.check(academicYear, file.getOriginalFilename(), file.getBytes())
                : registry.apply(academicYear, file.getOriginalFilename(), file.getBytes(), agents.issuer(jwt, null),
                        CallerContext.clientId(jwt));
    }

    @GetMapping("/students")
    @Operation(summary = "Étudiants inscrits (recherche par CNE ou nom, filtre par filière ou étudiants bloqués)")
    PageResponse<RegistryStudentView> students(@RequestParam @jakarta.validation.constraints.Pattern(regexp = YEAR)
                                       String academicYear,
                                       @RequestParam(required = false) String filiere,
                                       @RequestParam(required = false) @Size(max = 100) String q,
                                       @RequestParam(defaultValue = "false") boolean blocked,
                                       @RequestParam(defaultValue = "0") @Min(0) int page,
                                       @RequestParam(defaultValue = "50") @Min(1) @Max(200) int size) {
        return PageResponse.of(registry.search(academicYear, filiere, q, blocked, page, size), RegistryStudentView::of);
    }

    @GetMapping("/imports")
    @Operation(summary = "Historique des imports de l'année")
    List<RegistryImport> imports(@RequestParam @jakarta.validation.constraints.Pattern(regexp = YEAR)
                                 String academicYear) {
        return registry.history(academicYear);
    }

    @PostMapping("/students/{id}/block")
    @Operation(summary = "Bloquer un étudiant", description = "Ses demandes en ligne iront au service de scolarité, "
            + "même s'il figure dans la liste ; le blocage survit aux imports suivants.")
    RegistryStudentView block(@PathVariable long id, @Valid @RequestBody BlockRequest request, @AuthenticationPrincipal Jwt jwt) {
        return RegistryStudentView.of(registry.block(id, request.reason().strip(), agents.issuer(jwt, null),
                CallerContext.clientId(jwt)));
    }

    @PostMapping("/students/{id}/unblock")
    @Operation(summary = "Débloquer un étudiant")
    RegistryStudentView unblock(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        return RegistryStudentView.of(registry.unblock(id, agents.issuer(jwt, null), CallerContext.clientId(jwt)));
    }

    @DeleteMapping("/{academicYear}")
    @Operation(summary = "Supprimer les listes d'une année close (administrateur)")
    Map<String, Integer> purge(@PathVariable @jakarta.validation.constraints.Pattern(regexp = YEAR) String academicYear,
                               @AuthenticationPrincipal Jwt jwt) {
        String actor = AgentResolver.isUserToken(jwt) ? jwt.getClaimAsString("preferred_username") : jwt.getSubject();
        return Map.of("removed", registry.purge(academicYear, actor));
    }
}
