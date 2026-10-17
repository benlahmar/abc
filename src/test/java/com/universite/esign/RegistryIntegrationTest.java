package com.universite.esign;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import com.universite.esign.identity.EsignAuthoritiesConverter;
import com.universite.esign.registry.RegistryService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Registre des inscrits et délivrance immédiate des attestations demandées en ligne (mode REGISTRY). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RegistryIntegrationTest {

    private static final JwtRequestPostProcessor ADMIN = person("admin.esign", "Admin", null, "ESIGN_ADMIN");
    private static final JwtRequestPostProcessor AGENT = person("agent.apogee", "Karim Bennani", null, "AGENT_SCOLARITE");

    private static final String HEADER = "CNE;Nom;Prénom;Date de naissance;Lieu de naissance;Filière;Niveau\n";

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper json;

    @Autowired
    RegistryService registry;

    private static JwtRequestPostProcessor person(String username, String name, String cne, String... roles) {
        return jwt().jwt(j -> {
            j.claim("azp", "esign-backoffice").claim("preferred_username", username).claim("name", name)
                    .claim("realm_access", Map.of("roles", List.of(roles)));
            if (cne != null) {
                j.claim("cne", cne);
            }
        }).authorities(new EsignAuthoritiesConverter());
    }

    private static JwtRequestPostProcessor student(String cne) {
        return person("etu." + cne.toLowerCase(), "Etudiant " + cne, cne, "ETUDIANT");
    }

    @AfterEach
    void resetMode() throws Exception {
        setMode("ATTESTATION_SCOLARITE", "AGENT").andExpect(status().isOk());
    }

    private ResultActions setMode(String type, String mode) throws Exception {
        return mvc.perform(put("/api/v1/admin/student-access/{type}", type).with(ADMIN)
                .contentType(MediaType.APPLICATION_JSON).content("{\"mode\": \"" + mode + "\", \"dailyLimit\": 5}"));
    }

    private ResultActions upload(String csv, boolean dryRun) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "inscrits.csv", "text/csv",
                (HEADER + csv).getBytes(StandardCharsets.UTF_8));
        return mvc.perform(multipart("/api/v1/registry/import").file(file).with(AGENT)
                .param("academicYear", registry.currentAcademicYear()).param("dryRun", String.valueOf(dryRun)));
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private JsonNode request(String cne, String year) throws Exception {
        return body(mvc.perform(post("/api/v1/me/requests").with(student(cne)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\": \"ATTESTATION_SCOLARITE\", \"academicYear\": \"" + year + "\"}"))
                .andExpect(status().isCreated()));
    }

    @Test
    void importReplacesTheListOfEachFiliereAndDrivesImmediateAttestations() throws Exception {
        String year = registry.currentAcademicYear();

        // Une ligne en erreur : vérification détaillée, import refusé (la liste serait incomplète)
        upload("""
                RG01;Alaoui;Sara;14/05/2003;Fès;SMI-REG;Licence 3
                RG02;Bennani;Omar;;;SMI-REG;Licence 3
                RG01;Doublon;X;;;SMI-REG;Licence 3
                RG03;Chraibi;;;;SMP-REG;Licence 2
                """, true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.problems.length()").value(2))
                .andExpect(jsonPath("$.problems[0].errors[0]").value("CNE déjà présent ligne 2"))
                .andExpect(jsonPath("$.problems[1].errors[0]").value("prénom manquant"))
                .andExpect(jsonPath("$.applied").value(false));
        upload("RG01;Alaoui;Sara;;;SMI-REG;Licence 3\nRG09;Sans;;;;SMI-REG;Licence 3\n", false)
                .andExpect(status().isBadRequest());

        // Première liste, deux filières
        upload("""
                RG01;Alaoui;Sara;14/05/2003;Fès;SMI-REG;Licence 3
                RG02;Bennani;Omar;;;SMI-REG;Licence 3
                RG03;Chraibi;Imane;;;SMP-REG;Licence 2
                """, false)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applied").value(true))
                .andExpect(jsonPath("$.filieres[?(@.filiere == 'SMI-REG')].addedCount").value(hasItem(2)));
        mvc.perform(get("/api/v1/registry").with(AGENT))
                .andExpect(jsonPath("$.academicYear").value(year))
                .andExpect(jsonPath("$.filieres[?(@.filiere == 'SMI-REG')].students").value(hasItem(2)))
                .andExpect(jsonPath("$.filieres[?(@.filiere == 'SMI-REG')].lastImport.importedByName")
                        .value(hasItem("Karim Bennani")));

        // Nouvelle liste SMI : Omar part, Sara change de niveau, Imane arrive de SMP
        JsonNode diff = body(upload("""
                RG01;Alaoui;Sara;14/05/2003;Fès;SMI-REG;Licence 4
                RG03;Chraibi;Imane;;;SMI-REG;Licence 2
                """, true));
        JsonNode smi = diff.at("/filieres/0");
        assertThat(smi.get("before").asInt()).isEqualTo(2);
        assertThat(smi.at("/removed/0/cne").asString()).isEqualTo("RG02");
        assertThat(smi.at("/changed/0/detail").asString()).isEqualTo("niveau Licence 3 → Licence 4");
        assertThat(smi.at("/added/0/detail").asString()).isEqualTo("venant de SMP-REG");
        upload("""
                RG01;Alaoui;Sara;14/05/2003;Fès;SMI-REG;Licence 4
                RG03;Chraibi;Imane;;;SMI-REG;Licence 2
                """, false).andExpect(status().isOk());
        assertThat(registry.find("RG02", year)).isEmpty();
        assertThat(registry.find("rg03", year)).get().extracting(s -> s.getFiliere()).isEqualTo("SMI-REG");

        // Mode réservé aux attestations, activé par l'administrateur
        setMode("RELEVE_NOTES", "REGISTRY").andExpect(status().isBadRequest());
        setMode("ATTESTATION_SCOLARITE", "REGISTRY").andExpect(status().isOk());

        // Inscrite : attestation signée aussitôt, avec les données du registre
        mvc.perform(get("/api/v1/me").with(student("RG01")))
                .andExpect(jsonPath("$.documentTypes[?(@.type == 'ATTESTATION_SCOLARITE')].immediate").value(hasItem(true)));
        JsonNode sara = request("RG01", year);
        assertThat(sara.get("status").asString()).isEqualTo("FULFILLED");
        mvc.perform(get("/api/v1/documents/{id}", sara.get("documentId").asString()).with(AGENT))
                .andExpect(jsonPath("$.status").value("SIGNED"))
                .andExpect(jsonPath("$.studentName").value(containsString("Sara")))
                .andExpect(jsonPath("$.issuedBy.id").value("registre-inscrits"));

        // Retiré de la liste : la demande va au service, avec une note interne
        mvc.perform(get("/api/v1/me").with(student("RG02")))
                .andExpect(jsonPath("$.documentTypes[?(@.type == 'ATTESTATION_SCOLARITE')].immediate").value(hasItem(false)));
        JsonNode omar = request("RG02", year);
        assertThat(omar.get("status").asString()).isEqualTo("PENDING");
        assertThat(omar.get("message").isNull()).isTrue();
        mvc.perform(get("/api/v1/student-requests").with(AGENT))
                .andExpect(jsonPath("$[?(@.id == '%s')].agentNote".formatted(omar.get("id").asString()))
                        .value(hasItem(containsString("Absent du registre"))));

        // Année précédente : pas dans le registre, donc traitée par le service
        String previous = (Integer.parseInt(year.substring(0, 4)) - 1) + "-" + year.substring(0, 4);
        assertThat(request("RG01", previous).get("status").asString()).isEqualTo("PENDING");

        // Bloquée : plus de délivrance immédiate, même en restant dans la liste ; le blocage survit à l'import
        long imane = registry.find("RG03", year).orElseThrow().getId();
        mvc.perform(post("/api/v1/registry/students/{id}/block", imane).with(AGENT)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"Transfert en cours\"}"))
                .andExpect(jsonPath("$.blocked").value(true));
        upload("RG01;Alaoui;Sara;14/05/2003;Fès;SMI-REG;Licence 4\nRG03;Chraibi;Imane;;;SMI-REG;Licence 2\n", false);
        JsonNode blocked = request("RG03", year);
        assertThat(blocked.get("status").asString()).isEqualTo("PENDING");
        mvc.perform(get("/api/v1/registry/students").param("academicYear", year).param("blocked", "true").with(AGENT))
                .andExpect(jsonPath("$.items[*].cne").value(hasItem("RG03")))
                .andExpect(jsonPath("$.items[*].cne").value(not(hasItem("RG01"))));
        mvc.perform(post("/api/v1/registry/students/{id}/unblock", imane).with(AGENT))
                .andExpect(jsonPath("$.blocked").value(false));

        mvc.perform(get("/api/v1/registry/students").param("academicYear", year).param("q", "alao").with(AGENT))
                .andExpect(jsonPath("$.items[0].cne").value("RG01"));
        mvc.perform(get("/api/v1/audit/events").param("type", "REGISTRY_IMPORTED").with(ADMIN))
                .andExpect(jsonPath("$.items[0].details").value(containsString("SMI-REG")));
    }

    @Test
    void onlyClosedYearsCanBePurgedByTheAdministrator() throws Exception {
        String year = registry.currentAcademicYear();
        mvc.perform(delete("/api/v1/registry/{year}", year).with(ADMIN)).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/v1/registry/{year}", "2019-2020").with(AGENT)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/registry/{year}", "2019-2020").with(ADMIN))
                .andExpect(status().isOk()).andExpect(jsonPath("$.removed").value(0));
        mvc.perform(get("/api/v1/registry").with(student("RG01"))).andExpect(status().isForbidden());
    }
}
