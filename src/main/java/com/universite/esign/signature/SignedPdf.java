package com.universite.esign.signature;

import java.time.Instant;

import eu.europa.esig.dss.enumerations.SignatureLevel;

public record SignedPdf(byte[] content, Instant signingTime, SignatureLevel level, String signerSubject) {
}
