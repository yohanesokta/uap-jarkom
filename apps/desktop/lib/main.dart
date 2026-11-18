import 'package:flutter/material.dart';
import 'core/constants/app_constants.dart';
import 'core/crypto/crypto_service.dart';
import 'core/network/exam_api_client.dart';
import 'core/process/packet_tracer_detector.dart';
import 'core/process/packet_tracer_process_manager.dart';
import 'core/storage/exam_storage_manager.dart';
import 'features/models/exam_app_state.dart';
import 'features/screens/active_exam_screen.dart';
import 'features/screens/preparation_screen.dart';
import 'features/screens/recovery_screen.dart';
import 'features/screens/submission_screen.dart';
import 'features/screens/validation_screen.dart';
import 'features/screens/welcome_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PacketTracerExamApp());
}

enum AppNavigationStep {
  welcome,
  validation,
  preparation,
  active,
  submission,
  recovery
}

class PacketTracerExamApp extends StatefulWidget {
  const PacketTracerExamApp({super.key});

  @override
  State<PacketTracerExamApp> createState() => _PacketTracerExamAppState();
}

class _PacketTracerExamAppState extends State<PacketTracerExamApp> {
  final ExamAppState _appState = ExamAppState();
  final ExamApiClient _apiClient = ExamApiClient();
  final CryptoService _cryptoService = CryptoService();
  final ExamStorageManager _storageManager = ExamStorageManager();
  final PacketTracerDetector _detector = PacketTracerDetector();
  final PacketTracerProcessManager _processManager = PacketTracerProcessManager();

  AppNavigationStep _currentStep = AppNavigationStep.welcome;

  void _navigateTo(AppNavigationStep step) {
    setState(() {
      _currentStep = step;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Packet Tracer Exam Management System',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppConstants.slateBackground,
        primaryColor: AppConstants.coralAccent,
        colorScheme: const ColorScheme.dark(
          primary: AppConstants.coralAccent,
          surface: AppConstants.slateSurface,
        ),
        fontFamily: 'Inter',
      ),
      home: _buildCurrentScreen(),
    );
  }

  Widget _buildCurrentScreen() {
    switch (_currentStep) {
      case AppNavigationStep.welcome:
        return WelcomeScreen(
          appState: _appState,
          onContinue: () => _navigateTo(AppNavigationStep.validation),
          onOpenRecovery: () => _navigateTo(AppNavigationStep.recovery),
        );
      case AppNavigationStep.validation:
        return ValidationScreen(
          appState: _appState,
          apiClient: _apiClient,
          onValidationSuccess: () => _navigateTo(AppNavigationStep.preparation),
          onBackToWelcome: () => _navigateTo(AppNavigationStep.welcome),
        );
      case AppNavigationStep.preparation:
        return PreparationScreen(
          appState: _appState,
          apiClient: _apiClient,
          cryptoService: _cryptoService,
          storageManager: _storageManager,
          detector: _detector,
          onExamLaunched: () => _navigateTo(AppNavigationStep.active),
        );
      case AppNavigationStep.active:
        return ActiveExamScreen(
          appState: _appState,
          apiClient: _apiClient,
          processManager: _processManager,
          onExamFinished: () => _navigateTo(AppNavigationStep.submission),
        );
      case AppNavigationStep.submission:
        return SubmissionScreen(
          appState: _appState,
          apiClient: _apiClient,
          cryptoService: _cryptoService,
          storageManager: _storageManager,
          onFinishAndExit: () {
            _appState.reset();
            _navigateTo(AppNavigationStep.welcome);
          },
          onGoToRecovery: () => _navigateTo(AppNavigationStep.recovery),
        );
      case AppNavigationStep.recovery:
        return RecoveryScreen(
          storageManager: _storageManager,
          apiClient: _apiClient,
          onBackToWelcome: () => _navigateTo(AppNavigationStep.welcome),
        );
    }
  }
}
