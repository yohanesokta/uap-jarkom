import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/network/exam_api_client.dart';
import '../../core/process/packet_tracer_process_manager.dart';
import '../models/exam_app_state.dart';

class ActiveExamScreen extends StatefulWidget {
  final ExamAppState appState;
  final ExamApiClient apiClient;
  final PacketTracerProcessManager processManager;
  final VoidCallback onExamFinished;

  const ActiveExamScreen({
    super.key,
    required this.appState,
    required this.apiClient,
    required this.processManager,
    required this.onExamFinished,
  });

  @override
  State<ActiveExamScreen> createState() => _ActiveExamScreenState();
}

class _ActiveExamScreenState extends State<ActiveExamScreen> {
  Timer? _countdownTimer;
  Timer? _heartbeatTimer;
  late int _remainingSeconds;
  String _processStatusText = 'Menjalankan proses Packet Tracer...';
  int? _processId;
  StreamSubscription<ProcessStatusUpdate>? _processSubscription;

  @override
  void initState() {
    super.initState();
    final durationMinutes = widget.appState.sessionResult?.durationMinutes ?? 90;
    _remainingSeconds = durationMinutes * 60;

    _startCountdown();
    _startHeartbeat();
    _startProcessMonitoring();
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds > 0) {
        setState(() {
          _remainingSeconds--;
        });
      } else {
        timer.cancel();
      }
    });
  }

  void _startHeartbeat() {
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      final session = widget.appState.sessionResult;
      if (session != null) {
        widget.apiClient.sendHeartbeat(
          sessionId: session.sessionId,
          sessionToken: session.sessionToken,
        );
      }
    });
  }

  void _startProcessMonitoring() {
    _processSubscription = widget.processManager.statusStream.listen((status) {
      setState(() {
        if (status.processId != null) {
          _processId = status.processId;
          widget.appState.packetTracerProcessId = status.processId;
        }
        if (status.message != null) {
          _processStatusText = status.message!;
        }
      });
    });

    final executablePath = widget.appState.detectionResult?.executablePath;
    final pkaFile = widget.appState.localPlaintextPkaFile;

    if (executablePath != null && pkaFile != null) {
      widget.processManager.launchAndMonitor(
        executablePath: executablePath,
        pkaFilePath: pkaFile.path,
        onProcessTerminatedAndFileReady: (completedFile) {
          widget.appState.localPlaintextPkaFile = completedFile;
          widget.onExamFinished();
        },
        onProcessFailed: (errorMessage) {
          setState(() {
            _processStatusText = 'Galat: $errorMessage';
          });
        },
      );
    }
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _heartbeatTimer?.cancel();
    _processSubscription?.cancel();
    super.dispose();
  }

  String _formatRemainingTime(int totalSeconds) {
    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    final seconds = totalSeconds % 60;
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.appState.sessionResult;

    return Scaffold(
      backgroundColor: AppConstants.slateBackground,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32.0),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 580),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppConstants.slateSurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppConstants.slateBorder),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: const BoxDecoration(
                              color: AppConstants.greenSuccess,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Sesi Ujian Aktif',
                            style: TextStyle(
                              color: AppConstants.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          const Icon(Icons.timer_outlined, color: AppConstants.coralAccent, size: 18),
                          const SizedBox(width: 6),
                          Text(
                            _formatRemainingTime(_remainingSeconds),
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              color: AppConstants.coralAccent,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(28.0),
                  decoration: BoxDecoration(
                    color: AppConstants.slateSurface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppConstants.slateBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session?.examTitle ?? 'Ujian Jaringan Komputer',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppConstants.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppConstants.slateCard,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Mahasiswa', style: TextStyle(fontSize: 11, color: AppConstants.textMuted)),
                                  const SizedBox(height: 2),
                                  Text(
                                    widget.appState.studentName,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('NIM', style: TextStyle(fontSize: 11, color: AppConstants.textMuted)),
                                  const SizedBox(height: 2),
                                  Text(
                                    widget.appState.nim,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Kelas', style: TextStyle(fontSize: 11, color: AppConstants.textMuted)),
                                  const SizedBox(height: 2),
                                  Text(
                                    widget.appState.classCode,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(AppConstants.cyanStatus),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _processId != null ? 'Packet Tracer Berjalan (PID: $_processId)' : 'Memantau Proses',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppConstants.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _processStatusText,
                                  style: const TextStyle(fontSize: 12, color: AppConstants.textMuted),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppConstants.coralAccent.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppConstants.coralAccent.withValues(alpha: 0.2)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Row(
                              children: [
                                Icon(Icons.info_outline, color: AppConstants.coralAccent, size: 18),
                                SizedBox(width: 8),
                                Text(
                                  'Petunjuk Pengerjaan Ujian',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: AppConstants.coralAccent,
                                  ),
                                ),
                              ],
                            ),
                            SizedBox(height: 8),
                            Text(
                              '• Kerjakan konfigurasi jaringan pada jendela Cisco Packet Tracer yang telah terbuka.\n• Simpan pekerjaan Anda secara berkala dengan menekan Ctrl+S pada Packet Tracer.\n• Setelah selesai, tutup aplikasi Cisco Packet Tracer untuk memulai enkripsi dan pengumpulan otomatis.',
                              style: TextStyle(fontSize: 12, color: AppConstants.textPrimary, height: 1.5),
                            ),
                          ],
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
}
