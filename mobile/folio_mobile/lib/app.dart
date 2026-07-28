import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/folio_theme.dart';
import 'data/repositories/sync_repository.dart';
import 'ui/features/setup/setup_view.dart';
import 'ui/features/setup/setup_view_model.dart';

class FolioApp extends StatelessWidget {
  const FolioApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Folio',
    debugShowCheckedModeBanner: false,
    theme: FolioTheme.light,
    darkTheme: FolioTheme.dark,
    themeMode: ThemeMode.system,
    home: ChangeNotifierProvider(
      create: (_) => SetupViewModel(context.read<SyncRepository>())..load(),
      child: const SetupView(),
    ),
  );
}
