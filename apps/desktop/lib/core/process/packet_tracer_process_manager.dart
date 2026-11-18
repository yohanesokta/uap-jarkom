import 'dart:async';
import 'dart:io';

enum PacketTracerRunningState {
  idle,
  launching,
  running,
  settlingFile,
  terminated,
  failed
}

class ProcessStatusUpdate {
  final PacketTracerRunningState state;
  final int? processId;
  final int? exitCode;
  final String? message;

  const ProcessStatusUpdate({
    required this.state,
    this.processId,
    this.exitCode,
    this.message,
  });
}

class PacketTracerProcessManager {
  Process? _activeProcess;
  final StreamController<ProcessStatusUpdate> _statusStreamController =
      StreamController<ProcessStatusUpdate>.broadcast();

  Stream<ProcessStatusUpdate> get statusStream => _statusStreamController.stream;

  Future<void> launchAndMonitor({
    required String executablePath,
    required String pkaFilePath,
    required Function(File completedFile) onProcessTerminatedAndFileReady,
    required Function(String errorMessage) onProcessFailed,
  }) async {
    _statusStreamController.add(
      const ProcessStatusUpdate(
        state: PacketTracerRunningState.launching,
        message: 'Meluncurkan Cisco Packet Tracer...',
      ),
    );

    try {
      _activeProcess = await Process.start(
        executablePath,
        [pkaFilePath],
        mode: ProcessStartMode.normal,
      );

      final pid = _activeProcess!.pid;
      _statusStreamController.add(
        ProcessStatusUpdate(
          state: PacketTracerRunningState.running,
          processId: pid,
          message: 'Cisco Packet Tracer aktif berjalan (PID: $pid)',
        ),
      );

      final exitCode = await _activeProcess!.exitCode;
      _activeProcess = null;

      _statusStreamController.add(
        ProcessStatusUpdate(
          state: PacketTracerRunningState.settlingFile,
          exitCode: exitCode,
          message: 'Packet Tracer ditutup. Menunggu finalisasi penulisan berkas jawaban...',
        ),
      );

      final file = File(pkaFilePath);
      final isSettled = await _waitForFileSettling(file);

      if (!isSettled || !await file.exists()) {
        _statusStreamController.add(
          const ProcessStatusUpdate(
            state: PacketTracerRunningState.failed,
            message: 'Berkas jawaban tidak ditemukan atau gagal ditulis oleh Packet Tracer.',
          ),
        );
        onProcessFailed('Berkas jawaban tidak ditemukan atau gagal ditulis.');
        return;
      }

      _statusStreamController.add(
        ProcessStatusUpdate(
          state: PacketTracerRunningState.terminated,
          exitCode: exitCode,
          message: 'Berkas jawaban berhasil diverifikasi dan siap dienkripsi.',
        ),
      );

      onProcessTerminatedAndFileReady(file);
    } catch (error) {
      _statusStreamController.add(
        ProcessStatusUpdate(
          state: PacketTracerRunningState.failed,
          message: 'Gagal menjalankan proses Packet Tracer: $error',
        ),
      );
      onProcessFailed(error.toString());
    }
  }

  Future<bool> _waitForFileSettling(File file) async {
    await Future.delayed(const Duration(milliseconds: 500));

    int retryCount = 0;
    int lastSize = -1;

    while (retryCount < 20) {
      if (await file.exists()) {
        final currentSize = await file.length();
        if (currentSize > 0 && currentSize == lastSize) {
          try {
            final randomAccessFile = await file.open(mode: FileMode.read);
            await randomAccessFile.close();
            return true;
          } catch (_) {}
        }
        lastSize = currentSize;
      }
      await Future.delayed(const Duration(milliseconds: 250));
      retryCount++;
    }

    return await file.exists() && (await file.length()) > 0;
  }

  void dispose() {
    _statusStreamController.close();
  }
}
