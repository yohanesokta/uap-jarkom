import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../constants/app_constants.dart';

class SessionValidationResult {
  final String sessionId;
  final String sessionToken;
  final String examId;
  final String examTitle;
  final int durationMinutes;
  final String expiresAt;

  const SessionValidationResult({
    required this.sessionId,
    required this.sessionToken,
    required this.examId,
    required this.examTitle,
    required this.durationMinutes,
    required this.expiresAt,
  });

  factory SessionValidationResult.fromJson(Map<String, dynamic> json) {
    return SessionValidationResult(
      sessionId: json['sessionId'] as String,
      sessionToken: json['sessionToken'] as String,
      examId: json['examId'] as String,
      examTitle: json['examTitle'] as String,
      durationMinutes: json['durationMinutes'] as int,
      expiresAt: json['expiresAt'] as String,
    );
  }
}

class ExamDownloadResult {
  final String examId;
  final String sessionKeyHex;
  final String sessionWrappedDekHex;
  final Uint8List containerBytes;

  const ExamDownloadResult({
    required this.examId,
    required this.sessionKeyHex,
    required this.sessionWrappedDekHex,
    required this.containerBytes,
  });
}

class ExamApiClient {
  final String baseUrl;
  final http.Client _httpClient = http.Client();

  ExamApiClient({String? customBaseUrl})
      : baseUrl = customBaseUrl ?? AppConstants.defaultApiBaseUrl;

  Future<SessionValidationResult> validateExamCode({
    required String nim,
    required String studentName,
    required String classCode,
    required String examCode,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/api/v1/exam/validate'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'nim': nim,
        'studentName': studentName,
        'classCode': classCode,
        'examCode': examCode,
      }),
    );

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 || json['success'] != true) {
      final errorMessage = json['error']?['message'] ?? 'Validasi kode ujian gagal.';
      throw Exception(errorMessage);
    }

    return SessionValidationResult.fromJson(json['data'] as Map<String, dynamic>);
  }

  Future<ExamDownloadResult> downloadExamPackage({
    required String examId,
    required String sessionId,
    required String sessionToken,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/api/v1/exams/$examId/download'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $sessionToken',
      },
      body: jsonEncode({'sessionId': sessionId}),
    );

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 || json['success'] != true) {
      final errorMessage = json['error']?['message'] ?? 'Pengunduhan soal ujian gagal.';
      throw Exception(errorMessage);
    }

    final data = json['data'] as Map<String, dynamic>;
    final containerHex = data['containerBase64'] as String;

    final containerBytes = Uint8List(containerHex.length ~/ 2);
    for (int index = 0; index < containerHex.length; index += 2) {
      containerBytes[index ~/ 2] = int.parse(containerHex.substring(index, index + 2), radix: 16);
    }

    return ExamDownloadResult(
      examId: data['examId'] as String,
      sessionKeyHex: data['sessionKeyHex'] as String,
      sessionWrappedDekHex: data['sessionWrappedDekHex'] as String,
      containerBytes: containerBytes,
    );
  }

  Future<String> initializeSubmission({
    required String sessionId,
    required String examId,
    required String sha256Original,
    required int fileSizeBytes,
    required String sessionToken,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/api/v1/submissions/init'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $sessionToken',
      },
      body: jsonEncode({
        'sessionId': sessionId,
        'examId': examId,
        'sha256Original': sha256Original,
        'fileSizeBytes': fileSizeBytes,
      }),
    );

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 201 || json['success'] != true) {
      final errorMessage = json['error']?['message'] ?? 'Inisialisasi pengunggahan gagal.';
      throw Exception(errorMessage);
    }

    return json['data']['submissionId'] as String;
  }

  Future<void> uploadEncryptedAnswer({
    required String submissionId,
    required Uint8List containerBytes,
    required String sessionToken,
  }) async {
    final response = await _httpClient.put(
      Uri.parse('$baseUrl/api/v1/submissions/$submissionId/upload'),
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': 'Bearer $sessionToken',
      },
      body: containerBytes,
    );

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 || json['success'] != true) {
      final errorMessage = json['error']?['message'] ?? 'Pengunggahan berkas jawaban gagal.';
      throw Exception(errorMessage);
    }
  }

  Future<void> completeSubmission({
    required String submissionId,
    required String sessionToken,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/api/v1/submissions/$submissionId/complete'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $sessionToken',
      },
    );

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 || json['success'] != true) {
      final errorMessage = json['error']?['message'] ?? 'Penyelesaian submisi gagal.';
      throw Exception(errorMessage);
    }
  }

  Future<void> sendHeartbeat({
    required String sessionId,
    required String sessionToken,
  }) async {
    try {
      await _httpClient.post(
        Uri.parse('$baseUrl/api/v1/sessions/$sessionId/heartbeat'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $sessionToken',
        },
      );
    } catch (_) {}
  }
}
