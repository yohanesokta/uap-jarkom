import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:desktop/core/constants/app_constants.dart';
import 'package:desktop/core/container/exam_container_codec.dart';
import 'package:desktop/core/container/exam_container_models.dart';

void main() {
  group('ExamContainerCodec Dart Unit Tests', () {
    final sampleKeyIdentifier = Uint8List(16)..fillRange(0, 16, 0xaa);
    final sampleNonce = Uint8List(12)..fillRange(0, 12, 0xbb);
    final sampleWrappedDek = Uint8List(48)..fillRange(0, 48, 0xcc);
    final samplePayload = Uint8List.fromList('PAYLOAD_DATA_DART'.codeUnits);
    final sampleTag = Uint8List(16)..fillRange(0, 16, 0xdd);

    final sampleMetadata = AuthenticatedMetadataDto(
      sessionId: 'sess_123',
      examId: 'exam_456',
      studentNim: '210001001',
      timestamp: 1731940000,
      originalSha256: 'dummy_hash',
      purpose: 'EXAM_SUBMISSION',
    );

    test('should encode and decode container with identical fields', () {
      final arguments = EncodeExamContainerArguments(
        keyIdentifier: sampleKeyIdentifier,
        nonce: sampleNonce,
        originalFileSize: samplePayload.length,
        wrappedDek: sampleWrappedDek,
        authenticatedMetadata: sampleMetadata,
        encryptedPayload: samplePayload,
        authenticationTag: sampleTag,
      );

      final encodedBuffer = ExamContainerCodec.encode(arguments);
      expect(encodedBuffer.isNotEmpty, true);

      final decoded = ExamContainerCodec.decode(encodedBuffer);
      expect(decoded.header.formatVersion, AppConstants.currentFormatVersion);
      expect(decoded.header.algorithmIdentifier, AppConstants.algorithmAes256Gcm);
      expect(decoded.header.keyIdentifier, sampleKeyIdentifier);
      expect(decoded.header.nonce, sampleNonce);
      expect(decoded.header.originalFileSize, samplePayload.length);
      expect(decoded.header.wrappedDek, sampleWrappedDek);
      expect(decoded.header.authenticatedMetadata.examId, sampleMetadata.examId);
      expect(decoded.encryptedPayload, samplePayload);
      expect(decoded.authenticationTag, sampleTag);
    });

    test('should throw format exception if magic bytes are invalid', () {
      final arguments = EncodeExamContainerArguments(
        keyIdentifier: sampleKeyIdentifier,
        nonce: sampleNonce,
        originalFileSize: samplePayload.length,
        wrappedDek: sampleWrappedDek,
        authenticatedMetadata: sampleMetadata,
        encryptedPayload: samplePayload,
        authenticationTag: sampleTag,
      );

      final encodedBuffer = ExamContainerCodec.encode(arguments);
      encodedBuffer[0] = 0x00;

      expect(
        () => ExamContainerCodec.decode(encodedBuffer),
        throwsA(isA<FormatException>()),
      );
    });
  });
}
