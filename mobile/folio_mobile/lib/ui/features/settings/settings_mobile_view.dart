import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../workspace/workspace_view_model.dart';

class SettingsMobileView extends StatefulWidget {
  const SettingsMobileView({super.key});
  @override
  State<SettingsMobileView> createState() => _SettingsMobileViewState();
}

class _SettingsMobileViewState extends State<SettingsMobileView> {
  late final TextEditingController business;
  @override
  void initState() {
    super.initState();
    business = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      business.text =
          context.read<WorkspaceViewModel>().settings['pdfBrandName'] ??
          'Folio';
    });
  }

  @override
  void dispose() {
    business.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Consumer<WorkspaceViewModel>(
    builder: (context, vm, _) => Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text('Workspace', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: Icon(_syncIcon(vm.syncPhase)),
                  title: Text(_syncTitle(vm.syncPhase)),
                  subtitle: Text(
                    vm.message ?? 'Your workspace is available offline.',
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: vm.syncPhase == SyncPhase.syncing
                          ? null
                          : vm.syncNow,
                      icon: const Icon(Icons.sync_rounded),
                      label: const Text('Sync now'),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (vm.syncPhase == SyncPhase.conflict) ...[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Choose the workspace to keep',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Both copies remain untouched until you decide.',
                    ),
                    const SizedBox(height: 14),
                    FilledButton(
                      onPressed: vm.resolveWithPhone,
                      child: const Text('Keep phone changes'),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: vm.resolveWithDesktop,
                      child: const Text('Use desktop copy'),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 28),
          Text(
            'Receipt identity',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: business,
            decoration: const InputDecoration(
              labelText: 'Business or owner name',
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () =>
                vm.saveSetting('pdfBrandName', business.text.trim()),
            child: const Text('Save receipt identity'),
          ),
          const SizedBox(height: 32),
          Text('Local data', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () => _confirmClear(context, vm),
            icon: const Icon(Icons.delete_outline_rounded),
            label: const Text('Delete data from this phone'),
          ),
        ],
      ),
    ),
  );
  IconData _syncIcon(SyncPhase value) => switch (value) {
    SyncPhase.idle => Icons.cloud_done_outlined,
    SyncPhase.syncing => Icons.sync_rounded,
    SyncPhase.offline => Icons.cloud_off_outlined,
    SyncPhase.conflict => Icons.warning_amber_rounded,
    SyncPhase.local => Icons.smartphone_outlined,
  };
  String _syncTitle(SyncPhase value) => switch (value) {
    SyncPhase.idle => 'Connected to desktop',
    SyncPhase.syncing => 'Synchronizing',
    SyncPhase.offline => 'Working offline',
    SyncPhase.conflict => 'Review sync conflict',
    SyncPhase.local => 'Phone-only workspace',
  };
  Future<void> _confirmClear(
    BuildContext context,
    WorkspaceViewModel vm,
  ) async {
    final accepted =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Delete local Folio data?'),
            content: const Text(
              'This removes the workspace and pairing credentials from this phone. Desktop data is not deleted.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Delete from phone'),
              ),
            ],
          ),
        ) ??
        false;
    if (!accepted) return;
    await vm.clearLocalData();
    if (context.mounted) {
      await SystemNavigator.pop();
    }
  }
}
