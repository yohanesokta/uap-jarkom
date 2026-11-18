import {
  EXAM_CONTAINER_MAGIC_BYTES,
  CURRENT_FORMAT_VERSION,
  ALGORITHM_IDENTIFIER_AES_256_GCM,
  FIXED_HEADER_BYTE_LENGTH,
  AUTHENTICATION_TAG_BYTE_LENGTH,
  NONCE_BYTE_LENGTH,
  KEY_IDENTIFIER_BYTE_LENGTH
} from "./constants.js";
import {
  AuthenticatedMetadata,
  ContainerHeaderComponents,
  EncodeExamContainerParameters,
  ParsedExamContainer
} from "./types.js";

function areByteArraysEqual(firstArray: Uint8Array, secondArray: Uint8Array): boolean {
  if (firstArray.byteLength !== secondArray.byteLength) {
    return false;
  }
  for (let index = 0; index < firstArray.byteLength; index++) {
    if (firstArray[index] !== secondArray[index]) {
      return false;
    }
  }
  return true;
}

export function encodeExamContainer(parameters: EncodeExamContainerParameters): Uint8Array {
  const formatVersion = parameters.formatVersion ?? CURRENT_FORMAT_VERSION;
  const algorithmIdentifier = parameters.algorithmIdentifier ?? ALGORITHM_IDENTIFIER_AES_256_GCM;

  if (parameters.keyIdentifier.byteLength !== KEY_IDENTIFIER_BYTE_LENGTH) {
    throw new Error(
      `Invalid key identifier byte length: expected ${KEY_IDENTIFIER_BYTE_LENGTH}, received ${parameters.keyIdentifier.byteLength}`
    );
  }

  if (parameters.nonce.byteLength !== NONCE_BYTE_LENGTH) {
    throw new Error(
      `Invalid nonce byte length: expected ${NONCE_BYTE_LENGTH}, received ${parameters.nonce.byteLength}`
    );
  }

  if (parameters.authenticationTag.byteLength !== AUTHENTICATION_TAG_BYTE_LENGTH) {
    throw new Error(
      `Invalid authentication tag byte length: expected ${AUTHENTICATION_TAG_BYTE_LENGTH}, received ${parameters.authenticationTag.byteLength}`
    );
  }

  const metadataJsonString = JSON.stringify(parameters.authenticatedMetadata);
  const metadataBytes = new TextEncoder().encode(metadataJsonString);

  const wrappedDekByteLength = parameters.wrappedDek.byteLength;
  const metadataByteLength = metadataBytes.byteLength;
  const payloadByteLength = parameters.encryptedPayload.byteLength;

  const totalContainerByteLength =
    FIXED_HEADER_BYTE_LENGTH +
    wrappedDekByteLength +
    metadataByteLength +
    payloadByteLength +
    AUTHENTICATION_TAG_BYTE_LENGTH;

  const containerBuffer = new Uint8Array(totalContainerByteLength);
  const dataView = new DataView(
    containerBuffer.buffer,
    containerBuffer.byteOffset,
    containerBuffer.byteLength
  );

  containerBuffer.set(EXAM_CONTAINER_MAGIC_BYTES, 0);
  dataView.setUint16(8, formatVersion, false);
  dataView.setUint16(10, algorithmIdentifier, false);

  containerBuffer.set(parameters.keyIdentifier, 12);
  containerBuffer.set(parameters.nonce, 28);

  dataView.setUint32(40, wrappedDekByteLength, false);
  dataView.setBigUint64(44, BigInt(parameters.originalFileSize), false);
  dataView.setUint32(52, metadataByteLength, false);
  dataView.setBigUint64(56, BigInt(payloadByteLength), false);

  let currentWriteOffset = FIXED_HEADER_BYTE_LENGTH;

  containerBuffer.set(parameters.wrappedDek, currentWriteOffset);
  currentWriteOffset += wrappedDekByteLength;

  containerBuffer.set(metadataBytes, currentWriteOffset);
  currentWriteOffset += metadataByteLength;

  containerBuffer.set(parameters.encryptedPayload, currentWriteOffset);
  currentWriteOffset += payloadByteLength;

  containerBuffer.set(parameters.authenticationTag, currentWriteOffset);

  return containerBuffer;
}

export function decodeExamContainer(containerBuffer: Uint8Array): ParsedExamContainer {
  if (containerBuffer.byteLength < FIXED_HEADER_BYTE_LENGTH + AUTHENTICATION_TAG_BYTE_LENGTH) {
    throw new Error(
      `Buffer is too small to be a valid container: minimum size is ${
        FIXED_HEADER_BYTE_LENGTH + AUTHENTICATION_TAG_BYTE_LENGTH
      } bytes`
    );
  }

  const magicBytesCandidate = containerBuffer.subarray(0, 8);
  if (!areByteArraysEqual(magicBytesCandidate, EXAM_CONTAINER_MAGIC_BYTES)) {
    throw new Error("Invalid magic bytes in container header");
  }

  const dataView = new DataView(
    containerBuffer.buffer,
    containerBuffer.byteOffset,
    containerBuffer.byteLength
  );

  const formatVersion = dataView.getUint16(8, false);
  if (formatVersion !== CURRENT_FORMAT_VERSION) {
    throw new Error(`Unsupported container format version: ${formatVersion}`);
  }

  const algorithmIdentifier = dataView.getUint16(10, false);
  if (algorithmIdentifier !== ALGORITHM_IDENTIFIER_AES_256_GCM) {
    throw new Error(`Unsupported algorithm identifier: ${algorithmIdentifier}`);
  }

  const keyIdentifier = containerBuffer.slice(12, 28);
  const nonce = containerBuffer.slice(28, 40);

  const wrappedDekByteLength = dataView.getUint32(40, false);
  const originalFileSize = dataView.getBigUint64(44, false);
  const metadataByteLength = dataView.getUint32(52, false);
  const payloadByteLength = dataView.getBigUint64(56, false);

  const expectedTotalByteLength =
    BigInt(FIXED_HEADER_BYTE_LENGTH) +
    BigInt(wrappedDekByteLength) +
    BigInt(metadataByteLength) +
    payloadByteLength +
    BigInt(AUTHENTICATION_TAG_BYTE_LENGTH);

  if (BigInt(containerBuffer.byteLength) !== expectedTotalByteLength) {
    throw new Error(
      `Container length mismatch: buffer length ${containerBuffer.byteLength} does not equal calculated length ${expectedTotalByteLength}`
    );
  }

  let currentReadOffset = FIXED_HEADER_BYTE_LENGTH;

  const wrappedDek = containerBuffer.slice(
    currentReadOffset,
    currentReadOffset + wrappedDekByteLength
  );
  currentReadOffset += wrappedDekByteLength;

  const metadataBytes = containerBuffer.slice(
    currentReadOffset,
    currentReadOffset + metadataByteLength
  );
  currentReadOffset += metadataByteLength;

  const payloadEndOffset = currentReadOffset + Number(payloadByteLength);
  const encryptedPayload = containerBuffer.slice(currentReadOffset, payloadEndOffset);
  currentReadOffset = payloadEndOffset;

  const authenticationTag = containerBuffer.slice(
    currentReadOffset,
    currentReadOffset + AUTHENTICATION_TAG_BYTE_LENGTH
  );

  let authenticatedMetadata: AuthenticatedMetadata;
  try {
    const metadataString = new TextDecoder("utf-8").decode(metadataBytes);
    authenticatedMetadata = JSON.parse(metadataString) as AuthenticatedMetadata;
  } catch (error) {
    throw new Error(`Failed to parse authenticated metadata JSON: ${(error as Error).message}`);
  }

  const header: ContainerHeaderComponents = {
    formatVersion,
    algorithmIdentifier,
    keyIdentifier,
    nonce,
    originalFileSize,
    wrappedDek,
    authenticatedMetadataRaw: metadataBytes,
    authenticatedMetadata,
    payloadLength: payloadByteLength
  };

  return {
    header,
    encryptedPayload,
    authenticationTag
  };
}
