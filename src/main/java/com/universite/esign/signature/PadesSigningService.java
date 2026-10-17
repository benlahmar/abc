package com.universite.esign.signature;

import java.awt.Color;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.TimeZone;
import java.util.concurrent.locks.ReentrantLock;

import com.universite.esign.config.EsignProperties;
import eu.europa.esig.dss.enumerations.DigestAlgorithm;
import eu.europa.esig.dss.enumerations.SignatureLevel;
import eu.europa.esig.dss.enumerations.SignerTextHorizontalAlignment;
import eu.europa.esig.dss.enumerations.SignerTextPosition;
import eu.europa.esig.dss.enumerations.TextWrapping;
import eu.europa.esig.dss.model.DSSDocument;
import eu.europa.esig.dss.model.InMemoryDocument;
import eu.europa.esig.dss.model.SignatureValue;
import eu.europa.esig.dss.model.ToBeSigned;
import eu.europa.esig.dss.pades.DSSFileFont;
import eu.europa.esig.dss.pades.PAdESSignatureParameters;
import eu.europa.esig.dss.pades.SignatureFieldParameters;
import eu.europa.esig.dss.pades.SignatureImageParameters;
import eu.europa.esig.dss.pades.SignatureImageTextParameters;
import eu.europa.esig.dss.pades.signature.PAdESService;
import eu.europa.esig.dss.token.DSSPrivateKeyEntry;
import org.springframework.stereotype.Service;

/**
 * Signature électronique avancée au format PAdES (ETSI EN 319 142) avec le cachet de l'établissement.
 */
@Service
public class PadesSigningService {

    private static final DateTimeFormatter DISPLAY = DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm");

    private final PAdESService padesService;
    private final SigningKeyProvider keys;
    private final EsignProperties properties;
    private final byte[] font;
    /** Les HSM PKCS#11 n'acceptent en général qu'une opération à la fois par session. */
    private final ReentrantLock tokenLock = new ReentrantLock();

    public PadesSigningService(PAdESService padesService, SigningKeyProvider keys, EsignProperties properties) {
        this.padesService = padesService;
        this.keys = keys;
        this.properties = properties;
        try (InputStream in = getClass().getResourceAsStream("/fonts/DejaVuSans.ttf")) {
            this.font = in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public SignedPdf sign(byte[] pdf, SignatureRequest request) {
        DSSPrivateKeyEntry key = keys.key();
        SignatureLevel level = properties.signing().level();
        Instant signingTime = Instant.now();

        PAdESSignatureParameters params = new PAdESSignatureParameters();
        params.setSignatureLevel(level);
        params.setDigestAlgorithm(DigestAlgorithm.SHA256);
        params.setSigningCertificate(key.getCertificate());
        params.setCertificateChain(key.getCertificateChain());
        params.bLevel().setSigningDate(Date.from(signingTime));
        params.setSigningTimeZone(TimeZone.getTimeZone(properties.institution().zone()));
        params.setReason(request.reason());
        params.setSignerName(request.signerName());
        params.setLocation(request.location());
        params.setAppName("esign-api");
        if (request.box() != null) {
            params.setImageParameters(visibleAppearance(request, signingTime));
        }

        DSSDocument toSign = new InMemoryDocument(pdf, "document.pdf");
        ToBeSigned dataToSign = padesService.getDataToSign(toSign, params);
        SignatureValue value;
        tokenLock.lock();
        try {
            value = keys.token().sign(dataToSign, params.getDigestAlgorithm(), key);
        } finally {
            tokenLock.unlock();
        }
        DSSDocument signed = padesService.signDocument(toSign, params, value);

        try (InputStream in = signed.openStream()) {
            return new SignedPdf(in.readAllBytes(), signingTime, level,
                    key.getCertificate().getSubject().getPrettyPrintRFC2253());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private SignatureImageParameters visibleAppearance(SignatureRequest request, Instant signingTime) {
        SignatureRequest.Box box = request.box();
        SignatureFieldParameters field = new SignatureFieldParameters();
        field.setPage(request.page());
        field.setOriginX(box.x());
        field.setOriginY(box.y());
        field.setWidth(box.width());
        field.setHeight(box.height());

        SignatureImageTextParameters text = new SignatureImageTextParameters();
        text.setText("Signé électroniquement par\n" + request.signerName() + "\nle "
                + DISPLAY.format(signingTime.atZone(properties.institution().zone())));
        DSSFileFont dssFont = new DSSFileFont(new InMemoryDocument(font), 8);
        // N'embarquer que les caractères utilisés (sinon ~400 Ko de police par document)
        dssFont.setEmbedFontSubset(true);
        text.setFont(dssFont);
        text.setTextColor(new Color(0x25, 0x54, 0x92)); // bleu de l'établissement
        text.setBackgroundColor(new Color(0xED, 0xF2, 0xF9));
        text.setTextWrapping(TextWrapping.FILL_BOX);
        text.setSignerTextPosition(SignerTextPosition.LEFT);
        text.setSignerTextHorizontalAlignment(SignerTextHorizontalAlignment.CENTER);
        text.setPadding(4);

        SignatureImageParameters image = new SignatureImageParameters();
        image.setFieldParameters(field);
        image.setTextParameters(text);
        return image;
    }
}
