package com.universite.esign;

import static com.universite.esign.DocumentApiIntegrationTest.client;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import com.universite.esign.identity.EsignAuthoritiesConverter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

/** Points d'accès utilisés par le back-office (agents de scolarité). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BackOfficeApiIntegrationTest {

    private static final JwtRequestPostProcessor APOGEE = client("apogee-bo", "documents:write documents:read");
    private static final JwtRequestPostProcessor AGENT = jwt().jwt(j -> j.claim("azp", "esign-backoffice")
                    .claim("preferred_username", "agent.apogee").claim("name", "Karim Bennani")
                    .claim("realm_access", Map.of("roles", List.of("AGENT_SCOLARITE"))))
            .authorities(new EsignAuthoritiesConverter());

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper json;

    private String issue(String cne, String nom) throws Exception {
        String body = mvc.perform(post("/api/v1/documents").with(APOGEE).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type": "ATTESTATION_SCOLARITE",
                                 "student": {"cne": "%s", "nom": "%s", "prenom": "Test", "filiere": "SMI", "niveau": "L3"},
                                 "academicYear": "2025-2026",
                                 "issuedBy": {"id": "agent.apogee", "name": "Karim Bennani"}}""".formatted(cne, nom)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asString();
    }

    @Test
    void agentsSearchAllDocumentsOfTheFaculty() throws Exception {
        String id = issue("BO100", "Bouzidi");
        issue("BO101", "Chraibi");

        // Créé par une application, trouvé par l'agent connecté avec son compte
        mvc.perform(get("/api/v1/documents").param("q", "bouzi").with(AGENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id").value(hasItem(id)))
                .andExpect(jsonPath("$.items[*].studentCne").value(everyItem(is("BO100"))))
                .andExpect(jsonPath("$.items[0].issuedByName").value("Karim Bennani"))
                .andExpect(jsonPath("$.page").value(0));

        mvc.perform(get("/api/v1/documents").param("q", "BO10").param("type", "ATTESTATION_SCOLARITE")
                        .param("status", "SIGNED").param("size", "1").with(AGENT))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));

        // Les jokers SQL saisis par l'utilisateur ne correspondent pas à « tout »
        mvc.perform(get("/api/v1/documents").param("q", "%").with(AGENT))
                .andExpect(jsonPath("$.total").value(0));

        mvc.perform(get("/api/v1/documents/{id}", id).with(AGENT)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/audit/documents/{id}", id).with(AGENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventType").value("DOCUMENT_ISSUED"));
    }

    @Test
    void applicationsOnlySeeTheirOwnDocuments() throws Exception {
        String id = issue("BO200", "Alaoui");
        mvc.perform(get("/api/v1/documents").param("q", "BO200").with(client("autre-bo", "documents:read")))
                .andExpect(jsonPath("$.items[*].id").value(not(hasItem(id))));
        mvc.perform(get("/api/v1/documents").param("q", "BO200").with(APOGEE))
                .andExpect(jsonPath("$.items[*].id").value(hasItem(id)));
        mvc.perform(get("/api/v1/documents").param("size", "500").with(APOGEE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("size"));
    }

    @Test
    void handledRequestsHistoryAndApogeeStatus() throws Exception {
        mvc.perform(get("/api/v1/student-requests").param("status", "REJECTED").with(AGENT))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/apogee/status").with(AGENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewEnabled").value(true));
    }
}
