import 'dart:typed_data';

class AuthenticatedMetadataDto {
  final String? sessionId;
  final String examId;
  final String? studentNim;
  final int timestamp;
  final String originalSha256;
  final String purpose;
  final Map<String, dynamic>? customAttributes;

  const AuthenticatedMetadataDto({
    this.sessionId,
    required this.examId,
    this.studentNim,
    required this.timestamp,
    required this.originalSha256,
    required this.purpose,
    this.customAttributes,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'examId': examId,
      'timestamp': timestamp,
      'originalSha256': originalSha256,
      'purpose': purpose,
    };
    if (sessionId != null) map['sessionId'] = sessionId;
    if (studentNim != null) map['studentNim'] = studentNim;
    if (customAttributes != null) map['customAttributes'] = customAttributes;
    return map;
  }

  factory AuthenticatedMetadataDto.fromJson(Map<String, dynamic> json) {
    return AuthenticatedMetadataDto(
      sessionId: json['sessionId'] as String?,
      examId: json['examId'] as String,
      studentNim: json['studentNim'] as String?,
      timestamp: json['timestamp'] as int,
      originalSha256: json['originalSha256'] as String,
      purpose: json['purpose'] as String,
      customAttributes: json['customAttributes'] as Map<String, dynamic>?,
    );
  }
}

class ContainerHeaderDto {
  final int formatVersion;
  final int algorithmIdentifier;
  final Uint8List keyIdentifier;
  final Uint8List nonce;
  final int originalFileSize;
  final Uint8List wrappedDek;
  final Uint8List authenticatedMetadataRaw;
  final AuthenticatedMetadataDto authenticatedMetadata;
  final int payloadLength;

  const ContainerHeaderDto({
    required this.formatVersion,
    required this.algorithmIdentifier,
    required this.keyIdentifier,
    required this.nonce,
    required this.originalFileSize,
    required this.wrappedDek,
    required this.authenticatedMetadataRaw,
    required this.authenticatedMetadata,
    required this.payloadLength,
  });
}

class ParsedExamContainerDto {
  final ContainerHeaderDto header;
  final Uint8List encryptedPayload;
  final Uint8List authenticationTag;

  const ParsedExamContainerDto({
    required this.header,
    required this.encryptedPayload,
    required this.authenticationTag,
  });
}

class EncodeExamContainerArguments {
  final int? formatVersion;
  final int? algorithmIdentifier;
  final Uint8List keyIdentifier;
  final Uint8List nonce;
  final int originalFileSize;
  final Uint8List wrappedDek;
  final AuthenticatedMetadataDto authenticatedMetadata;
  final Uint8List encryptedPayload;
  final Uint8List authenticationTag;

  const EncodeExamContainerArguments({
    this.formatVersion,
    this.algorithmIdentifier,
    required this.keyIdentifier,
    required this.nonce,
    required this.originalFileSize,
    required this.wrappedDek,
    required this.authenticatedMetadata,
    required this.encryptedPayload,
    required this.authenticationTag,
  });
}
