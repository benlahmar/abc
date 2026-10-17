package com.universite.esign;

import static com.universite.esign.DocumentApiIntegrationTest.client;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import com.universite.esign.identity.EsignAuthoritiesConverter;
import com.universite.esign.signature.PadesValidationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Traçabilité de l'agent et circuit d'approbation paramétrable. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkflowIntegrationTest {

    private static final String RELEVE = """
            {
              "type": "RELEVE_NOTES",
              "student": { "cne": "R130456789", "nom": "El Amrani", "prenom": "Yasmine",
                           "filiere": "SMI", "niveau": "Licence 3" },
              "academicYear": "2025-2026",
              "semester": "S5",
              "grades": [ {"code": "M51", "intitule": "Réseaux", "note": 14.5, "credits": 6} ]
              %s
            }
            """;

    /** Circuit cible : vice-doyen si usage ETRANGER, puis doyen sur demande. */
    private static final String WORKFLOW = """
            { "steps": [
                { "name": "Vice-doyen pédagogie", "role": "VICE_DOYEN_PEDAGOGIE",
                  "condition": "IF_PURPOSE", "purposes": ["ETRANGER"] },
                { "name": "Doyen (sur demande)", "role": "DOYEN", "condition": "IF_ESCALATED" }
            ] }
            """;

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper json;

    @Autowired
    PadesValidationService validator;

    /** Jeton d'une personne connectée (flux authorization code) avec ses rôles Keycloak. */
    private static JwtRequestPostProcessor user(String username, String name, String... roles) {
        return jwt().jwt(j -> j.claim("azp", "esign-swagger").claim("preferred_username", username)
                        .claim("name", name).claim("scope", "openid profile")
                        .claim("realm_access", Map.of("roles", List.of(roles))))
                .authorities(new EsignAuthoritiesConverter());
    }

    private static final JwtRequestPostProcessor ADMIN = user("admin.esign", "Admin E-sign", "ESIGN_ADMIN");
    private static final JwtRequestPostProcessor VICE_DOYEN =
            user("vice.doyen", "Samira Alaoui", "VICE_DOYEN_PEDAGOGIE");
    private static final JwtRequestPostProcessor DOYEN = user("doyen", "Ahmed Tazi", "DOYEN");
    private static final JwtRequestPostProcessor APOGEE = client("apogee-app", "documents:write documents:read");

    private static String releve(String extra) {
        return RELEVE.formatted(extra.isEmpty() ? "" : ", " + extra);
    }

    private static final String DECLARED_AGENT = "\"issuedBy\": {\"id\": \"agent.apogee\", \"name\": \"Karim Bennani\"}";

    private JsonNode create(String body, JwtRequestPostProcessor caller) throws Exception {
        String response = mvc.perform(post("/api/v1/documents").with(caller)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response);
    }

    private void configureWorkflow(String definition) throws Exception {
        mvc.perform(put("/api/v1/admin/workflows/RELEVE_NOTES").with(ADMIN)
                        .contentType(MediaType.APPLICATION_JSON).content(definition))
                .andExpect(status().isOk());
    }

    @AfterEach
    void resetWorkflow() throws Exception {
        configureWorkflow("{\"steps\": []}");
    }

    // ------------------------------------------------------------ traçabilité de l'agent

    @Test
    void applicationMustDeclareTheAgent() throws Exception {
        mvc.perform(post("/api/v1/documents").with(APOGEE)
                        .contentType(MediaType.APPLICATION_JSON).content(releve("")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("issuedBy")));

        JsonNode doc = create(releve(DECLARED_AGENT), APOGEE);
        assertThat(doc.get("status").asString()).isEqualTo("SIGNED");
        assertThat(doc.at("/issuedBy/id").asString()).isEqualTo("agent.apogee");
        assertThat(doc.at("/issuedBy/name").asString()).isEqualTo("Karim Bennani");
        assertThat(doc.at("/issuedBy/source").asString()).isEqualTo("DECLARED");
    }

    @Test
    void connectedAgentIsTakenFromTokenNotFromRequest() throws Exception {
        JwtRequestPostProcessor agent = user("k.bennani", "Karim Bennani", "AGENT_SCOLARITE");
        JsonNode doc = create(releve("\"issuedBy\": {\"id\": \"quelqu.un\", \"name\": \"Usurpateur\"}"), agent);
        assertThat(doc.at("/issuedBy/id").asString()).isEqualTo("k.bennani");
        assertThat(doc.at("/issuedBy/source").asString()).isEqualTo("AUTHENTICATED");

        mvc.perform(post("/api/v1/documents").with(user("etudiant", "Un Etudiant"))
                        .contentType(MediaType.APPLICATION_JSON).content(releve("")))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------ paramétrage

    @Test
    void workflowConfigurationIsValidatedAndRestricted() throws Exception {
        mvc.perform(get("/api/v1/admin/workflows/RELEVE_NOTES").with(ADMIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.steps.length()").value(0));

        mvc.perform(put("/api/v1/admin/workflows/RELEVE_NOTES").with(ADMIN).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"steps\": [{\"name\": \"X\", \"role\": \"VICE_DOYEN_PEDAGOGIE\", \"condition\": \"IF_PURPOSE\"}]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/admin/workflows/RELEVE_NOTES").with(ADMIN).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"steps\": [{\"name\": \"X\", \"role\": \"vice doyen\", \"condition\": \"ALWAYS\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("steps[0].role"));
        mvc.perform(put("/api/v1/admin/workflows/RELEVE_NOTES").with(VICE_DOYEN).contentType(MediaType.APPLICATION_JSON)
                        .content(WORKFLOW))
                .andExpect(status().isForbidden());

        configureWorkflow(WORKFLOW);
        mvc.perform(get("/api/v1/admin/workflows").with(ADMIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.type == 'RELEVE_NOTES')].steps[0].role").value("VICE_DOYEN_PEDAGOGIE"))
                .andExpect(jsonPath("$[?(@.type == 'RELEVE_NOTES')].steps[1].condition").value("IF_ESCALATED"));
        mvc.perform(get("/api/v1/audit/verify").with(ADMIN))
                .andExpect(jsonPath("$.valid").value(true));

        // Historique du paramétrage : la dernière modification en premier, avec son auteur
        mvc.perform(get("/api/v1/audit/events").param("type", "WORKFLOW_UPDATED", "STUDENT_ACCESS_UPDATED")
                        .param("size", "5").with(ADMIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].eventType").value("WORKFLOW_UPDATED"))
                .andExpect(jsonPath("$.items[0].actor").value("admin.esign"))
                .andExpect(jsonPath("$.items[0].details").value(org.hamcrest.Matchers.containsString("VICE_DOYEN_PEDAGOGIE")));
        mvc.perform(get("/api/v1/audit/events").with(VICE_DOYEN)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/apogee/status").with(ADMIN)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/batches").with(ADMIN)).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------ déroulement du circuit

    @Test
    void conditionalStepsAreSkippedWhenNotApplicable() throws Exception {
        configureWorkflow(WORKFLOW);
        // Pas d'usage ETRANGER, pas de demande de validation : signature immédiate
        JsonNode doc = create(releve(DECLARED_AGENT), APOGEE);
        assertThat(doc.get("status").asString()).isEqualTo("SIGNED");
        assertThat(doc.at("/approvals/0/status").asString()).isEqualTo("SKIPPED");
    }

    @Test
    void foreignTranscriptRequiresViceDeanApprovalBeforeSigning() throws Exception {
        configureWorkflow(WORKFLOW);
        JsonNode doc = create(releve(DECLARED_AGENT + ", \"purpose\": \"ETRANGER\""), APOGEE);
        String id = doc.get("id").asString();
        assertThat(doc.get("status").asString()).isEqualTo("PENDING_APPROVAL");
        assertThat(doc.at("/approvals/0/status").asString()).isEqualTo("PENDING");
        assertThat(doc.at("/approvals/1/status").asString()).isEqualTo("CONDITIONAL");
        assertThat(doc.get("downloadUrl").isNull()).isTrue();

        // Pas encore délivré : ni téléchargeable, ni vérifiable publiquement
        mvc.perform(get("/api/v1/documents/{id}/download", id).with(APOGEE)).andExpect(status().isConflict());
        mvc.perform(get("/api/v1/verify/{code}", doc.get("verificationCode").asString()))
                .andExpect(jsonPath("$.authentic").value(false))
                .andExpect(jsonPath("$.document").doesNotExist());

        // Le vice-doyen voit la demande et peut prévisualiser le PDF non signé
        mvc.perform(get("/api/v1/approvals").with(VICE_DOYEN))
                .andExpect(jsonPath("$[*].documentId").value(hasItem(id)))
                .andExpect(jsonPath("$[?(@.documentId == '%s')].type".formatted(id)).value(hasItem("RELEVE_NOTES")))
                .andExpect(jsonPath("$[?(@.documentId == '%s')].stepNumber".formatted(id)).value(hasItem(1)))
                .andExpect(jsonPath("$[?(@.documentId == '%s')].stepCount".formatted(id)).value(hasItem(1)));
        mvc.perform(get("/api/v1/approvals/{id}", id).with(VICE_DOYEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvals[0].status").value("PENDING"));
        mvc.perform(get("/api/v1/approvals/{id}", id).with(DOYEN)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/approvals/{id}/preview", id).with(VICE_DOYEN))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));

        // Ni un autre rôle, ni une application ne peuvent décider
        mvc.perform(post("/api/v1/approvals/{id}/approve", id).with(DOYEN)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/approvals/{id}/preview", id).with(DOYEN)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/approvals/{id}/approve", id)
                        .with(client("apogee-app", "documents:write")))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/approvals/{id}/approve", id).with(VICE_DOYEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"comment\": \"Notes conformes\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SIGNED"))
                .andExpect(jsonPath("$.approvals[0].status").value("APPROVED"))
                .andExpect(jsonPath("$.approvals[0].decidedById").value("vice.doyen"))
                .andExpect(jsonPath("$.approvals[0].comment").value("Notes conformes"))
                .andExpect(jsonPath("$.approvals[1].status").value("SKIPPED"));

        // Après décision : le vice-doyen retrouve le document dans ses décisions et peut encore le consulter
        mvc.perform(get("/api/v1/approvals/decided").with(VICE_DOYEN))
                .andExpect(jsonPath("$[0].documentId").value(id))
                .andExpect(jsonPath("$[0].decision").value("APPROVED"))
                .andExpect(jsonPath("$[0].documentStatus").value("SIGNED"));
        mvc.perform(get("/api/v1/approvals/{id}", id).with(VICE_DOYEN)).andExpect(status().isOk());

        byte[] pdf = mvc.perform(get("/api/v1/documents/{id}/download", id).with(APOGEE))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(validator.validate(pdf)).singleElement()
                .extracting(PadesValidationService.SignatureReport::cryptographicallyValid).isEqualTo(true);

        mvc.perform(get("/api/v1/audit/documents/{id}", id).with(ADMIN))
                .andExpect(jsonPath("$[*].eventType").value(org.hamcrest.Matchers.contains(
                        "DOCUMENT_ISSUED", "STEP_APPROVED", "DOCUMENT_SIGNED")));
    }

    @Test
    void escalationActivatesConditionalStep() throws Exception {
        configureWorkflow(WORKFLOW);
        String id = create(releve(DECLARED_AGENT + ", \"purpose\": \"ETRANGER\""), APOGEE).get("id").asString();

        mvc.perform(post("/api/v1/approvals/{id}/approve", id).with(VICE_DOYEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"escalate\": true}"))
                .andExpect(jsonPath("$.status").value("PENDING_APPROVAL"))
                .andExpect(jsonPath("$.approvals[1].status").value("PENDING"));

        mvc.perform(post("/api/v1/approvals/{id}/approve", id).with(DOYEN))
                .andExpect(jsonPath("$.status").value("SIGNED"))
                .andExpect(jsonPath("$.approvals[1].decidedByName").value("Ahmed Tazi"));
    }

    @Test
    void agentCanRequestExtraValidationAtCreation() throws Exception {
        configureWorkflow(WORKFLOW);
        JsonNode doc = create(releve(DECLARED_AGENT + ", \"escalate\": true"), APOGEE);
        assertThat(doc.get("status").asString()).isEqualTo("PENDING_APPROVAL");
        assertThat(doc.at("/approvals/0/role").asString()).isEqualTo("DOYEN");
        assertThat(doc.at("/approvals/0/status").asString()).isEqualTo("PENDING");
    }

    @Test
    void rejectionEndsTheRequestAndIssuerCannotApproveOwnDocument() throws Exception {
        configureWorkflow(WORKFLOW);
        // Un vice-doyen qui établit lui-même un relevé ne peut pas l'approuver
        JwtRequestPostProcessor viceDoyenAgent =
                user("vice.doyen", "Samira Alaoui", "VICE_DOYEN_PEDAGOGIE", "AGENT_SCOLARITE");
        String own = create(releve("\"purpose\": \"ETRANGER\""), viceDoyenAgent).get("id").asString();
        mvc.perform(post("/api/v1/approvals/{id}/approve", own).with(viceDoyenAgent))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("établi")));

        String id = create(releve(DECLARED_AGENT + ", \"purpose\": \"ETRANGER\""), APOGEE).get("id").asString();
        mvc.perform(post("/api/v1/approvals/{id}/reject", id).with(VICE_DOYEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"Note du module M51 erronée\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.approvals[0].status").value("REJECTED"))
                .andExpect(jsonPath("$.approvals[0].comment").value("Note du module M51 erronée"))
                .andExpect(jsonPath("$.approvals[1].status").value("SKIPPED"));

        mvc.perform(post("/api/v1/approvals/{id}/approve", id).with(VICE_DOYEN)).andExpect(status().isConflict());
        mvc.perform(get("/api/v1/documents/{id}/download", id).with(APOGEE)).andExpect(status().isConflict());
    }

    @Test
    void workflowChangesDoNotAffectPendingRequests() throws Exception {
        configureWorkflow(WORKFLOW);
        String id = create(releve(DECLARED_AGENT + ", \"purpose\": \"ETRANGER\""), APOGEE).get("id").asString();
        configureWorkflow("{\"steps\": []}");
        mvc.perform(get("/api/v1/documents/{id}", id).with(APOGEE))
                .andExpect(jsonPath("$.status").value("PENDING_APPROVAL"));
        mvc.perform(post("/api/v1/approvals/{id}/approve", id).with(VICE_DOYEN))
                .andExpect(jsonPath("$.status").value("SIGNED"));
    }
}
