package com.universite.esign;

import static com.universite.esign.DocumentApiIntegrationTest.client;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.universite.esign.identity.EsignAuthoritiesConverter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.json.JsonMapper;

/** Consultation du journal d'audit par l'administrateur : recherche, export, intégrité. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuditIntegrationTest {

    private static final JwtRequestPostProcessor APOGEE = client("apogee-audit", "documents:write documents:read documents:revoke");
    private static final JwtRequestPostProcessor ADMIN = person("admin.esign", "ESIGN_ADMIN");
    private static final JwtRequestPostProcessor AGENT = person("agent.apogee", "AGENT_SCOLARITE");

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper json;

    @Autowired
    JdbcTemplate jdbc;

    private static JwtRequestPostProcessor person(String username, String role) {
        return jwt().jwt(j -> j.claim("azp", "esign-backoffice").claim("preferred_username", username)
                        .claim("name", username).claim("realm_access", Map.of("roles", List.of(role))))
                .authorities(new EsignAuthoritiesConverter());
    }

    private String issue(String cne) throws Exception {
        String body = mvc.perform(post("/api/v1/documents").with(APOGEE).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type": "ATTESTATION_SCOLARITE",
                                 "student": {"cne": "%s", "nom": "Audit", "prenom": "Test", "filiere": "SMI", "niveau": "L3"},
                                 "academicYear": "2025-2026",
                                 "issuedBy": {"id": "agent.audit", "name": "Agent Audit"}}""".formatted(cne)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asString();
    }

    @Test
    void administratorSearchesExportsAndVerifiesTheJournal() throws Exception {
        String id = issue("AUD100");
        mvc.perform(post("/api/v1/documents/{id}/revoke", id).with(APOGEE).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"=HYPERLINK(\\\"x\\\") erreur de saisie\", "
                        + "\"by\": {\"id\": \"agent.audit\", \"name\": \"Agent Audit\"}}")).andExpect(status().isOk());
        String today = LocalDate.now(ZoneId.of("Africa/Casablanca")).toString();

        // Texte du détail (CNE), type, acteur, document, période
        mvc.perform(get("/api/v1/audit/events").param("q", "aud100").with(ADMIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].documentId").value(everyItem(is(id))))
                .andExpect(jsonPath("$.items[0].eventType").value("DOCUMENT_REVOKED"));
        mvc.perform(get("/api/v1/audit/events").param("documentId", id).param("type", "DOCUMENT_ISSUED", "DOCUMENT_SIGNED")
                        .with(ADMIN))
                .andExpect(jsonPath("$.total").value(2));
        mvc.perform(get("/api/v1/audit/events").param("actor", "AGENT.AUDIT").param("documentId", id).with(ADMIN))
                .andExpect(jsonPath("$.items[*].eventType").value(hasItem("DOCUMENT_ISSUED")));
        mvc.perform(get("/api/v1/audit/events").param("documentId", id).param("from", today).param("to", today).with(ADMIN))
                .andExpect(jsonPath("$.total").value(3));
        mvc.perform(get("/api/v1/audit/events").param("documentId", id)
                        .param("from", LocalDate.parse(today).plusDays(1).toString()).with(ADMIN))
                .andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/v1/audit/events").param("from", today).param("to", "2020-01-01").with(ADMIN))
                .andExpect(status().isBadRequest());

        // Export pour Excel : en-têtes, empreintes, formule neutralisée
        MvcResult started = mvc.perform(get("/api/v1/audit/events.csv").param("documentId", id).with(ADMIN))
                .andExpect(request().asyncStarted()).andReturn();
        byte[] csv = mvc.perform(asyncDispatch(started)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        String text = new String(csv, StandardCharsets.UTF_8);
        assertThat(text).startsWith("﻿numero;date;evenement;acteur;document_id;detail;empreinte_precedente;empreinte");
        assertThat(text.lines()).hasSize(4);
        assertThat(text).contains("DOCUMENT_REVOKED").doesNotContain(";\"=HYPERLINK");

        mvc.perform(get("/api/v1/audit/types").with(ADMIN))
                .andExpect(jsonPath("$[?(@.type == 'DOCUMENT_ISSUED')].count").isNotEmpty());
        mvc.perform(get("/api/v1/audit/verify").with(ADMIN))
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.headHash").value(matchesPattern("[0-9a-f]{64}")));

        // Réservé à l'administrateur (l'agent ne voit que l'historique d'un document)
        mvc.perform(get("/api/v1/audit/events").with(AGENT)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/audit/events.csv").with(AGENT)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/audit/documents/{id}", id).with(AGENT)).andExpect(status().isOk());
    }

    @Test
    void tamperingWithAnEventBreaksTheChainFromThatEvent() throws Exception {
        String id = issue("AUD200");
        long eventId = jdbc.queryForObject(
                "select min(id) from audit_events where document_id = ?", Long.class, java.util.UUID.fromString(id));
        String original = jdbc.queryForObject("select details from audit_events where id = ?", String.class, eventId);
        try {
            // Quelqu'un réécrit un détail directement en base : la vérification désigne l'événement
            jdbc.update("update audit_events set details = ? where id = ?", "RELEVE_NOTES 2025-2026", eventId);
            mvc.perform(get("/api/v1/audit/verify").with(ADMIN))
                    .andExpect(jsonPath("$.valid").value(false))
                    .andExpect(jsonPath("$.firstInvalidEventId").value(eventId))
                    .andExpect(jsonPath("$.headHash").doesNotExist());
        } finally {
            jdbc.update("update audit_events set details = ? where id = ?", original, eventId);
        }
        mvc.perform(get("/api/v1/audit/verify").with(ADMIN)).andExpect(jsonPath("$.valid").value(true));
    }
}
