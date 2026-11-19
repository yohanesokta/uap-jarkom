import 'dart:io';
import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/container/exam_container_codec.dart';
import '../../core/network/exam_api_client.dart';
import '../../core/storage/exam_storage_manager.dart';

class RecoveryScreen extends StatefulWidget {
  final ExamStorageManager storageManager;
  final ExamApiClient apiClient;
  final VoidCallback onBackToWelcome;

  const RecoveryScreen({
    super.key,
    required this.storageManager,
    required this.apiClient,
    required this.onBackToWelcome,
  });

  @override
  State<RecoveryScreen> createState() => _RecoveryScreenState();
}

class _RecoveryScreenState extends State<RecoveryScreen> {
  bool _isLoading = true;
  List<LocalBackupSummary> _backups = [];
  String? _statusNotification;
  String? _uploadingFilePath;

  @override
  void initState() {
    super.initState();
    _loadBackups();
  }

  Future<void> _loadBackups() async {
    setState(() {
      _isLoading = true;
      _statusNotification = null;
    });

    final list = await widget.storageManager.listAllEncryptedBackups();

    setState(() {
      _backups = list;
      _isLoading = false;
    });
  }

  Future<void> _retryUploadBackup(LocalBackupSummary backup) async {
    if (backup.isCorrupted) {
      setState(() {
        _statusNotification = 'Berkas terkorupsi dan tidak dapat diunggah.';
      });
      return;
    }

    setState(() {
      _uploadingFilePath = backup.filePath;
      _statusNotification = 'Memverifikasi kontainer dan mengunggah kembali...';
    });

    try {
      final file = File(backup.filePath);
      final bytes = await file.readAsBytes();
      final parsed = ExamContainerCodec.decode(bytes);
      final meta = parsed.header.authenticatedMetadata;

      final submissionId = await widget.apiClient.initializeSubmission(
        sessionId: meta.sessionId ?? 'recovered_session',
        examId: meta.examId,
        sha256Original: meta.originalSha256,
        fileSizeBytes: bytes.length,
        sessionToken: 'recovery_token',
      );

      await widget.apiClient.uploadEncryptedAnswer(
        submissionId: submissionId,
        containerBytes: bytes,
        sessionToken: 'recovery_token',
      );

      await widget.apiClient.completeSubmission(
        submissionId: submissionId,
        sessionToken: 'recovery_token',
      );

      setState(() {
        _uploadingFilePath = null;
        _statusNotification =
            'Cadangan ${backup.fileName} berhasil diunggah ulang!';
      });

      await _loadBackups();
    } catch (error) {
      setState(() {
        _uploadingFilePath = null;
        _statusNotification =
            'Gagal mengunggah: ${error.toString().replaceFirst("Exception: ", "")}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.slateBackground,
      appBar: AppBar(
        backgroundColor: AppConstants.slateSurface,
        elevation: 0,
        title: const Text(
          'Pusat Pemulihan Cadangan Ujian Lokal',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppConstants.textPrimary,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppConstants.textPrimary),
          onPressed: widget.onBackToWelcome,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppConstants.textPrimary),
            onPressed: _loadBackups,
            tooltip: 'Segarkan Daftar',
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppConstants.slateSurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppConstants.slateBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.shield_outlined,
                        color: AppConstants.coralAccent,
                        size: 24,
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Text(
                          'Berkas cadangan (.examenc) terenkripsi secara mandiri. Jika koneksi terputus saat ujian, Anda dapat mengunggahnya kapan saja melalui layar ini tanpa perlu mengulang ujian.',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppConstants.textMuted,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_statusNotification != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppConstants.coralAccent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: AppConstants.coralAccent.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      _statusNotification!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppConstants.coralAccent,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                Expanded(
                  child: _isLoading
                      ? const Center(
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(
                              AppConstants.coralAccent,
                            ),
                          ),
                        )
                      : _backups.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Icon(
                                Icons.inventory_2_outlined,
                                size: 48,
                                color: AppConstants.textMuted,
                              ),
                              SizedBox(height: 12),
                              Text(
                                'Tidak ada berkas cadangan lokal.',
                                style: TextStyle(
                                  color: AppConstants.textMuted,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          itemCount: _backups.length,
                          separatorBuilder: (context, index) =>
                              const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final backup = _backups[index];
                            final isCurrentlyUploading =
                                _uploadingFilePath == backup.filePath;

                            return Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppConstants.slateSurface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: backup.isCorrupted
                                      ? Colors.redAccent.withValues(alpha: 0.3)
                                      : AppConstants.slateBorder,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: backup.isCorrupted
                                          ? Colors.redAccent.withValues(
                                              alpha: 0.12,
                                            )
                                          : AppConstants.slateCard,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      backup.isCorrupted
                                          ? Icons.broken_image_outlined
                                          : Icons.lock_outline,
                                      color: backup.isCorrupted
                                          ? Colors.redAccent
                                          : AppConstants.cyanStatus,
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          backup.fileName,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'NIM: ${backup.studentNim} • ${(backup.fileSizeBytes / 1024).toStringAsFixed(1)} KB • ${backup.timestamp.toLocal().toString().split(".")[0]}',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: AppConstants.textMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  if (isCurrentlyUploading)
                                    const SizedBox(
                                      width: 24,
                                      height: 24,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor:
                                            AlwaysStoppedAnimation<Color>(
                                              AppConstants.coralAccent,
                                            ),
                                      ),
                                    )
                                  else
                                    ElevatedButton.icon(
                                      onPressed: backup.isCorrupted
                                          ? null
                                          : () => _retryUploadBackup(backup),
                                      icon: const Icon(Icons.upload, size: 16),
                                      label: const Text(
                                        'Unggah Ulang',
                                        style: TextStyle(fontSize: 12),
                                      ),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor:
                                            AppConstants.coralAccent,
                                        foregroundColor: Colors.white,
                                        disabledBackgroundColor:
                                            AppConstants.slateCard,
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 10,
                                        ),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
