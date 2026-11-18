import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import '../../core/constants/app_constants.dart';
import '../../core/crypto/crypto_service.dart';
import '../../core/network/exam_api_client.dart';
import '../../core/process/packet_tracer_detector.dart';
import '../../core/storage/exam_storage_manager.dart';
import '../models/exam_app_state.dart';

class PreparationScreen extends StatefulWidget {
  final ExamAppState appState;
  final ExamApiClient apiClient;
  final CryptoService cryptoService;
  final ExamStorageManager storageManager;
  final PacketTracerDetector detector;
  final VoidCallback onExamLaunched;

  const PreparationScreen({
    super.key,
    required this.appState,
    required this.apiClient,
    required this.cryptoService,
    required this.storageManager,
    required this.detector,
    required this.onExamLaunched,
  });

  @override
  State<PreparationScreen> createState() => _PreparationScreenState();
}

class _PreparationScreenState extends State<PreparationScreen> {
  bool _isDetecting = true;
  bool _isDownloading = false;
  bool _isDecrypted = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _prepareEnvironment();
  }

  Future<void> _prepareEnvironment() async {
    setState(() {
      _isDetecting = true;
      _errorMessage = null;
    });

    final detection = await widget.detector.detect();
    widget.appState.detectionResult = detection;

    if (!detection.isInstalled) {
      setState(() {
        _isDetecting = false;
        _errorMessage = detection.diagnosticMessage ??
            'Cisco Packet Tracer tidak terdeteksi. Silakan pasang aplikasi Packet Tracer terlebih dahulu.';
      });
      return;
    }

    setState(() {
      _isDetecting = false;
      _isDownloading = true;
    });

    try {
      final session = widget.appState.sessionResult!;
      final downloadResult = await widget.apiClient.downloadExamPackage(
        examId: session.examId,
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
      );

      widget.appState.sessionKeyHex = downloadResult.sessionKeyHex;
      widget.appState.sessionWrappedDekHex = downloadResult.sessionWrappedDekHex;

      final pkaBytes = await widget.cryptoService.decryptDownloadedExamContainer(
        containerBytes: downloadResult.containerBytes,
        sessionKeyHex: downloadResult.sessionKeyHex,
        sessionWrappedDekHex: downloadResult.sessionWrappedDekHex,
      );

      final workspace = await widget.storageManager
          .getOrCreateSecureTemporaryWorkspace(session.sessionId);
      final pkaPath = p.join(workspace.path, 'exam_workspace.pka');
      final pkaFile = File(pkaPath);
      await pkaFile.writeAsBytes(pkaBytes, flush: true);

      widget.appState.localPlaintextPkaFile = pkaFile;
      widget.appState.originalFileSha256 = widget.cryptoService.calculateSha256Hex(pkaBytes);

      setState(() {
        _isDownloading = false;
        _isDecrypted = true;
      });
    } catch (error) {
      setState(() {
        _isDownloading = false;
        _errorMessage = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.appState.sessionResult;
    final detection = widget.appState.detectionResult;

    return Scaffold(
      backgroundColor: AppConstants.slateBackground,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32.0),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(24.0),
                  decoration: BoxDecoration(
                    color: AppConstants.slateSurface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppConstants.slateBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppConstants.coralAccent.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(
                              Icons.assignment_outlined,
                              color: AppConstants.coralAccent,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  session?.examTitle ?? 'Persiapan Ujian',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: AppConstants.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Durasi: ${session?.durationMinutes ?? 0} Menit • Mahasiswa: ${widget.appState.studentName} (${widget.appState.nim})',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppConstants.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      const Divider(color: AppConstants.slateBorder, height: 1),
                      const SizedBox(height: 20),
                      _buildStatusRow(
                        icon: Icons.computer,
                        title: 'Status Packet Tracer',
                        subtitle: detection?.isInstalled == true
                            ? (detection?.detectedVersion ?? 'Terpasang')
                            : 'Mendeteksi...',
                        isDone: detection?.isInstalled == true,
                        isLoading: _isDetecting,
                      ),
                      const SizedBox(height: 16),
                      _buildStatusRow(
                        icon: Icons.cloud_download_outlined,
                        title: 'Unduh Soal Terenkripsi',
                        subtitle: _isDecrypted ? 'Selesai diunduh' : 'Mengunduh kontainer...',
                        isDone: _isDecrypted,
                        isLoading: _isDownloading,
                      ),
                      const SizedBox(height: 16),
                      _buildStatusRow(
                        icon: Icons.lock_open_outlined,
                        title: 'Dekripsi Workspace Lokal',
                        subtitle: _isDecrypted
                            ? 'Ruang kerja sementara 0700 siap'
                            : 'Menunggu unduhan...',
                        isDone: _isDecrypted,
                        isLoading: false,
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: 20),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.redAccent.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.redAccent.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: const TextStyle(
                                    color: Colors.redAccent,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 28),
                      ElevatedButton.icon(
                        onPressed: _isDecrypted ? widget.onExamLaunched : null,
                        icon: const Icon(Icons.play_arrow_rounded, size: 22),
                        label: const Text(
                          'Buka Cisco Packet Tracer',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppConstants.coralAccent,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: AppConstants.slateCard,
                          disabledForegroundColor: Colors.white.withValues(alpha: 0.25),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          elevation: 0,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusRow({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isDone,
    required bool isLoading,
  }) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: isDone
                ? AppConstants.greenSuccess.withValues(alpha: 0.12)
                : AppConstants.slateCard,
            shape: BoxShape.circle,
            border: Border.all(
              color: isDone
                  ? AppConstants.greenSuccess.withValues(alpha: 0.4)
                  : AppConstants.slateBorder,
            ),
          ),
          child: isLoading
              ? const Padding(
                  padding: EdgeInsets.all(8.0),
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(AppConstants.coralAccent),
                  ),
                )
              : Icon(
                  isDone ? Icons.check : icon,
                  size: 18,
                  color: isDone ? AppConstants.greenSuccess : AppConstants.textMuted,
                ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppConstants.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 12, color: AppConstants.textMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
