import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import '../constants/app_constants.dart';
import '../container/exam_container_codec.dart';

class LocalBackupSummary {
  final String filePath;
  final String fileName;
  final String examId;
  final String sessionId;
  final String studentNim;
  final DateTime timestamp;
  final int fileSizeBytes;
  final bool isCorrupted;

  const LocalBackupSummary({
    required this.filePath,
    required this.fileName,
    required this.examId,
    required this.sessionId,
    required this.studentNim,
    required this.timestamp,
    required this.fileSizeBytes,
    required this.isCorrupted,
  });
}

class ExamStorageManager {
  Future<Directory> getOrCreateSecureTemporaryWorkspace(String sessionId) async {
    final systemTemp = await getTemporaryDirectory();
    final workspacePath = p.join(systemTemp.path, '.exam_workspace_$sessionId');
    final workspaceDir = Directory(workspacePath);

    if (!await workspaceDir.exists()) {
      await workspaceDir.create(recursive: true);
      if (Platform.isLinux || Platform.isMacOS) {
        try {
          await Process.run('chmod', ['0700', workspacePath]);
        } catch (_) {}
      }
    }

    return workspaceDir;
  }

  Future<Directory> getOrCreateDedicatedBackupDirectory() async {
    final appSupportDir = await getApplicationSupportDirectory();
    final backupPath = p.join(appSupportDir.path, 'backups');
    final backupDir = Directory(backupPath);

    if (!await backupDir.exists()) {
      await backupDir.create(recursive: true);
    }

    return backupDir;
  }

  Future<File> saveEncryptedLocalBackup({
    required String examId,
    required String sessionId,
    required String studentNim,
    required List<int> containerBytes,
  }) async {
    final backupDir = await getOrCreateDedicatedBackupDirectory();
    final fileName = '${examId}_${studentNim}_$sessionId${AppConstants.backupFileExtension}';
    final filePath = p.join(backupDir.path, fileName);
    final backupFile = File(filePath);

    await backupFile.writeAsBytes(containerBytes, flush: true);
    return backupFile;
  }

  Future<List<LocalBackupSummary>> listAllEncryptedBackups() async {
    final backupDir = await getOrCreateDedicatedBackupDirectory();
    final entries = await backupDir.list().toList();
    final backups = <LocalBackupSummary>[];

    for (final entry in entries) {
      if (entry is File && entry.path.endsWith(AppConstants.backupFileExtension)) {
        final length = await entry.length();
        try {
          final bytes = await entry.readAsBytes();
          final parsed = ExamContainerCodec.decode(bytes);
          final meta = parsed.header.authenticatedMetadata;

          backups.add(
            LocalBackupSummary(
              filePath: entry.path,
              fileName: p.basename(entry.path),
              examId: meta.examId,
              sessionId: meta.sessionId ?? 'unknown',
              studentNim: meta.studentNim ?? 'unknown',
              timestamp: DateTime.fromMillisecondsSinceEpoch(meta.timestamp),
              fileSizeBytes: length,
              isCorrupted: false,
            ),
          );
        } catch (_) {
          backups.add(
            LocalBackupSummary(
              filePath: entry.path,
              fileName: p.basename(entry.path),
              examId: 'corrupted',
              sessionId: 'corrupted',
              studentNim: 'corrupted',
              timestamp: await entry.lastModified(),
              fileSizeBytes: length,
              isCorrupted: true,
            ),
          );
        }
      }
    }

    backups.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return backups;
  }

  Future<void> safelyDeleteTemporaryWorkspace(String sessionId) async {
    final systemTemp = await getTemporaryDirectory();
    final workspacePath = p.join(systemTemp.path, '.exam_workspace_$sessionId');
    final workspaceDir = Directory(workspacePath);

    if (await workspaceDir.exists()) {
      try {
        await workspaceDir.delete(recursive: true);
      } catch (_) {}
    }
  }

  Future<void> safelyDeletePlaintextFile(File file) async {
    if (await file.exists()) {
      try {
        await file.delete();
      } catch (_) {}
    }
  }
}
