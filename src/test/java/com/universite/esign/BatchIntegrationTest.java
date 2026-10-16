package com.universite.esign;

import static com.universite.esign.DocumentApiIntegrationTest.client;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import com.universite.esign.signature.PadesValidationService;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Import d'exports Apogée (CSV, Excel), vue Oracle et traitements en masse. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BatchIntegrationTest {

    private static final JwtRequestPostProcessor APOGEE = client("apogee-app", "documents:write documents:read");

    /**
     * Export type : séparateur « ; », virgule décimale, accents, une ligne par module.
     * La ligne 6 (note « ABI ») rend le relevé de R3 invalide sans bloquer les autres.
     */
    private static final String CSV = """
            CNE;Nom;Prénom;Date de naissance;Lieu de naissance;Filière;Niveau;Année;Semestre;Code module;Module;Note;Crédits;Résultat
            R1;El Amrani;Yasmine;14/05/2003;Fès;SMI;Licence 3;2025;S5;M51;Réseaux informatiques;14,5;6;V
            R1;El Amrani;Yasmine;14/05/2003;Fès;SMI;Licence 3;2025;S5;M52;Bases de données;9,25;6;NV
            R2;Benali;Omar;02/11/2002;Rabat;SMI;Licence 3;2025;S5;M51;Réseaux informatiques;12;6;V
            R2;Benali;Omar;02/11/2002;Rabat;SMI;Licence 3;2025;S5;M52;Bases de données;15,75;6;V
            R3;Idrissi;Salma;21/01/2003;Meknès;SMI;Licence 3;2025;S5;M51;Réseaux informatiques;ABI;6;
            """;

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper json;

    @Autowired
    PadesValidationService validator;

    /** Simule la vue Oracle d'Apogée (H2 en mode Oracle, année au format COD_ANU). */
    @BeforeAll
    static void createApogeeView() throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:h2:mem:apogee;MODE=Oracle;DB_CLOSE_DELAY=-1", "sa", "");
             Statement s = c.createStatement()) {
            s.execute("drop table if exists V_ESIGN_NOTES");
            s.execute("""
                    create table V_ESIGN_NOTES (CNE varchar2(20), NOM varchar2(100), PRENOM varchar2(100),
                      DATE_NAISSANCE date, LIEU_NAISSANCE varchar2(100), FILIERE varchar2(100), NIVEAU varchar2(50),
                      ANNEE varchar2(4), SEMESTRE varchar2(5), CODE_MODULE varchar2(10), MODULE varchar2(150),
                      NOTE number(4,2), CREDITS number(2), RESULTAT varchar2(5))""");
            s.execute("""
                    insert into V_ESIGN_NOTES values
                      ('V1','Alaoui','Nadia',DATE '2003-03-03','Oujda','SMA','Licence 2','2025','S3','M31','Analyse',13.5,6,'V'),
                      ('V1','Alaoui','Nadia',DATE '2003-03-03','Oujda','SMA','Licence 2','2025','S3','M32','Algèbre',11,6,'V'),
                      ('V2','Tazi','Hamza',DATE '2002-12-12','Tanger','SMA','Licence 2','2025','S3','M31','Analyse',8.75,6,'NV'),
                      ('V2','Tazi','Hamza',DATE '2002-12-12','Tanger','SMA','Licence 2','2025','S3','M32','Algèbre',10.5,6,'V'),
                      ('V3','Fassi','Ines',DATE '2003-07-07','Fès','SMI','Licence 2','2025','S3','M31','Analyse',16,6,'V')""");
        }
    }

    private JsonNode body(org.springframework.test.web.servlet.ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    /** Attend la fin d'un traitement en arrière-plan. */
    private JsonNode awaitCompletion(String id) throws Exception {
        for (int i = 0; i < 300; i++) {
            JsonNode job = body(mvc.perform(get("/api/v1/batches/{id}", id).with(APOGEE)).andExpect(status().isOk()));
            if (job.get("status").asString().startsWith("COMPLETED")) {
                return job;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Traitement " + id + " non terminé");
    }

    private static MockMultipartFile csv(String content, Charset charset) {
        return new MockMultipartFile("file", "export-apogee.csv", "text/csv", content.getBytes(charset));
    }

    @Test
    void dryRunListsProblemsWithoutSigning() throws Exception {
        mvc.perform(multipart("/api/v1/batches/import").file(csv(CSV, StandardCharsets.UTF_8))
                        .param("type", "RELEVE_NOTES").param("dryRun", "true")
                        .param("issuedById", "agent.apogee").param("issuedByName", "Karim Bennani")
                        .with(APOGEE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows").value(5))
                .andExpect(jsonPath("$.documents").value(3))
                .andExpect(jsonPath("$.valid").value(2))
                .andExpect(jsonPath("$.invalid").value(1))
                .andExpect(jsonPath("$.problems[0].key").value("R3 / 2025-2026 / S5"))
                .andExpect(jsonPath("$.problems[0].errors[0]").value(
                        org.hamcrest.Matchers.startsWith("ligne 6 : note manquante ou illisible « ABI »")));
    }

    @Test
    void importCsvSignsValidTranscriptsAndReportsErrors() throws Exception {
        // Export Excel « CSV » enregistré sous Windows : encodage Windows-1252
        JsonNode job = body(mvc.perform(multipart("/api/v1/batches/import")
                        .file(csv(CSV, Charset.forName("windows-1252")))
                        .param("type", "RELEVE_NOTES")
                        .param("issuedById", "agent.apogee").param("issuedByName", "Karim Bennani")
                        .with(APOGEE))
                .andExpect(status().isAccepted()));
        assertThat(job.get("total").asInt()).isEqualTo(3);
        String id = job.get("id").asString();

        JsonNode done = awaitCompletion(id);
        assertThat(done.get("status").asString()).isEqualTo("COMPLETED_WITH_ERRORS");
        assertThat(done.get("succeeded").asInt()).isEqualTo(2);
        assertThat(done.get("failed").asInt()).isEqualTo(1);
        assertThat(done.at("/issuedBy/id").asString()).isEqualTo("agent.apogee");

        mvc.perform(get("/api/v1/batches/{id}/items", id).param("status", "FAILED").with(APOGEE))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].cne").value("R3"))
                .andExpect(jsonPath("$[0].lines").value("6"));

        // Les accents décodés depuis Windows-1252 se retrouvent dans le document
        String signedId = body(mvc.perform(get("/api/v1/batches/{id}/items", id).param("status", "SIGNED")
                .with(APOGEE))).get(0).get("documentId").asString();
        mvc.perform(get("/api/v1/documents/{id}", signedId).with(APOGEE))
                .andExpect(jsonPath("$.studentName").value("EL AMRANI Yasmine"))
                .andExpect(jsonPath("$.issuedBy.name").value("Karim Bennani"));

        // Réponse en flux (asynchrone) : MockMvc doit relancer la requête pour lire le contenu
        MvcResult async = mvc.perform(get("/api/v1/batches/{id}/archive.zip", id).with(APOGEE))
                .andExpect(request().asyncStarted()).andReturn();
        byte[] zip = mvc.perform(asyncDispatch(async))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        Map<String, byte[]> entries = unzip(zip);
        assertThat(entries).containsKeys("R1-releve_notes-S5.pdf", "R2-releve_notes-S5.pdf", "rapport.csv");
        assertThat(validator.validate(entries.get("R2-releve_notes-S5.pdf"))).singleElement()
                .extracting(PadesValidationService.SignatureReport::cryptographicallyValid).isEqualTo(true);
        String report = new String(entries.get("rapport.csv"), StandardCharsets.UTF_8);
        assertThat(report).contains("\"R3\";\"6\";FAILED").contains("SIGNED");
    }

    @Test
    void importExcelWithDateCells() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Export");
            String[] headers = {"CNE", "NOM", "PRENOM", "DATE_NAISSANCE", "FILIERE", "NIVEAU", "ANNEE"};
            Row h = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                h.createCell(i).setCellValue(headers[i]);
            }
            CellStyle date = wb.createCellStyle();
            date.setDataFormat(wb.getCreationHelper().createDataFormat().getFormat("dd/mm/yyyy"));
            Object[][] data = {{"X1", "Kadiri", "Lina", LocalDate.of(2004, 1, 9)},
                    {"X2", "Zerouali", "Adam", LocalDate.of(2003, 9, 30)}};
            for (int r = 0; r < data.length; r++) {
                Row row = sheet.createRow(r + 1);
                row.createCell(0).setCellValue((String) data[r][0]);
                row.createCell(1).setCellValue((String) data[r][1]);
                row.createCell(2).setCellValue((String) data[r][2]);
                row.createCell(3).setCellValue((LocalDate) data[r][3]);
                row.getCell(3).setCellStyle(date);
                row.createCell(4).setCellValue("SMP");
                row.createCell(5).setCellValue("Licence 1");
                row.createCell(6).setCellValue(2025);
            }
            wb.write(out);
        }
        JsonNode job = body(mvc.perform(multipart("/api/v1/batches/import")
                        .file(new MockMultipartFile("file", "inscrits.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray()))
                        .param("type", "ATTESTATION_SCOLARITE")
                        .param("issuedById", "agent.apogee").param("issuedByName", "Karim Bennani")
                        .with(APOGEE))
                .andExpect(status().isAccepted()));
        JsonNode done = awaitCompletion(job.get("id").asString());
        assertThat(done.get("status").asString()).isEqualTo("COMPLETED");
        assertThat(done.get("succeeded").asInt()).isEqualTo(2);
    }

    @Test
    void unknownColumnsAreExplained() throws Exception {
        mvc.perform(multipart("/api/v1/batches/import")
                        .file(csv("COD_ETU;NOM\n1;X\n", StandardCharsets.UTF_8))
                        .param("type", "RELEVE_NOTES").param("issuedById", "agent.apogee")
                        .with(APOGEE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("esign.apogee.columns")));
    }

    @Test
    void singleTranscriptFromOracleViewWithoutRetyping() throws Exception {
        mvc.perform(post("/api/v1/apogee/documents").with(APOGEE).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type": "RELEVE_NOTES", "cne": "V1", "academicYear": "2025-2026", "semester": "S3",
                                 "issuedBy": {"id": "agent.apogee", "name": "Karim Bennani"}}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SIGNED"))
                .andExpect(jsonPath("$.studentName").value("ALAOUI Nadia"))
                .andExpect(jsonPath("$.semester").value("S3"));

        mvc.perform(post("/api/v1/apogee/documents").with(APOGEE).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type": "RELEVE_NOTES", "cne": "INCONNU", "academicYear": "2025-2026", "semester": "S3",
                                 "issuedBy": {"id": "agent.apogee", "name": "Karim Bennani"}}"""))
                .andExpect(status().isNotFound());
    }

    @Test
    void wholePromotionFromOracleView() throws Exception {
        String request = """
                {"type": "RELEVE_NOTES", "academicYear": "2025-2026", "semester": "S3", "filiere": "SMA",
                 "issuedBy": {"id": "agent.apogee", "name": "Karim Bennani"}, "dryRun": %s}""";
        mvc.perform(post("/api/v1/batches/apogee").with(APOGEE).contentType(MediaType.APPLICATION_JSON)
                        .content(request.formatted("true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documents").value(2))
                .andExpect(jsonPath("$.invalid").value(0));

        JsonNode job = body(mvc.perform(post("/api/v1/batches/apogee").with(APOGEE)
                        .contentType(MediaType.APPLICATION_JSON).content(request.formatted("false")))
                .andExpect(status().isAccepted()));
        assertThat(job.get("source").asString()).isEqualTo("APOGEE_VIEW");
        JsonNode done = awaitCompletion(job.get("id").asString());
        assertThat(done.get("status").asString()).isEqualTo("COMPLETED");
        assertThat(done.get("succeeded").asInt()).isEqualTo(2);
    }

    @Test
    void batchesAreVisibleOnlyToTheirApplication() throws Exception {
        JsonNode job = body(mvc.perform(multipart("/api/v1/batches/import").file(csv(CSV, StandardCharsets.UTF_8))
                        .param("type", "RELEVE_NOTES").param("issuedById", "agent.apogee").with(APOGEE))
                .andExpect(status().isAccepted()));
        String id = job.get("id").asString();
        mvc.perform(get("/api/v1/batches/{id}", id).with(client("autre-app", "documents:write")))
                .andExpect(status().isNotFound());
        mvc.perform(multipart("/api/v1/batches/import").file(csv(CSV, StandardCharsets.UTF_8))
                        .param("type", "RELEVE_NOTES").with(client("lecture-app", "documents:read")))
                .andExpect(status().isForbidden());
        awaitCompletion(id);
    }

    private static Map<String, byte[]> unzip(byte[] zip) throws Exception {
        Map<String, byte[]> entries = new HashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                entries.put(e.getName(), in.readAllBytes());
            }
        }
        return entries;
    }
}
