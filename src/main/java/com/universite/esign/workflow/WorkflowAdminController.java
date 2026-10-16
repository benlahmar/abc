package com.universite.esign.workflow;

import java.util.Arrays;
import java.util.List;

import com.universite.esign.config.CallerContext;
import com.universite.esign.document.DocumentType;
import com.universite.esign.identity.AgentResolver;
import com.universite.esign.workflow.dto.WorkflowDefinition;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/workflows")
@Tag(name = "Paramétrage du circuit", description = "Étapes d'approbation par type de document")
class WorkflowAdminController {

    private static final String EXAMPLE = """
            {
              "steps": [
                {
                  "name": "Validation du vice-doyen à la pédagogie",
                  "role": "VICE_DOYEN_PEDAGOGIE",
                  "condition": "IF_PURPOSE",
                  "purposes": ["ETRANGER"]
                },
                {
                  "name": "Validation du doyen (sur demande)",
                  "role": "DOYEN",
                  "condition": "IF_ESCALATED"
                }
              ]
            }""";

    private final WorkflowService workflow;

    WorkflowAdminController(WorkflowService workflow) {
        this.workflow = workflow;
    }

    @GetMapping
    @Operation(summary = "Circuits de tous les types de documents")
    List<WorkflowDefinition> all() {
        return Arrays.stream(DocumentType.values()).map(workflow::definition).toList();
    }

    @GetMapping("/{type}")
    @Operation(summary = "Circuit d'un type de document")
    WorkflowDefinition get(@PathVariable DocumentType type) {
        return workflow.definition(type);
    }

    @PutMapping("/{type}")
    @Operation(summary = "Remplacer le circuit d'un type de document",
            description = "Une liste d'étapes vide rétablit la signature immédiate. Les demandes déjà en "
                    + "cours gardent le circuit en vigueur au moment de leur création.\n\n"
                    + "Conditions : ALWAYS (toujours), IF_PURPOSE (si l'usage du document est dans purposes), "
                    + "IF_ESCALATED (si l'agent ou un validateur précédent demande une validation supplémentaire).")
    WorkflowDefinition update(@PathVariable DocumentType type,
                              @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
                                      examples = @ExampleObject(name = "Exemple", value = EXAMPLE)))
                              @Valid @RequestBody WorkflowDefinition definition,
                              @AuthenticationPrincipal Jwt jwt) {
        String actor = AgentResolver.isUserToken(jwt)
                ? jwt.getClaimAsString("preferred_username")
                : CallerContext.clientId(jwt);
        return workflow.update(type, definition.steps(), actor);
    }
}
