import {
  encodeExamContainer,
  decodeExamContainer
} from "@packet-tracer-exam/exam-format";
import { AuthenticatedMetadata } from "@packet-tracer-exam/exam-format";

export function hexStringToUint8Array(hexString: string): Uint8Array {
  if (hexString.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const byteArray = new Uint8Array(hexString.length / 2);
  for (let index = 0; index < hexString.length; index += 2) {
    byteArray[index / 2] = parseInt(hexString.substring(index, index + 2), 16);
  }
  return byteArray;
}

export function uint8ArrayToHexString(byteArray: Uint8Array): string {
  let hexString = "";
  for (let index = 0; index < byteArray.length; index++) {
    hexString += byteArray[index].toString(16).padStart(2, "0");
  }
  return hexString;
}

export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generateRandomUuidBytes(): Uint8Array {
  return generateRandomBytes(16);
}

export async function calculateSha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return uint8ArrayToHexString(new Uint8Array(hashBuffer));
}

export async function deriveMasterCryptoKey(masterSecret: string): Promise<CryptoKey> {
  let keyBytes: Uint8Array;
  if (/^[0-9a-fA-F]{64}$/.test(masterSecret)) {
    keyBytes = hexStringToUint8Array(masterSecret);
  } else {
    const rawSecretBytes = new TextEncoder().encode(masterSecret);
    const hash = await crypto.subtle.digest("SHA-256", rawSecretBytes);
    keyBytes = new Uint8Array(hash);
  }

  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function wrapDataEncryptionKey(
  dek: Uint8Array,
  masterKey: CryptoKey
): Promise<Uint8Array> {
  const wrappingNonce = generateRandomBytes(12);
  const encryptedDekBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: wrappingNonce
    },
    masterKey,
    dek
  );

  const encryptedDekArray = new Uint8Array(encryptedDekBuffer);
  const wrappedResult = new Uint8Array(wrappingNonce.length + encryptedDekArray.length);
  wrappedResult.set(wrappingNonce, 0);
  wrappedResult.set(encryptedDekArray, wrappingNonce.length);
  return wrappedResult;
}

export async function unwrapDataEncryptionKey(
  wrappedDekWithNonce: Uint8Array,
  masterKey: CryptoKey
): Promise<Uint8Array> {
  if (wrappedDekWithNonce.length < 12 + 16) {
    throw new Error("Invalid wrapped DEK length");
  }
  const wrappingNonce = wrappedDekWithNonce.subarray(0, 12);
  const encryptedDek = wrappedDekWithNonce.subarray(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: wrappingNonce
    },
    masterKey,
    encryptedDek
  );

  return new Uint8Array(decryptedBuffer);
}

export async function encryptExamPayload(
  payloadData: Uint8Array,
  dek: Uint8Array,
  nonce: Uint8Array,
  authenticatedMetadata: AuthenticatedMetadata
): Promise<{ ciphertext: Uint8Array; authenticationTag: Uint8Array }> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    dek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const metadataJsonString = JSON.stringify(authenticatedMetadata);
  const additionalDataBytes = new TextEncoder().encode(metadataJsonString);

  const encryptedResultBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: additionalDataBytes,
      tagLength: 128
    },
    cryptoKey,
    payloadData
  );

  const encryptedBytes = new Uint8Array(encryptedResultBuffer);
  const ciphertextLength = encryptedBytes.length - 16;
  const ciphertext = encryptedBytes.subarray(0, ciphertextLength);
  const authenticationTag = encryptedBytes.subarray(ciphertextLength);

  return { ciphertext, authenticationTag };
}

export async function decryptExamPayload(
  ciphertext: Uint8Array,
  authenticationTag: Uint8Array,
  dek: Uint8Array,
  nonce: Uint8Array,
  authenticatedMetadata: AuthenticatedMetadata
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    dek,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const combinedCiphertextAndTag = new Uint8Array(ciphertext.length + authenticationTag.length);
  combinedCiphertextAndTag.set(ciphertext, 0);
  combinedCiphertextAndTag.set(authenticationTag, ciphertext.length);

  const metadataJsonString = JSON.stringify(authenticatedMetadata);
  const additionalDataBytes = new TextEncoder().encode(metadataJsonString);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: additionalDataBytes,
      tagLength: 128
    },
    cryptoKey,
    combinedCiphertextAndTag
  );

  return new Uint8Array(decryptedBuffer);
}

export async function packagePkaFileIntoExamContainer(
  pkaFileBytes: Uint8Array,
  masterKeySecret: string,
  metadata: AuthenticatedMetadata
): Promise<{ containerBytes: Uint8Array; dekHex: string }> {
  const masterKey = await deriveMasterCryptoKey(masterKeySecret);
  const dek = generateRandomBytes(32);
  const nonce = generateRandomBytes(12);
  const keyIdentifier = generateRandomUuidBytes();

  const { ciphertext, authenticationTag } = await encryptExamPayload(
    pkaFileBytes,
    dek,
    nonce,
    metadata
  );

  const wrappedDek = await wrapDataEncryptionKey(dek, masterKey);

  const containerBytes = encodeExamContainer({
    keyIdentifier,
    nonce,
    originalFileSize: pkaFileBytes.byteLength,
    wrappedDek,
    authenticatedMetadata: metadata,
    encryptedPayload: ciphertext,
    authenticationTag
  });

  return {
    containerBytes,
    dekHex: uint8ArrayToHexString(dek)
  };
}

export async function unpackExamContainerToPkaFile(
  containerBytes: Uint8Array,
  masterKeySecret: string
): Promise<{ pkaFileBytes: Uint8Array; metadata: AuthenticatedMetadata }> {
  const masterKey = await deriveMasterCryptoKey(masterKeySecret);
  const parsedContainer = decodeExamContainer(containerBytes);

  const dek = await unwrapDataEncryptionKey(parsedContainer.header.wrappedDek, masterKey);

  const pkaFileBytes = await decryptExamPayload(
    parsedContainer.encryptedPayload,
    parsedContainer.authenticationTag,
    dek,
    parsedContainer.header.nonce,
    parsedContainer.header.authenticatedMetadata
  );

  return {
    pkaFileBytes,
    metadata: parsedContainer.header.authenticatedMetadata
  };
}
