import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/network/exam_api_client.dart';
import '../models/exam_app_state.dart';

class ValidationScreen extends StatefulWidget {
  final ExamAppState appState;
  final ExamApiClient apiClient;
  final VoidCallback onValidationSuccess;
  final VoidCallback onBackToWelcome;

  const ValidationScreen({
    super.key,
    required this.appState,
    required this.apiClient,
    required this.onValidationSuccess,
    required this.onBackToWelcome,
  });

  @override
  State<ValidationScreen> createState() => _ValidationScreenState();
}

class _ValidationScreenState extends State<ValidationScreen> {
  String _statusText = 'Menghubungi peladen ujian...';
  String? _errorMessage;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _startValidation();
  }

  Future<void> _startValidation() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _statusText = 'Memvalidasi kode ujian dan kuota kelas...';
    });

    try {
      await Future.delayed(const Duration(milliseconds: 400));
      final result = await widget.apiClient.validateExamCode(
        nim: widget.appState.nim,
        studentName: widget.appState.studentName,
        classCode: widget.appState.classCode,
        examCode: widget.appState.examCode,
      );

      setState(() {
        _statusText = 'Sesi ujian berhasil diinisialisasi.';
        widget.appState.sessionResult = result;
      });

      await Future.delayed(const Duration(milliseconds: 300));
      widget.onValidationSuccess();
    } catch (error) {
      setState(() {
        _isLoading = false;
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
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Container(
              padding: const EdgeInsets.all(32.0),
              decoration: BoxDecoration(
                color: AppConstants.slateSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppConstants.slateBorder),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: _isLoading
                        ? const SizedBox(
                            width: 52,
                            height: 52,
                            child: CircularProgressIndicator(
                              strokeWidth: 3.5,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                AppConstants.coralAccent,
                              ),
                            ),
                          )
                        : Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: Colors.redAccent.withValues(alpha: 0.12),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.redAccent.withValues(alpha: 0.3),
                                width: 1.5,
                              ),
                            ),
                            child: const Icon(
                              Icons.error_outline,
                              size: 32,
                              color: Colors.redAccent,
                            ),
                          ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    _isLoading ? 'Validasi Sesi Ujian' : 'Validasi Gagal',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppConstants.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _errorMessage ?? _statusText,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: _errorMessage != null
                          ? Colors.redAccent.shade100
                          : AppConstants.textMuted,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 28),
                  if (!_isLoading) ...[
                    ElevatedButton(
                      onPressed: _startValidation,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppConstants.coralAccent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: const Text('Coba Lagi'),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: widget.onBackToWelcome,
                      child: const Text(
                        'Kembali ke Form Login',
                        style: TextStyle(color: AppConstants.textMuted),
                      ),
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
}
