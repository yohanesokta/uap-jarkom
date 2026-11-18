import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../models/exam_app_state.dart';

class WelcomeScreen extends StatefulWidget {
  final ExamAppState appState;
  final VoidCallback onContinue;
  final VoidCallback onOpenRecovery;

  const WelcomeScreen({
    super.key,
    required this.appState,
    required this.onContinue,
    required this.onOpenRecovery,
  });

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nimController;
  late final TextEditingController _nameController;
  late final TextEditingController _classController;
  late final TextEditingController _codeController;

  @override
  void initState() {
    super.initState();
    _nimController = TextEditingController(text: widget.appState.nim);
    _nameController = TextEditingController(text: widget.appState.studentName);
    _classController = TextEditingController(text: widget.appState.classCode);
    _codeController = TextEditingController(text: widget.appState.examCode);
  }

  @override
  void dispose() {
    _nimController.dispose();
    _nameController.dispose();
    _classController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _handleSubmit() {
    if (_formKey.currentState?.validate() ?? false) {
      widget.appState.nim = _nimController.text.trim();
      widget.appState.studentName = _nameController.text.trim();
      widget.appState.classCode = _classController.text.trim().toUpperCase();
      widget.appState.examCode = _codeController.text.trim().toUpperCase();
      widget.onContinue();
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
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppConstants.coralAccent.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppConstants.coralAccent.withValues(alpha: 0.3),
                        width: 1.5,
                      ),
                    ),
                    child: const Icon(
                      Icons.security,
                      size: 38,
                      color: AppConstants.coralAccent,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Packet Tracer Exam Client',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: AppConstants.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Sistem Ujian Praktikum Jaringan Komputer Terenkripsi',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: AppConstants.textMuted,
                  ),
                ),
                const SizedBox(height: 32),
                Container(
                  padding: const EdgeInsets.all(28.0),
                  decoration: BoxDecoration(
                    color: AppConstants.slateSurface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppConstants.slateBorder),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.25),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _buildInputField(
                          label: 'Nomor Induk Mahasiswa (NIM)',
                          controller: _nimController,
                          hint: 'Contoh: 210001001',
                          icon: Icons.badge_outlined,
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'NIM wajib diisi';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 18),
                        _buildInputField(
                          label: 'Nama Lengkap Mahasiswa',
                          controller: _nameController,
                          hint: 'Contoh: Ahmad Dani',
                          icon: Icons.person_outline,
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Nama lengkap wajib diisi';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 18),
                        _buildInputField(
                          label: 'Kode Kelas Perkuliahan',
                          controller: _classController,
                          hint: 'Contoh: TI-3A',
                          icon: Icons.school_outlined,
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Kelas wajib diisi';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 18),
                        _buildInputField(
                          label: 'Kode Ujian (Exam Code)',
                          controller: _codeController,
                          hint: 'Contoh: EXAM-NET-2026',
                          icon: Icons.key_outlined,
                          isUppercase: true,
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Kode ujian wajib diisi';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 28),
                        ElevatedButton(
                          onPressed: _handleSubmit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppConstants.coralAccent,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            elevation: 0,
                          ),
                          child: const Text(
                            'Validasi & Mulai Ujian',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Center(
                  child: TextButton.icon(
                    onPressed: widget.onOpenRecovery,
                    icon: const Icon(
                      Icons.restore,
                      size: 18,
                      color: AppConstants.textMuted,
                    ),
                    label: const Text(
                      'Buka Layar Pemulihan Cadangan Lokal',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppConstants.textMuted,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInputField({
    required String label,
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool isUppercase = false,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: AppConstants.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          validator: validator,
          textCapitalization:
              isUppercase ? TextCapitalization.characters : TextCapitalization.none,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 14),
            prefixIcon: Icon(icon, color: AppConstants.textMuted, size: 20),
            filled: true,
            fillColor: AppConstants.slateCard,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppConstants.slateBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppConstants.coralAccent, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Colors.redAccent),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Colors.redAccent, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
