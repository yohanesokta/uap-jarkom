import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveMasterCryptoKey,
  wrapDataEncryptionKey,
  unwrapDataEncryptionKey,
  encryptExamPayload,
  decryptExamPayload,
  packagePkaFileIntoExamContainer,
  unpackExamContainerToPkaFile,
  calculateSha256Hex,
  deriveSessionKeyHex,
  generateRandomBytes
} from "../src/crypto.js";
import { AuthenticatedMetadata } from "@packet-tracer-exam/exam-format";

describe("Worker Crypto Service Unit Tests", () => {
  const masterSecretHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const dummyPkaBytes = new TextEncoder().encode("DUMMY_CISCO_PACKET_TRACER_BINARY_DATA_PKAZIP");

  const sampleMetadata: AuthenticatedMetadata = {
    examId: "exam_test_101",
    timestamp: Date.now(),
    originalSha256: "dummy_sha256",
    purpose: "EXAM_DISTRIBUTION"
  };

  it("should calculate sha256 hex correctly", async () => {
    const data = new TextEncoder().encode("antigravity");
    const hash = await calculateSha256Hex(data);
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 64);
  });

  it("should wrap and unwrap DEK correctly using derived master key", async () => {
    const masterKey = await deriveMasterCryptoKey(masterSecretHex);
    const originalDek = generateRandomBytes(32);

    const wrappedDek = await wrapDataEncryptionKey(originalDek, masterKey);
    assert.ok(wrappedDek.byteLength > 32);

    const unwrappedDek = await unwrapDataEncryptionKey(wrappedDek, masterKey);
    assert.deepEqual(unwrappedDek, originalDek);
  });

  it("should encrypt and decrypt payload with authenticated metadata", async () => {
    const dek = generateRandomBytes(32);
    const nonce = generateRandomBytes(12);

    const { ciphertext, authenticationTag } = await encryptExamPayload(
      dummyPkaBytes,
      dek,
      nonce,
      sampleMetadata
    );

    const decryptedBytes = await decryptExamPayload(
      ciphertext,
      authenticationTag,
      dek,
      nonce,
      sampleMetadata
    );

    assert.deepEqual(decryptedBytes, dummyPkaBytes);
  });

  it("should fail decryption when authenticated metadata is tampered with", async () => {
    const dek = generateRandomBytes(32);
    const nonce = generateRandomBytes(12);

    const { ciphertext, authenticationTag } = await encryptExamPayload(
      dummyPkaBytes,
      dek,
      nonce,
      sampleMetadata
    );

    const tamperedMetadata: AuthenticatedMetadata = {
      ...sampleMetadata,
      examId: "exam_attacker_hijack"
    };

    await assert.rejects(async () => {
      await decryptExamPayload(
        ciphertext,
        authenticationTag,
        dek,
        nonce,
        tamperedMetadata
      );
    });
  });

  it("should package and unpack full EXAMENC container correctly", async () => {
    const originalHash = await calculateSha256Hex(dummyPkaBytes);
    const fullMetadata: AuthenticatedMetadata = {
      ...sampleMetadata,
      originalSha256: originalHash
    };

    const { containerBytes } = await packagePkaFileIntoExamContainer(
      dummyPkaBytes,
      masterSecretHex,
      fullMetadata
    );

    assert.ok(containerBytes.byteLength > dummyPkaBytes.byteLength);

    const { pkaFileBytes, metadata } = await unpackExamContainerToPkaFile(
      containerBytes,
      masterSecretHex
    );

    assert.deepEqual(pkaFileBytes, dummyPkaBytes);
    assert.equal(metadata.examId, fullMetadata.examId);
    assert.equal(metadata.originalSha256, originalHash);
  });

  it("should derive deterministic session keys via HKDF", async () => {
    const keyHex1 = await deriveSessionKeyHex(masterSecretHex, "session_test_xyz");
    const keyHex2 = await deriveSessionKeyHex(masterSecretHex, "session_test_xyz");
    const keyHexDifferentSession = await deriveSessionKeyHex(masterSecretHex, "session_test_abc");

    assert.equal(keyHex1, keyHex2);
    assert.notEqual(keyHex1, keyHexDifferentSession);
    assert.equal(keyHex1.length, 64);
  });
});
