export interface AuthenticatedMetadata {
  sessionId?: string;
  examId: string;
  studentNim?: string;
  timestamp: number;
  originalSha256: string;
  purpose: "EXAM_DISTRIBUTION" | "EXAM_SUBMISSION";
  customAttributes?: Record<string, string | number | boolean>;
}

export interface ContainerHeaderComponents {
  formatVersion: number;
  algorithmIdentifier: number;
  keyIdentifier: Uint8Array;
  nonce: Uint8Array;
  originalFileSize: bigint;
  wrappedDek: Uint8Array;
  authenticatedMetadataRaw: Uint8Array;
  authenticatedMetadata: AuthenticatedMetadata;
  payloadLength: bigint;
}

export interface ParsedExamContainer {
  header: ContainerHeaderComponents;
  encryptedPayload: Uint8Array;
  authenticationTag: Uint8Array;
}

export interface EncodeExamContainerParameters {
  formatVersion?: number;
  algorithmIdentifier?: number;
  keyIdentifier: Uint8Array;
  nonce: Uint8Array;
  originalFileSize: bigint | number;
  wrappedDek: Uint8Array;
  authenticatedMetadata: AuthenticatedMetadata;
  encryptedPayload: Uint8Array;
  authenticationTag: Uint8Array;
}
