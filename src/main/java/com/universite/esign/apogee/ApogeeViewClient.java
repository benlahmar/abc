package com.universite.esign.apogee;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

import com.universite.esign.apogee.ApogeeProperties.Field;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Lecture de la vue Oracle d'Apogée (activée par {@code esign.apogee.view.enabled=true}).
 * <p>
 * Connexion dédiée, en lecture seule, avec un compte qui ne doit avoir que le droit SELECT sur la vue.
 * Les noms de vue et de colonnes viennent de la configuration et sont vérifiés (identifiants SQL simples) ;
 * les critères de recherche sont toujours passés en paramètres.
 */
@Component
@ConditionalOnProperty(prefix = "esign.apogee.view", name = "enabled", havingValue = "true")
public class ApogeeViewClient {

    private static final Logger log = LoggerFactory.getLogger(ApogeeViewClient.class);

    private final HikariDataSource dataSource;
    private final NamedParameterJdbcTemplate jdbc;
    private final ApogeeProperties properties;
    private final Map<Field, String> columns;
    private final String selectClause;

    public ApogeeViewClient(ApogeeProperties properties) {
        this.properties = properties;
        ApogeeProperties.View view = properties.view();
        if (view.url() == null || view.url().isBlank()) {
            throw new IllegalStateException("esign.apogee.view.url est obligatoire quand la vue est activée");
        }
        this.columns = properties.columns().byField();
        StringJoiner select = new StringJoiner(", ");
        columns.forEach((field, column) ->
                select.add(ApogeeProperties.checkIdentifier(column, "Colonne " + field)));
        this.selectClause = "select " + select + " from " + ApogeeProperties.checkIdentifier(view.name(), "Vue");

        HikariDataSource ds = new HikariDataSource();
        ds.setPoolName("apogee");
        ds.setJdbcUrl(view.url());
        ds.setUsername(view.username());
        ds.setPassword(view.password());
        ds.setReadOnly(true);
        ds.setMaximumPoolSize(3);
        ds.setInitializationFailTimeout(-1); // Apogée indisponible au démarrage ne bloque pas l'API
        this.dataSource = ds;
        this.jdbc = new NamedParameterJdbcTemplate(ds);
        log.info("Vue Apogée configurée : {}", view.name());
    }

    /**
     * Lignes de la vue pour une année (et éventuellement un semestre, une filière ou un étudiant).
     *
     * @param academicYear « 2025-2026 »
     */
    public List<ApogeeRow> find(String academicYear, String semester, String filiere, String cne) {
        StringBuilder sql = new StringBuilder(selectClause).append(" where ")
                .append(columns.get(Field.ANNEE)).append(" = :annee");
        MapSqlParameterSource params = new MapSqlParameterSource("annee",
                properties.view().yearFormat() == ApogeeProperties.YearFormat.START
                        ? academicYear.substring(0, 4) : academicYear);
        if (semester != null) {
            sql.append(" and ").append(columns.get(Field.SEMESTRE)).append(" = :semestre");
            params.addValue("semestre", semester);
        }
        if (filiere != null) {
            sql.append(" and ").append(columns.get(Field.FILIERE)).append(" = :filiere");
            params.addValue("filiere", filiere);
        }
        if (cne != null) {
            sql.append(" and ").append(columns.get(Field.CNE)).append(" = :cne");
            params.addValue("cne", cne);
        }
        sql.append(" order by ").append(columns.get(Field.CNE)).append(", ").append(columns.get(Field.CODE_MODULE));

        List<ApogeeRow> rows = new ArrayList<>();
        jdbc.query(sql.toString(), params, rs -> {
            if (rows.size() >= properties.maxRows()) {
                throw new IllegalStateException("Plus de " + properties.maxRows() + " lignes : affiner les critères");
            }
            rows.add(new ApogeeRow(rows.size() + 1, read(rs)));
        });
        return rows;
    }

    private Map<Field, String> read(ResultSet rs) throws SQLException {
        Map<Field, String> values = new EnumMap<>(Field.class);
        for (Map.Entry<Field, String> e : columns.entrySet()) {
            Object value = rs.getObject(e.getValue());
            String text = switch (value) {
                case null -> null;
                case BigDecimal d -> d.stripTrailingZeros().toPlainString();
                case Timestamp t -> t.toLocalDateTime().toLocalDate().toString();
                case java.sql.Date d -> d.toLocalDate().toString();
                default -> value.toString().strip();
            };
            values.put(e.getKey(), text == null || text.isEmpty() ? null : text);
        }
        return values;
    }

    @PreDestroy
    void close() {
        dataSource.close();
    }
}
