import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/crypto/crypto_service.dart';
import '../../core/network/exam_api_client.dart';
import '../../core/storage/exam_storage_manager.dart';
import '../models/exam_app_state.dart';

class SubmissionScreen extends StatefulWidget {
  final ExamAppState appState;
  final ExamApiClient apiClient;
  final CryptoService cryptoService;
  final ExamStorageManager storageManager;
  final VoidCallback onFinishAndExit;
  final VoidCallback onGoToRecovery;

  const SubmissionScreen({
    super.key,
    required this.appState,
    required this.apiClient,
    required this.cryptoService,
    required this.storageManager,
    required this.onFinishAndExit,
    required this.onGoToRecovery,
  });

  @override
  State<SubmissionScreen> createState() => _SubmissionScreenState();
}

class _SubmissionScreenState extends State<SubmissionScreen> {
  bool _isFileVerified = false;
  bool _isEncrypted = false;
  bool _isBackupSaved = false;
  bool _isUploaded = false;
  bool _isFinished = false;
  String? _errorMessage;
  String _currentStepText = 'Memverifikasi keutuhan berkas jawaban...';

  @override
  void initState() {
    super.initState();
    _startSubmissionPipeline();
  }

  Future<void> _startSubmissionPipeline() async {
    setState(() {
      _errorMessage = null;
      _currentStepText = 'Membaca berkas hasil pengerjaan Packet Tracer...';
    });

    try {
      final pkaFile = widget.appState.localPlaintextPkaFile;
      if (pkaFile == null || !await pkaFile.exists()) {
        throw Exception('Berkas pengerjaan .pka tidak ditemukan di direktori kerja');
      }

      final pkaBytes = await pkaFile.readAsBytes();
      if (pkaBytes.isEmpty) {
        throw Exception('Berkas pengerjaan kosong (0 bytes)');
      }

      setState(() {
        _isFileVerified = true;
        _currentStepText = 'Menghitung checksum SHA-256 dan mengenkripsi jawaban (AES-256-GCM)...';
      });

      final session = widget.appState.sessionResult!;
      final originalSha256 = widget.cryptoService.calculateSha256Hex(pkaBytes);
      widget.appState.originalFileSha256 = originalSha256;

      final encryptedContainer = await widget.cryptoService.createEncryptedAnswerContainer(
        completedPkaBytes: pkaBytes,
        examId: session.examId,
        sessionId: session.sessionId,
        studentNim: widget.appState.nim,
        sessionKeyHex: widget.appState.sessionKeyHex!,
      );

      setState(() {
        _isEncrypted = true;
        _currentStepText = 'Menyimpan berkas cadangan lokal terenkripsi (.examenc)...';
      });

      final backupFile = await widget.storageManager.saveEncryptedLocalBackup(
        examId: session.examId,
        sessionId: session.sessionId,
        studentNim: widget.appState.nim,
        containerBytes: encryptedContainer,
      );
      widget.appState.localBackupPath = backupFile.path;

      setState(() {
        _isBackupSaved = true;
        _currentStepText = 'Mengunggah jawaban ke peladen Cloudflare R2...';
      });

      final submissionId = await widget.apiClient.initializeSubmission(
        sessionId: session.sessionId,
        examId: session.examId,
        sha256Original: originalSha256,
        fileSizeBytes: encryptedContainer.length,
        sessionToken: session.sessionToken,
      );
      widget.appState.completedSubmissionId = submissionId;

      await widget.apiClient.uploadEncryptedAnswer(
        submissionId: submissionId,
        containerBytes: encryptedContainer,
        sessionToken: session.sessionToken,
      );

      await widget.apiClient.completeSubmission(
        submissionId: submissionId,
        sessionToken: session.sessionToken,
      );

      setState(() {
        _isUploaded = true;
        _currentStepText = 'Membersihkan berkas plaintext sementara...';
      });

      await widget.storageManager.safelyDeleteTemporaryWorkspace(session.sessionId);

      setState(() {
        _isFinished = true;
        _currentStepText = 'Jawaban ujian berhasil dikumpulkan dan diverifikasi.';
      });
    } catch (error) {
      setState(() {
        _errorMessage = error.toString().replaceFirst('Exception: ', '');
        widget.appState.lastErrorMessage = _errorMessage;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.slateBackground,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32.0),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 540),
            child: Container(
              padding: const EdgeInsets.all(32.0),
              decoration: BoxDecoration(
                color: AppConstants.slateSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppConstants.slateBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: _isFinished
                            ? AppConstants.greenSuccess.withValues(alpha: 0.12)
                            : (_errorMessage != null
                                ? Colors.redAccent.withValues(alpha: 0.12)
                                : AppConstants.coralAccent.withValues(alpha: 0.12)),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _isFinished
                              ? AppConstants.greenSuccess.withValues(alpha: 0.4)
                              : (_errorMessage != null
                                  ? Colors.redAccent.withValues(alpha: 0.4)
                                  : AppConstants.coralAccent.withValues(alpha: 0.4)),
                          width: 1.5,
                        ),
                      ),
                      child: Icon(
                        _isFinished
                            ? Icons.check_circle_outline
                            : (_errorMessage != null
                                ? Icons.warning_amber_rounded
                                : Icons.cloud_upload_outlined),
                        size: 34,
                        color: _isFinished
                            ? AppConstants.greenSuccess
                            : (_errorMessage != null
                                ? Colors.redAccent
                                : AppConstants.coralAccent),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    _isFinished
                        ? 'Pengumpulan Berhasil!'
                        : (_errorMessage != null ? 'Pengunggahan Tertunda' : 'Memproses Pengumpulan'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppConstants.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _currentStepText,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: _errorMessage != null ? Colors.redAccent.shade100 : AppConstants.textMuted,
                    ),
                  ),
                  const SizedBox(height: 24),
                  _buildProgressItem('1. Verifikasi Berkas PKA Jawaban', _isFileVerified),
                  const SizedBox(height: 10),
                  _buildProgressItem('2. Enkripsi Jawaban (AES-256-GCM)', _isEncrypted),
                  const SizedBox(height: 10),
                  _buildProgressItem('3. Cadangan Lokal Aman (.examenc)', _isBackupSaved),
                  const SizedBox(height: 10),
                  _buildProgressItem('4. Unggah & Verifikasi Server', _isUploaded),
                  if (_isFinished) ...[
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppConstants.slateCard,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppConstants.greenSuccess.withValues(alpha: 0.3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'BUKTI TANDA TERIMA PENGUMPULAN',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppConstants.greenSuccess,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 10),
                          _buildReceiptField('ID Submisi', widget.appState.completedSubmissionId ?? '-'),
                          const SizedBox(height: 6),
                          _buildReceiptField('NIM / Mahasiswa', '${widget.appState.nim} • ${widget.appState.studentName}'),
                          const SizedBox(height: 6),
                          _buildReceiptField('Waktu Pengumpulan', DateTime.now().toLocal().toString().split('.')[0]),
                          const SizedBox(height: 6),
                          _buildReceiptField('Checksum SHA-256', widget.appState.originalFileSha256 ?? '-'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),
                    ElevatedButton(
                      onPressed: widget.onFinishAndExit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppConstants.greenSuccess,
                        foregroundColor: Colors.black87,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: const Text('Selesai & Keluar', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                  if (_errorMessage != null && !_isFinished) ...[
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Cadangan lokal telah tersimpan dengan aman di: ${widget.appState.localBackupPath ?? "Folder Cadangan"}. Jawaban Anda tidak akan hilang.',
                        style: const TextStyle(fontSize: 12, color: Colors.white70),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _startSubmissionPipeline,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppConstants.coralAccent,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            child: const Text('Coba Unggah Lagi'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        OutlinedButton(
                          onPressed: widget.onGoToRecovery,
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppConstants.slateBorder),
                            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: const Text('Layar Pemulihan', style: TextStyle(color: AppConstants.textPrimary)),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProgressItem(String title, bool isDone) {
    return Row(
      children: [
        Icon(
          isDone ? Icons.check_circle : Icons.radio_button_unchecked,
          size: 18,
          color: isDone ? AppConstants.greenSuccess : AppConstants.textMuted,
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: TextStyle(
            fontSize: 13,
            color: isDone ? AppConstants.textPrimary : AppConstants.textMuted,
            fontWeight: isDone ? FontWeight.w500 : FontWeight.normal,
          ),
        ),
      ],
    );
  }

  Widget _buildReceiptField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppConstants.textMuted)),
        const SizedBox(height: 1),
        SelectableText(
          value,
          style: const TextStyle(fontSize: 12, color: Colors.white, fontFamily: 'monospace'),
        ),
      ],
    );
  }
}
