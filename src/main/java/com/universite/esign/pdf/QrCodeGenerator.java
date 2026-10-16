package com.universite.esign.pdf;

import java.awt.image.BufferedImage;
import java.util.Map;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

final class QrCodeGenerator {

    private QrCodeGenerator() {
    }

    static BufferedImage generate(String content, int size) {
        try {
            BitMatrix matrix = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size,
                    Map.of(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M,
                            EncodeHintType.MARGIN, 1,
                            EncodeHintType.CHARACTER_SET, "UTF-8"));
            BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_BYTE_BINARY);
            for (int x = 0; x < size; x++) {
                for (int y = 0; y < size; y++) {
                    image.setRGB(x, y, matrix.get(x, y) ? 0x000000 : 0xFFFFFF);
                }
            }
            return image;
        } catch (WriterException e) {
            throw new IllegalArgumentException("Impossible de générer le QR code", e);
        }
    }
}
