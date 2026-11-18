import 'dart:io';
import 'package:path/path.dart' as p;

class PacketTracerDetectionResult {
  final bool isInstalled;
  final String? executablePath;
  final String? detectedVersion;
  final String? diagnosticMessage;

  const PacketTracerDetectionResult({
    required this.isInstalled,
    this.executablePath,
    this.detectedVersion,
    this.diagnosticMessage,
  });
}

class PacketTracerDetector {
  static const List<String> standardLinuxPaths = [
    '/opt/pt/packettracer.AppImage',
    '/opt/pt/bin/PacketTracer',
    '/opt/pt/bin/packettracer',
    '/usr/local/bin/packettracer',
    '/usr/bin/packettracer',
    '/usr/bin/PacketTracer',
    '/opt/cisco/packettracer/bin/PacketTracer',
  ];

  static const List<String> standardWindowsRelativePaths = [
    r'Cisco Packet Tracer 9.0.1\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 9.0.0\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 9.0\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 8.2.2\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 8.2.1\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 8.2.0\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 8.1.1\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 8.0\bin\PacketTracer.exe',
    r'Cisco Packet Tracer\bin\PacketTracer.exe',
  ];

  static const List<String> standardMacPaths = [
    '/Applications/Cisco Packet Tracer.app/Contents/MacOS/PacketTracer',
    '/Applications/Cisco Packet Tracer 9.0.1/Cisco Packet Tracer.app/Contents/MacOS/PacketTracer',
    '/Applications/Cisco Packet Tracer 8.2.2/Cisco Packet Tracer.app/Contents/MacOS/PacketTracer',
    '/Applications/Cisco Packet Tracer 8.2.1/Cisco Packet Tracer.app/Contents/MacOS/PacketTracer',
  ];

  Future<PacketTracerDetectionResult> detect() async {
    if (Platform.isLinux) {
      return await _detectLinux();
    } else if (Platform.isWindows) {
      return await _detectWindows();
    } else if (Platform.isMacOS) {
      return await _detectMacOS();
    }

    return const PacketTracerDetectionResult(
      isInstalled: false,
      diagnosticMessage: 'Sistem operasi tidak didukung untuk Packet Tracer',
    );
  }

  Future<PacketTracerDetectionResult> _detectLinux() async {
    for (final candidatePath in standardLinuxPaths) {
      final file = File(candidatePath);
      if (await file.exists()) {
        return PacketTracerDetectionResult(
          isInstalled: true,
          executablePath: candidatePath,
          detectedVersion: 'Cisco Packet Tracer (Jalur Sistem: $candidatePath)',
        );
      }
    }

    final whichNames = ['packettracer', 'PacketTracer', 'cisco-packet-tracer'];
    for (final name in whichNames) {
      try {
        final whichResult = await Process.run('which', [name]);
        if (whichResult.exitCode == 0) {
          final path = whichResult.stdout.toString().trim();
          if (path.isNotEmpty && await File(path).exists()) {
            return PacketTracerDetectionResult(
              isInstalled: true,
              executablePath: path,
              detectedVersion: 'Cisco Packet Tracer ($path)',
            );
          }
        }
      } catch (_) {}
    }

    final mimeTypes = ['application/x-pka', 'application/x-pkt'];
    for (final mime in mimeTypes) {
      final desktopFileResult = await _queryLinuxDefaultDesktopFile(mime);
      if (desktopFileResult != null) {
        final executable = await _extractExecutableFromDesktopFile(
          desktopFileResult,
        );
        if (executable != null) {
          return PacketTracerDetectionResult(
            isInstalled: true,
            executablePath: executable,
            detectedVersion: 'Cisco Packet Tracer (MIME $mime: $executable)',
          );
        }
      }
    }

    final desktopFileFromScan = await _scanLinuxApplicationsForPacketTracer();
    if (desktopFileFromScan != null) {
      return PacketTracerDetectionResult(
        isInstalled: true,
        executablePath: desktopFileFromScan,
        detectedVersion:
            'Cisco Packet Tracer (Desktop Entry: $desktopFileFromScan)',
      );
    }

    return const PacketTracerDetectionResult(
      isInstalled: false,
      diagnosticMessage:
          'Cisco Packet Tracer tidak terdeteksi melalui jalur sistem maupun asosiasi berkas .pka/.pkt.',
    );
  }

  Future<String?> _queryLinuxDefaultDesktopFile(String mimeType) async {
    try {
      final xdgResult = await Process.run('xdg-mime', [
        'query',
        'default',
        mimeType,
      ]);
      if (xdgResult.exitCode == 0) {
        final desktopName = xdgResult.stdout.toString().trim();
        if (desktopName.isNotEmpty && desktopName.endsWith('.desktop')) {
          return desktopName;
        }
      }
    } catch (_) {}

    try {
      final gioResult = await Process.run('gio', ['mime', mimeType]);
      if (gioResult.exitCode == 0) {
        final output = gioResult.stdout.toString();
        final match = RegExp(
          r'([a-zA-Z0-9_\-\.]+\.desktop)',
        ).firstMatch(output);
        if (match != null) {
          return match.group(1);
        }
      }
    } catch (_) {}

    return null;
  }

  Future<String?> _extractExecutableFromDesktopFile(
    String desktopFileName,
  ) async {
    final searchDirectories = [
      p.join(
        Platform.environment['HOME'] ?? '',
        '.local',
        'share',
        'applications',
      ),
      '/usr/share/applications',
      '/usr/local/share/applications',
      '/var/lib/flatpak/exports/share/applications',
    ];

    for (final directoryPath in searchDirectories) {
      final candidateFile = File(p.join(directoryPath, desktopFileName));
      if (await candidateFile.exists()) {
        final executable = await _parseExecLineFromDesktopFile(candidateFile);
        if (executable != null) {
          return executable;
        }
      }
    }

    return null;
  }

  Future<String?> _parseExecLineFromDesktopFile(File desktopFile) async {
    try {
      final lines = await desktopFile.readAsLines();
      for (final line in lines) {
        final trimmed = line.trim();
        if (trimmed.startsWith('Exec=')) {
          final execCommand = trimmed.substring(5).trim();
          final commandTokens = execCommand.split(RegExp(r'\s+'));
          if (commandTokens.isNotEmpty) {
            String executableCandidate = commandTokens[0];
            if (executableCandidate.startsWith('"') &&
                executableCandidate.endsWith('"')) {
              executableCandidate = executableCandidate.substring(
                1,
                executableCandidate.length - 1,
              );
            }

            if (await File(executableCandidate).exists()) {
              return executableCandidate;
            }

            final whichResult = await Process.run('which', [
              executableCandidate,
            ]);
            if (whichResult.exitCode == 0) {
              final resolvedPath = whichResult.stdout.toString().trim();
              if (resolvedPath.isNotEmpty &&
                  await File(resolvedPath).exists()) {
                return resolvedPath;
              }
            }
          }
        }
      }
    } catch (_) {}
    return null;
  }

  Future<String?> _scanLinuxApplicationsForPacketTracer() async {
    final searchDirectories = [
      p.join(
        Platform.environment['HOME'] ?? '',
        '.local',
        'share',
        'applications',
      ),
      '/usr/share/applications',
      '/usr/local/share/applications',
    ];

    for (final dirPath in searchDirectories) {
      final dir = Directory(dirPath);
      if (await dir.exists()) {
        try {
          final entries = await dir.list().toList();
          for (final entry in entries) {
            if (entry is File && entry.path.endsWith('.desktop')) {
              final lowerPath = entry.path.toLowerCase();
              if (lowerPath.contains('packettracer') ||
                  lowerPath.contains('ciscopackettracer')) {
                final executable = await _parseExecLineFromDesktopFile(entry);
                if (executable != null) {
                  return executable;
                }
              }
            }
          }
        } catch (_) {}
      }
    }
    return null;
  }

  Future<PacketTracerDetectionResult> _detectWindows() async {
    final programFiles =
        Platform.environment['ProgramFiles'] ?? r'C:\Program Files';
    final programFilesX86 =
        Platform.environment['ProgramFiles(x86)'] ?? r'C:\Program Files (x86)';

    final searchBases = [programFiles, programFilesX86];

    for (final base in searchBases) {
      for (final relative in standardWindowsRelativePaths) {
        final candidatePath = '$base\\$relative';
        final file = File(candidatePath);
        if (await file.exists()) {
          return PacketTracerDetectionResult(
            isInstalled: true,
            executablePath: candidatePath,
            detectedVersion: 'Cisco Packet Tracer ($relative)',
          );
        }
      }
    }

    final extensions = ['.pka', '.pkt'];
    for (final ext in extensions) {
      try {
        final assocResult = await Process.run('cmd.exe', ['/c', 'assoc', ext]);
        if (assocResult.exitCode == 0) {
          final assocOutput = assocResult.stdout.toString().trim();
          if (assocOutput.contains('=')) {
            final progId = assocOutput.split('=')[1].trim();
            final ftypeResult = await Process.run('cmd.exe', [
              '/c',
              'ftype',
              progId,
            ]);
            if (ftypeResult.exitCode == 0) {
              final ftypeOutput = ftypeResult.stdout.toString().trim();
              final extracted = _extractExecutableFromWindowsCommandLine(
                ftypeOutput,
              );
              if (extracted != null && await File(extracted).exists()) {
                return PacketTracerDetectionResult(
                  isInstalled: true,
                  executablePath: extracted,
                  detectedVersion:
                      'Cisco Packet Tracer (Assoc $ext: $extracted)',
                );
              }
            }
          }
        }
      } catch (_) {}
    }

    try {
      final powershellCommand =
          r'(Get-ItemProperty -Path "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\PacketTracer.exe" -ErrorAction SilentlyContinue)."(default)"';
      final psResult = await Process.run('powershell.exe', [
        '-NoProfile',
        '-Command',
        powershellCommand,
      ]);
      if (psResult.exitCode == 0) {
        final psOutput = psResult.stdout.toString().trim();
        if (psOutput.isNotEmpty && await File(psOutput).exists()) {
          return PacketTracerDetectionResult(
            isInstalled: true,
            executablePath: psOutput,
            detectedVersion:
                'Cisco Packet Tracer (Registry App Paths: $psOutput)',
          );
        }
      }
    } catch (_) {}

    return const PacketTracerDetectionResult(
      isInstalled: false,
      diagnosticMessage:
          r'Cisco Packet Tracer tidak ditemukan di Program Files maupun asosiasi berkas .pka/.pkt.',
    );
  }

  String? _extractExecutableFromWindowsCommandLine(String commandLine) {
    if (commandLine.contains('=')) {
      commandLine = commandLine.substring(commandLine.indexOf('=') + 1).trim();
    }
    final quoteMatch = RegExp(r'^"([^"]+)"').firstMatch(commandLine);
    if (quoteMatch != null) {
      return quoteMatch.group(1);
    }
    final spaceTokens = commandLine.split(' ');
    if (spaceTokens.isNotEmpty) {
      return spaceTokens[0];
    }
    return null;
  }

  Future<PacketTracerDetectionResult> _detectMacOS() async {
    for (final candidatePath in standardMacPaths) {
      final file = File(candidatePath);
      if (await file.exists()) {
        return PacketTracerDetectionResult(
          isInstalled: true,
          executablePath: candidatePath,
          detectedVersion: 'Cisco Packet Tracer (macOS Bundle)',
        );
      }
    }

    try {
      final osaResult = await Process.run('osascript', [
        '-e',
        'set appPath to POSIX path of (path to application "Cisco Packet Tracer")',
      ]);
      if (osaResult.exitCode == 0) {
        final bundlePath = osaResult.stdout.toString().trim();
        if (bundlePath.isNotEmpty) {
          final binaryPath = p.join(
            bundlePath,
            'Contents',
            'MacOS',
            'PacketTracer',
          );
          if (await File(binaryPath).exists()) {
            return PacketTracerDetectionResult(
              isInstalled: true,
              executablePath: binaryPath,
              detectedVersion:
                  'Cisco Packet Tracer (macOS AppleScript: $binaryPath)',
            );
          }
        }
      }
    } catch (_) {}

    try {
      final mdResult = await Process.run('mdfind', [
        'kMDItemFSName == "PacketTracer" || kMDItemFSName == "Cisco Packet Tracer.app"',
      ]);
      if (mdResult.exitCode == 0) {
        final lines = mdResult.stdout.toString().split('\n');
        for (final line in lines) {
          final trimmed = line.trim();
          if (trimmed.endsWith('.app')) {
            final binaryPath = p.join(
              trimmed,
              'Contents',
              'MacOS',
              'PacketTracer',
            );
            if (await File(binaryPath).exists()) {
              return PacketTracerDetectionResult(
                isInstalled: true,
                executablePath: binaryPath,
                detectedVersion: 'Cisco Packet Tracer (Spotlight: $binaryPath)',
              );
            }
          }
        }
      }
    } catch (_) {}

    return const PacketTracerDetectionResult(
      isInstalled: false,
      diagnosticMessage:
          'Cisco Packet Tracer tidak ditemukan di folder /Applications maupun Spotlight.',
    );
  }
}
