import 'dart:io';
import '../../core/network/exam_api_client.dart';
import '../../core/process/packet_tracer_detector.dart';

class ExamAppState {
  String nim = '';
  String studentName = '';
  String classCode = '';
  String examCode = '';

  SessionValidationResult? sessionResult;
  String? sessionKeyHex;
  String? sessionWrappedDekHex;

  PacketTracerDetectionResult? detectionResult;
  File? localPlaintextPkaFile;
  int? packetTracerProcessId;

  String? completedSubmissionId;
  String? originalFileSha256;
  String? localBackupPath;
  String? lastErrorMessage;

  void reset() {
    nim = '';
    studentName = '';
    classCode = '';
    examCode = '';
    sessionResult = null;
    sessionKeyHex = null;
    sessionWrappedDekHex = null;
    detectionResult = null;
    localPlaintextPkaFile = null;
    packetTracerProcessId = null;
    completedSubmissionId = null;
    originalFileSha256 = null;
    localBackupPath = null;
    lastErrorMessage = null;
  }
}
