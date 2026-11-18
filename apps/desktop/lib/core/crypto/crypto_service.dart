import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart' as standard_crypto;
import 'package:cryptography/cryptography.dart' as fast_crypto;
import '../constants/app_constants.dart';
import '../container/exam_container_codec.dart';
import '../container/exam_container_models.dart';

class CryptoService {
  final fast_crypto.AesGcm _aesGcm = fast_crypto.AesGcm.with256bits();

  Uint8List generateRandomBytes(int length) {
    final random = Random.secure();
    final bytes = Uint8List(length);
    for (int index = 0; index < length; index++) {
      bytes[index] = random.nextInt(256);
    }
    return bytes;
  }

  String calculateSha256Hex(Uint8List data) {
    final digest = standard_crypto.sha256.convert(data);
    return digest.toString();
  }

  String bytesToHex(Uint8List bytes) {
    final buffer = StringBuffer();
    for (final byte in bytes) {
      buffer.write(byte.toRadixString(16).padLeft(2, '0'));
    }
    return buffer.toString();
  }

  Uint8List hexToBytes(String hex) {
    if (hex.length % 2 != 0) {
      throw const FormatException('Invalid hex string length');
    }
    final bytes = Uint8List(hex.length ~/ 2);
    for (int index = 0; index < hex.length; index += 2) {
      bytes[index ~/ 2] = int.parse(hex.substring(index, index + 2), radix: 16);
    }
    return bytes;
  }

  Future<Uint8List> encryptWithAesGcm({
    required Uint8List plaintext,
    required Uint8List keyBytes,
    required Uint8List nonce,
    required Uint8List additionalData,
  }) async {
    final secretKey = fast_crypto.SecretKey(keyBytes);
    final secretBox = await _aesGcm.encrypt(
      plaintext,
      secretKey: secretKey,
      nonce: nonce,
      aad: additionalData,
    );

    final combinedResult = Uint8List(secretBox.cipherText.length + secretBox.mac.bytes.length);
    combinedResult.setRange(0, secretBox.cipherText.length, secretBox.cipherText);
    combinedResult.setRange(secretBox.cipherText.length, combinedResult.length, secretBox.mac.bytes);
    return combinedResult;
  }

  Future<Uint8List> decryptWithAesGcm({
    required Uint8List ciphertext,
    required Uint8List authenticationTag,
    required Uint8List keyBytes,
    required Uint8List nonce,
    required Uint8List additionalData,
  }) async {
    final secretKey = fast_crypto.SecretKey(keyBytes);
    final secretBox = fast_crypto.SecretBox(
      ciphertext,
      nonce: nonce,
      mac: fast_crypto.Mac(authenticationTag),
    );

    final decryptedBytes = await _aesGcm.decrypt(
      secretBox,
      secretKey: secretKey,
      aad: additionalData,
    );
    return Uint8List.fromList(decryptedBytes);
  }

  Future<Uint8List> decryptDownloadedExamContainer({
    required Uint8List containerBytes,
    required String sessionKeyHex,
    required String sessionWrappedDekHex,
  }) async {
    final parsed = ExamContainerCodec.decode(containerBytes);
    final sessionKeyBytes = hexToBytes(sessionKeyHex);
    final sessionWrappedDekBytes = hexToBytes(sessionWrappedDekHex);

    final unwrappedDekNonce = sessionWrappedDekBytes.sublist(0, 12);
    final unwrappedDekCiphertext = sessionWrappedDekBytes.sublist(12, sessionWrappedDekBytes.length - 16);
    final unwrappedDekTag = sessionWrappedDekBytes.sublist(sessionWrappedDekBytes.length - 16);

    final actualDek = await decryptWithAesGcm(
      ciphertext: unwrappedDekCiphertext,
      authenticationTag: unwrappedDekTag,
      keyBytes: sessionKeyBytes,
      nonce: unwrappedDekNonce,
      additionalData: Uint8List(0),
    );

    final metadataJsonBytes = Uint8List.fromList(
      utf8.encode(jsonEncode(parsed.header.authenticatedMetadata.toJson()))
    );

    final pkaPlaintext = await decryptWithAesGcm(
      ciphertext: parsed.encryptedPayload,
      authenticationTag: parsed.authenticationTag,
      keyBytes: actualDek,
      nonce: parsed.header.nonce,
      additionalData: metadataJsonBytes,
    );

    return pkaPlaintext;
  }

  Future<Uint8List> createEncryptedAnswerContainer({
    required Uint8List completedPkaBytes,
    required String examId,
    required String sessionId,
    required String studentNim,
    required String sessionKeyHex,
  }) async {
    final originalSha256 = calculateSha256Hex(completedPkaBytes);
    final freshDek = generateRandomBytes(32);
    final freshNonce = generateRandomBytes(AppConstants.nonceByteLength);
    final keyIdentifier = generateRandomBytes(AppConstants.keyIdentifierByteLength);

    final metadata = AuthenticatedMetadataDto(
      sessionId: sessionId,
      examId: examId,
      studentNim: studentNim,
      timestamp: DateTime.now().millisecondsSinceEpoch,
      originalSha256: originalSha256,
      purpose: 'EXAM_SUBMISSION',
    );

    final metadataJsonBytes = Uint8List.fromList(
      utf8.encode(jsonEncode(metadata.toJson()))
    );

    final secretKey = fast_crypto.SecretKey(freshDek);
    final secretBox = await _aesGcm.encrypt(
      completedPkaBytes,
      secretKey: secretKey,
      nonce: freshNonce,
      aad: metadataJsonBytes,
    );

    final sessionKeyBytes = hexToBytes(sessionKeyHex);
    final wrappingNonce = generateRandomBytes(12);
    final wrappingSecretKey = fast_crypto.SecretKey(sessionKeyBytes);
    final wrappedSecretBox = await _aesGcm.encrypt(
      freshDek,
      secretKey: wrappingSecretKey,
      nonce: wrappingNonce,
      aad: Uint8List(0),
    );

    final combinedWrappedDek = Uint8List(
      wrappingNonce.length + wrappedSecretBox.cipherText.length + wrappedSecretBox.mac.bytes.length
    );
    combinedWrappedDek.setRange(0, 12, wrappingNonce);
    combinedWrappedDek.setRange(12, 12 + wrappedSecretBox.cipherText.length, wrappedSecretBox.cipherText);
    combinedWrappedDek.setRange(
      12 + wrappedSecretBox.cipherText.length,
      combinedWrappedDek.length,
      wrappedSecretBox.mac.bytes
    );

    return ExamContainerCodec.encode(
      EncodeExamContainerArguments(
        keyIdentifier: keyIdentifier,
        nonce: freshNonce,
        originalFileSize: completedPkaBytes.length,
        wrappedDek: combinedWrappedDek,
        authenticatedMetadata: metadata,
        encryptedPayload: Uint8List.fromList(secretBox.cipherText),
        authenticationTag: Uint8List.fromList(secretBox.mac.bytes),
      ),
    );
  }
}
