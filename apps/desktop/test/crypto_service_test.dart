import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:desktop/core/crypto/crypto_service.dart';

void main() {
  group('CryptoService Dart Unit Tests', () {
    final cryptoService = CryptoService();

    test('should calculate correct sha256 hex', () {
      final inputBytes = Uint8List.fromList(utf8.encode('antigravity'));
      final hex = cryptoService.calculateSha256Hex(inputBytes);
      expect(hex.length, 64);
    });

    test('should encrypt and decrypt with AES-256-GCM successfully', () async {
      final plaintext = Uint8List.fromList(utf8.encode('SECRET_PACKET_TRACER_PAYLOAD'));
      final key = cryptoService.generateRandomBytes(32);
      final nonce = cryptoService.generateRandomBytes(12);
      final aad = Uint8List.fromList(utf8.encode('ADDITIONAL_DATA'));

      final combined = await cryptoService.encryptWithAesGcm(
        plaintext: plaintext,
        keyBytes: key,
        nonce: nonce,
        additionalData: aad,
      );

      final ciphertext = combined.sublist(0, combined.length - 16);
      final tag = combined.sublist(combined.length - 16);

      final decrypted = await cryptoService.decryptWithAesGcm(
        ciphertext: ciphertext,
        authenticationTag: tag,
        keyBytes: key,
        nonce: nonce,
        additionalData: aad,
      );

      expect(decrypted, plaintext);
    });
  });
}
