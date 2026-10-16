package com.universite.esign.apogee;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.Reader;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.universite.esign.apogee.ApogeeProperties.Field;
import com.universite.esign.common.BadRequestException;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;

/**
 * Lit un export Apogée (CSV ou Excel .xlsx/.xls). La première ligne contient les noms de colonnes,
 * reconnus sans tenir compte de la casse, des espaces ni des accents.
 */
@Component
public class ApogeeFileParser {

    private final ApogeeProperties properties;

    public ApogeeFileParser(ApogeeProperties properties) {
        this.properties = properties;
    }

    public List<ApogeeRow> parse(String filename, byte[] content) {
        String name = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        List<List<String>> table;
        if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            table = readExcel(content);
        } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
            table = readCsv(content);
        } else {
            throw new BadRequestException("Format de fichier non pris en charge : utiliser .csv, .xlsx ou .xls");
        }
        if (table.isEmpty()) {
            throw new BadRequestException("Le fichier est vide");
        }
        if (table.size() - 1 > properties.maxRows()) {
            throw new BadRequestException("Trop de lignes : " + (table.size() - 1) + " (maximum "
                    + properties.maxRows() + ")");
        }
        Map<Field, Integer> positions = locateColumns(table.getFirst());
        List<ApogeeRow> rows = new ArrayList<>();
        for (int i = 1; i < table.size(); i++) {
            List<String> cells = table.get(i);
            if (cells.stream().allMatch(c -> c == null || c.isBlank())) {
                continue;
            }
            Map<Field, String> values = new EnumMap<>(Field.class);
            positions.forEach((field, index) -> values.put(field, clean(index < cells.size() ? cells.get(index) : null)));
            rows.add(new ApogeeRow(i + 1, values));
        }
        return rows;
    }

    private Map<Field, Integer> locateColumns(List<String> headers) {
        Map<String, Integer> byName = new HashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            if (headers.get(i) != null) {
                byName.putIfAbsent(normalize(headers.get(i)), i);
            }
        }
        Map<Field, Integer> positions = new EnumMap<>(Field.class);
        properties.columns().byField().forEach((field, column) -> {
            Integer index = byName.get(normalize(column));
            if (index != null) {
                positions.put(field, index);
            }
        });
        if (!positions.containsKey(Field.CNE)) {
            throw new BadRequestException("Colonne « " + properties.columns().cne() + " » introuvable. Colonnes "
                    + "du fichier : " + headers + ". La correspondance se règle dans esign.apogee.columns.*");
        }
        return positions;
    }

    /** « Date de naissance » → « DATE_DE_NAISSANCE » ; « Prénom » → « PRENOM ». */
    static String normalize(String header) {
        String noAccents = Normalizer.normalize(header.replace("﻿", ""), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return noAccents.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
    }

    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    // ---------------------------------------------------------------- CSV

    private static List<List<String>> readCsv(byte[] content) {
        String text = decode(content);
        String firstLine = text.lines().findFirst().orElse("");
        char delimiter = count(firstLine, ';') >= count(firstLine, ',')
                ? (count(firstLine, ';') >= count(firstLine, '\t') ? ';' : '\t')
                : ',';
        CSVFormat format = CSVFormat.DEFAULT.builder().setDelimiter(delimiter).setTrim(true).get();
        try (Reader reader = new StringReader(text); CSVParser parser = CSVParser.parse(reader, format)) {
            List<List<String>> table = new ArrayList<>();
            for (CSVRecord record : parser) {
                table.add(record.toList());
            }
            return table;
        } catch (IOException | UncheckedIOException e) {
            throw new BadRequestException("CSV illisible : " + e.getMessage());
        }
    }

    /** UTF-8 si possible, sinon Windows-1252 (exports Excel « CSV » sous Windows). */
    private static String decode(byte[] content) {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(content)).toString();
        } catch (CharacterCodingException e) {
            return new String(content, Charset.forName("windows-1252"));
        }
    }

    private static long count(String s, char c) {
        return s.chars().filter(ch -> ch == c).count();
    }

    // ---------------------------------------------------------------- Excel

    private static List<List<String>> readExcel(byte[] content) {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            Sheet sheet = workbook.getSheetAt(0);
            List<List<String>> table = new ArrayList<>();
            for (int r = 0; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                List<String> cells = new ArrayList<>();
                if (row != null) {
                    for (int c = 0; c < row.getLastCellNum(); c++) {
                        cells.add(cellText(row.getCell(c)));
                    }
                }
                table.add(cells);
            }
            return table;
        } catch (IOException | RuntimeException e) {
            throw new BadRequestException("Fichier Excel illisible : " + e.getMessage());
        }
    }

    private static String cellText(Cell cell) {
        if (cell == null) {
            return null;
        }
        CellType type = cell.getCellType() == CellType.FORMULA ? cell.getCachedFormulaResultType() : cell.getCellType();
        return switch (type) {
            case STRING -> cell.getStringCellValue();
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case NUMERIC -> DateUtil.isCellDateFormatted(cell)
                    ? cell.getLocalDateTimeCellValue().atZone(ZoneId.systemDefault()).toLocalDate().toString()
                    : BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
            default -> null;
        };
    }
}
