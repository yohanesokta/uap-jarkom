import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encodeExamContainer,
  decodeExamContainer,
  EXAM_CONTAINER_MAGIC_BYTES,
  CURRENT_FORMAT_VERSION,
  ALGORITHM_IDENTIFIER_AES_256_GCM
} from "../src/index.js";
import { AuthenticatedMetadata, EncodeExamContainerParameters } from "../src/types.js";

describe("Exam Container Binary Format", () => {
  const sampleKeyIdentifier = new Uint8Array(16).fill(0xaa);
  const sampleNonce = new Uint8Array(12).fill(0xbb);
  const sampleWrappedDek = new Uint8Array(48).fill(0xcc);
  const samplePayload = new TextEncoder().encode("PACKET_TRACER_ENCRYPTED_PAYLOAD_BINARY_DATA");
  const sampleAuthenticationTag = new Uint8Array(16).fill(0xdd);

  const sampleMetadata: AuthenticatedMetadata = {
    sessionId: "session_001",
    examId: "exam_100",
    studentNim: "210001001",
    timestamp: 1731940000,
    originalSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    purpose: "EXAM_SUBMISSION"
  };

  const sampleParameters: EncodeExamContainerParameters = {
    keyIdentifier: sampleKeyIdentifier,
    nonce: sampleNonce,
    originalFileSize: 1024,
    wrappedDek: sampleWrappedDek,
    authenticatedMetadata: sampleMetadata,
    encryptedPayload: samplePayload,
    authenticationTag: sampleAuthenticationTag
  };

  it("should encode and decode a valid container successfully with identical fields", () => {
    const encodedContainer = encodeExamContainer(sampleParameters);
    assert.ok(encodedContainer instanceof Uint8Array);

    const decoded = decodeExamContainer(encodedContainer);

    assert.equal(decoded.header.formatVersion, CURRENT_FORMAT_VERSION);
    assert.equal(decoded.header.algorithmIdentifier, ALGORITHM_IDENTIFIER_AES_256_GCM);
    assert.deepEqual(decoded.header.keyIdentifier, sampleKeyIdentifier);
    assert.deepEqual(decoded.header.nonce, sampleNonce);
    assert.equal(decoded.header.originalFileSize, BigInt(1024));
    assert.deepEqual(decoded.header.wrappedDek, sampleWrappedDek);
    assert.deepEqual(decoded.header.authenticatedMetadata, sampleMetadata);
    assert.deepEqual(decoded.encryptedPayload, samplePayload);
    assert.deepEqual(decoded.authenticationTag, sampleAuthenticationTag);
  });

  it("should reject a container with corrupted magic bytes", () => {
    const encodedContainer = encodeExamContainer(sampleParameters);
    const corruptedContainer = new Uint8Array(encodedContainer);
    corruptedContainer[0] = 0x00;

    assert.throws(
      () => decodeExamContainer(corruptedContainer),
      /Invalid magic bytes in container header/
    );
  });

  it("should reject a container with unsupported version", () => {
    const encodedContainer = encodeExamContainer(sampleParameters);
    const corruptedContainer = new Uint8Array(encodedContainer);
    const dataView = new DataView(
      corruptedContainer.buffer,
      corruptedContainer.byteOffset,
      corruptedContainer.byteLength
    );
    dataView.setUint16(8, 999, false);

    assert.throws(
      () => decodeExamContainer(corruptedContainer),
      /Unsupported container format version: 999/
    );
  });

  it("should reject a container with unsupported algorithm identifier", () => {
    const encodedContainer = encodeExamContainer(sampleParameters);
    const corruptedContainer = new Uint8Array(encodedContainer);
    const dataView = new DataView(
      corruptedContainer.buffer,
      corruptedContainer.byteOffset,
      corruptedContainer.byteLength
    );
    dataView.setUint16(10, 5, false);

    assert.throws(
      () => decodeExamContainer(corruptedContainer),
      /Unsupported algorithm identifier: 5/
    );
  });

  it("should throw error if key identifier byte length is invalid", () => {
    const invalidParameters = {
      ...sampleParameters,
      keyIdentifier: new Uint8Array(8)
    };

    assert.throws(
      () => encodeExamContainer(invalidParameters),
      /Invalid key identifier byte length/
    );
  });

  it("should throw error if nonce byte length is invalid", () => {
    const invalidParameters = {
      ...sampleParameters,
      nonce: new Uint8Array(16)
    };

    assert.throws(
      () => encodeExamContainer(invalidParameters),
      /Invalid nonce byte length/
    );
  });

  it("should throw error if authentication tag byte length is invalid", () => {
    const invalidParameters = {
      ...sampleParameters,
      authenticationTag: new Uint8Array(12)
    };

    assert.throws(
      () => encodeExamContainer(invalidParameters),
      /Invalid authentication tag byte length/
    );
  });

  it("should reject truncated container buffers", () => {
    const encodedContainer = encodeExamContainer(sampleParameters);
    const truncatedContainer = encodedContainer.subarray(0, encodedContainer.byteLength - 10);

    assert.throws(
      () => decodeExamContainer(truncatedContainer),
      /Container length mismatch/
    );
  });
});
