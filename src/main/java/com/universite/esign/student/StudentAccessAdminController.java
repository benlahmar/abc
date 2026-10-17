package com.universite.esign.student;

import java.util.List;

import com.universite.esign.config.CallerContext;
import com.universite.esign.document.DocumentType;
import com.universite.esign.identity.AgentResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/student-access")
@Tag(name = "Paramétrage de l'accès étudiant")
class StudentAccessAdminController {

    record Setting(DocumentType type, StudentAccessMode mode, int dailyLimit) {
        static Setting of(StudentAccessSetting s) {
            return new Setting(s.getDocumentType(), s.getMode(), s.getDailyLimit());
        }
    }

    record Update(@NotNull StudentAccessMode mode, @Min(1) @Max(50) int dailyLimit) {
    }

    private final StudentAccessService access;

    StudentAccessAdminController(StudentAccessService access) {
        this.access = access;
    }

    @GetMapping
    @Operation(summary = "Mode de demande en ligne de chaque type de document")
    List<Setting> all() {
        return access.all().stream().map(Setting::of).toList();
    }

    @PutMapping("/{type}")
    @Operation(summary = "Modifier le mode d'un type de document",
            description = "DISABLED : pas de demande en ligne ; AGENT : demande traitée par le service ; "
                    + "AUTO : production immédiate depuis la vue Apogée (la vue doit être activée).")
    Setting update(@PathVariable DocumentType type, @Valid @RequestBody Update body, @AuthenticationPrincipal Jwt jwt) {
        String actor = AgentResolver.isUserToken(jwt) ? jwt.getClaimAsString("preferred_username")
                : CallerContext.clientId(jwt);
        return Setting.of(access.update(type, body.mode(), body.dailyLimit(), actor));
    }
}
