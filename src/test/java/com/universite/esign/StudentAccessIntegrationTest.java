package com.universite.esign;

import static com.universite.esign.DocumentApiIntegrationTest.client;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import com.universite.esign.identity.EsignAuthoritiesConverter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Accès étudiant (ENT, appli de la fac) : ses documents, ses demandes ; file des agents ; paramétrage. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudentAccessIntegrationTest {

    private static final JwtRequestPostProcessor APOGEE = client("apogee-app", "documents:write documents:read");
    private static final JwtRequestPostProcessor ADMIN = person("admin.esign", "Admin", null, "ESIGN_ADMIN");
    private static final JwtRequestPostProcessor AGENT = person("agent.apogee", "Karim Bennani", null, "AGENT_SCOLARITE");

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper json;

    /** Jeton d'une personne connectée via le SSO (ENT, portail…), avec son CNE éventuel. */
    private static JwtRequestPostProcessor person(String username, String name, String cne, String... roles) {
        return jwt().jwt(j -> {
            j.claim("azp", "ent-portail").claim("preferred_username", username).claim("name", name)
                    .claim("realm_access", Map.of("roles", List.of(roles)));
            if (cne != null) {
                j.claim("cne", cne);
            }
        }).authorities(new EsignAuthoritiesConverter());
    }

    private static JwtRequestPostProcessor student(String cne) {
        return person("etu." + cne.toLowerCase(), "Etudiant " + cne, cne, "ETUDIANT");
    }

    @BeforeAll
    static void apogeeView() throws Exception {
        BatchIntegrationTest.createApogeeView();
    }

    @AfterEach
    void resetSettings() throws Exception {
        for (String type : List.of("ATTESTATION_SCOLARITE", "RELEVE_NOTES")) {
            setMode(type, "AGENT", 3);
        }
    }

    private void setMode(String type, String mode, int limit) throws Exception {
        mvc.perform(put("/api/v1/admin/student-access/{type}", type).with(ADMIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\": \"" + mode + "\", \"dailyLimit\": " + limit + "}"))
                .andExpect(status().isOk());
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private JsonNode requestAs(JwtRequestPostProcessor who, String request) throws Exception {
        return body(mvc.perform(post("/api/v1/me/requests").with(who).contentType(MediaType.APPLICATION_JSON)
                .content(request)).andExpect(status().isCreated()));
    }

    private String issueAttestation(String cne) throws Exception {
        return body(mvc.perform(post("/api/v1/documents").with(APOGEE).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type": "ATTESTATION_SCOLARITE",
                         "student": {"cne": "%s", "nom": "Test", "prenom": "Etu", "filiere": "SMI", "niveau": "L3"},
                         "academicYear": "2025-2026",
                         "issuedBy": {"id": "agent.apogee", "name": "Karim Bennani"}}""".formatted(cne)))
                .andExpect(status().isCreated())).get("id").asString();
    }

    // ------------------------------------------------------------ identité et cloisonnement

    @Test
    void studentIsIdentifiedByTheCneOfHisToken() throws Exception {
        mvc.perform(get("/api/v1/me").with(student("E100")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cne").value("E100"))
                .andExpect(jsonPath("$.documentTypes[*].mode").value(hasItem("AGENT")));

        // Compte étudiant sans CNE : refus explicite
        mvc.perform(get("/api/v1/me").with(person("etu.sans.cne", "Sans CNE", null, "ETUDIANT")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value(containsString("CNE")));
        // Un agent n'a pas d'espace étudiant, une application non plus
        mvc.perform(get("/api/v1/me").with(AGENT)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/me").with(APOGEE)).andExpect(status().isForbidden());
    }

    @Test
    void studentSeesAndDownloadsOnlyHisOwnDocuments() throws Exception {
        String mine = issueAttestation("E200");
        String other = issueAttestation("E201");

        mvc.perform(get("/api/v1/me/documents").with(student("E200")))
                .andExpect(jsonPath("$[*].id").value(hasItem(mine)))
                .andExpect(jsonPath("$[*].id").value(not(hasItem(other))))
                .andExpect(jsonPath("$[0].status").value("SIGNED"))
                .andExpect(jsonPath("$[0].verificationCode").isNotEmpty());

        mvc.perform(get("/api/v1/me/documents/{id}/download", mine).with(student("E200")))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));
        mvc.perform(get("/api/v1/me/documents/{id}/download", other).with(student("E200")))
                .andExpect(status().isNotFound());
        // Ni les documents de l'API agents
        mvc.perform(get("/api/v1/documents/{id}", other).with(student("E200"))).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------ mode AGENT

    @Test
    void agentModeRequestIsHandledByTheService() throws Exception {
        JsonNode r = requestAs(student("E300"), """
                {"type": "ATTESTATION_SCOLARITE", "academicYear": "2025-2026", "purpose": "BOURSE"}""");
        assertThat(r.get("status").asString()).isEqualTo("PENDING");
        String id = r.get("id").asString();

        mvc.perform(get("/api/v1/student-requests").with(AGENT))
                .andExpect(jsonPath("$[*].id").value(hasItem(id)));
        mvc.perform(get("/api/v1/student-requests").with(student("E300"))).andExpect(status().isForbidden());

        String data = """
                {"type": "ATTESTATION_SCOLARITE",
                 "student": {"cne": "%s", "nom": "Test", "prenom": "Etu", "filiere": "SMI", "niveau": "L3"},
                 "academicYear": "2025-2026"}""";
        // Données d'un autre étudiant : refusé
        mvc.perform(post("/api/v1/student-requests/{id}/fulfill", id).with(AGENT)
                        .contentType(MediaType.APPLICATION_JSON).content(data.formatted("E999")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/student-requests/{id}/fulfill", id).with(AGENT)
                        .contentType(MediaType.APPLICATION_JSON).content(data.formatted("E300")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FULFILLED"))
                .andExpect(jsonPath("$.handledByName").value("Karim Bennani"));
        // Une seconde fois : déjà traitée
        mvc.perform(post("/api/v1/student-requests/{id}/fulfill", id).with(AGENT)
                        .contentType(MediaType.APPLICATION_JSON).content(data.formatted("E300")))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/v1/me/documents").with(student("E300")))
                .andExpect(jsonPath("$[0].status").value("SIGNED"));
        mvc.perform(get("/api/v1/me/requests").with(student("E300")))
                .andExpect(jsonPath("$[0].status").value("FULFILLED"));
    }

    @Test
    void agentCanRejectOrFulfillFromApogee() throws Exception {
        String rejected = requestAs(student("E400"), """
                {"type": "RELEVE_NOTES", "academicYear": "2025-2026", "semester": "S5"}""").get("id").asString();
        mvc.perform(post("/api/v1/student-requests/{id}/reject", rejected).with(AGENT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"Notes du semestre S5 pas encore délibérées\"}"))
                .andExpect(jsonPath("$.status").value("REJECTED"));
        mvc.perform(get("/api/v1/me/requests").with(student("E400")))
                .andExpect(jsonPath("$[0].status").value("REJECTED"))
                .andExpect(jsonPath("$[0].message").value("Notes du semestre S5 pas encore délibérées"));

        // V2 existe dans la vue Apogée : l'agent établit le relevé en un clic
        String id = requestAs(student("V2"), """
                {"type": "RELEVE_NOTES", "academicYear": "2025-2026", "semester": "S3"}""").get("id").asString();
        mvc.perform(post("/api/v1/student-requests/{id}/fulfill-from-apogee", id).with(AGENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FULFILLED"));
        mvc.perform(get("/api/v1/me/documents").with(student("V2")))
                .andExpect(jsonPath("$[0].semester").value("S3"))
                .andExpect(jsonPath("$[0].status").value("SIGNED"));
    }

    // ------------------------------------------------------------ mode AUTO et paramétrage

    @Test
    void autoModeProducesTheTranscriptImmediatelyFromApogee() throws Exception {
        setMode("RELEVE_NOTES", "AUTO", 5);
        JsonNode r = requestAs(student("V1"), """
                {"type": "RELEVE_NOTES", "academicYear": "2025-2026", "semester": "S3", "purpose": "ETRANGER"}""");
        assertThat(r.get("status").asString()).isEqualTo("FULFILLED");
        String documentId = r.get("documentId").asString();

        mvc.perform(get("/api/v1/documents/{id}", documentId).with(client("audit-app", "documents:admin")))
                .andExpect(jsonPath("$.status").value("SIGNED"))
                .andExpect(jsonPath("$.studentName").value("ALAOUI Nadia"))
                .andExpect(jsonPath("$.issuedBy.source").value("SYSTEM"));
        mvc.perform(get("/api/v1/me/documents/{id}/download", documentId).with(student("V1")))
                .andExpect(status().isOk());

        // Pas de données dans Apogée : la demande échoue avec un motif compréhensible
        JsonNode failed = requestAs(student("V1"), """
                {"type": "RELEVE_NOTES", "academicYear": "2025-2026", "semester": "S9"}""");
        assertThat(failed.get("status").asString()).isEqualTo("FAILED");
        assertThat(failed.get("message").asString()).contains("Aucune donnée Apogée").contains("scolarité");
    }

    @Test
    void dailyLimitDisabledTypesAndValidation() throws Exception {
        setMode("ATTESTATION_SCOLARITE", "AGENT", 1);
        String request = "{\"type\": \"ATTESTATION_SCOLARITE\", \"academicYear\": \"2025-2026\"}";
        requestAs(student("E500"), request);
        mvc.perform(post("/api/v1/me/requests").with(student("E500")).contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isTooManyRequests());

        setMode("ATTESTATION_SCOLARITE", "DISABLED", 1);
        mvc.perform(post("/api/v1/me/requests").with(student("E501")).contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/me").with(student("E501")))
                .andExpect(jsonPath("$.documentTypes[*].type").value(not(hasItem("ATTESTATION_SCOLARITE"))));

        mvc.perform(post("/api/v1/me/requests").with(student("E502")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\": \"RELEVE_NOTES\", \"academicYear\": \"2025-2026\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/admin/student-access/RELEVE_NOTES").with(AGENT)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"mode\": \"AUTO\", \"dailyLimit\": 3}"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------ anciennes adresses

    @Test
    void formerStudentAddressesRedirectToTheStudentApp() throws Exception {
        mvc.perform(get("/demandes/?sso=1"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "http://localhost:8082/?sso=1"));
        mvc.perform(get("/etudiant")).andExpect(header().string("Location", "http://localhost:8082/"));
        mvc.perform(get("/demandes/demandes.js")).andExpect(status().isFound());
    }
}
