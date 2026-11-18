import 'dart:io';

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
    '/opt/pt/bin/PacketTracer',
    '/usr/local/bin/packettracer',
    '/usr/bin/packettracer',
    '/usr/bin/PacketTracer',
    '/opt/cisco/packettracer/bin/PacketTracer',
  ];

  static const List<String> standardWindowsRelativePaths = [
    r'Cisco Packet Tracer 8.2.2\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 8.2.1\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 8.2.0\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 8.1.1\bin\PacketTracer.exe',
    r'Cisco Packet Tracer 8.0\bin\PacketTracer.exe',
    r'Cisco Packet Tracer\bin\PacketTracer.exe',
  ];

  static const List<String> standardMacPaths = [
    '/Applications/Cisco Packet Tracer.app/Contents/MacOS/PacketTracer',
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
          detectedVersion: 'Cisco Packet Tracer (Linux native)',
        );
      }
    }

    try {
      final whichResult = await Process.run('which', ['packettracer']);
      if (whichResult.exitCode == 0 && whichResult.stdout.toString().trim().isNotEmpty) {
        final path = whichResult.stdout.toString().trim();
        return PacketTracerDetectionResult(
          isInstalled: true,
          executablePath: path,
          detectedVersion: 'Cisco Packet Tracer ($path)',
        );
      }
    } catch (_) {}

    try {
      final whichCapitalResult = await Process.run('which', ['PacketTracer']);
      if (whichCapitalResult.exitCode == 0 && whichCapitalResult.stdout.toString().trim().isNotEmpty) {
        final path = whichCapitalResult.stdout.toString().trim();
        return PacketTracerDetectionResult(
          isInstalled: true,
          executablePath: path,
          detectedVersion: 'Cisco Packet Tracer ($path)',
        );
      }
    } catch (_) {}

    return const PacketTracerDetectionResult(
      isInstalled: false,
      diagnosticMessage: 'Cisco Packet Tracer tidak ditemukan di jalur standar Linux (/opt/pt/bin/PacketTracer atau /usr/bin/packettracer)',
    );
  }

  Future<PacketTracerDetectionResult> _detectWindows() async {
    final programFiles = Platform.environment['ProgramFiles'] ?? r'C:\Program Files';
    final programFilesX86 = Platform.environment['ProgramFiles(x86)'] ?? r'C:\Program Files (x86)';

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

    return const PacketTracerDetectionResult(
      isInstalled: false,
      diagnosticMessage: r'Cisco Packet Tracer tidak ditemukan di C:\Program Files\Cisco Packet Tracer',
    );
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

    return const PacketTracerDetectionResult(
      isInstalled: false,
      diagnosticMessage: 'Cisco Packet Tracer tidak ditemukan di folder /Applications',
    );
  }
}
