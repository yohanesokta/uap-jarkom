import 'dart:typed_data';
import 'package:flutter/material.dart';

class AppConstants {
  static final Uint8List containerMagicBytes = Uint8List.fromList([
    0x45, 0x58, 0x41, 0x4D, 0x45, 0x4E, 0x43, 0x01
  ]);

  static const int currentFormatVersion = 1;
  static const int algorithmAes256Gcm = 1;
  static const int fixedHeaderByteLength = 64;
  static const int authenticationTagByteLength = 16;
  static const int nonceByteLength = 12;
  static const int keyIdentifierByteLength = 16;

  static const String backupFileExtension = '.examenc';
  static const String defaultApiBaseUrl = 'http://127.0.0.1:8787';

  static const Color slateBackground = Color(0xFF1E1E2E);
  static const Color slateSurface = Color(0xFF26283D);
  static const Color slateCard = Color(0xFF2F324D);
  static const Color slateBorder = Color(0xFF3B3E5B);
  static const Color coralAccent = Color(0xFFF7768E);
  static const Color coralAccentHover = Color(0xFFFF757F);
  static const Color cyanStatus = Color(0xFF73DACA);
  static const Color greenSuccess = Color(0xFF9ECE6A);
  static const Color amberWarning = Color(0xFFE0AF68);
  static const Color textPrimary = Color(0xFFC0CAF5);
  static const Color textMuted = Color(0xFF7AA2F7);
}
