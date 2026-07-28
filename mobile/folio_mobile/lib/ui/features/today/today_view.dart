import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../workspace/workspace_view_model.dart';

class TodayView extends StatelessWidget {
  const TodayView({super.key});
  @override
  Widget build(BuildContext context) => Consumer<WorkspaceViewModel>(
    builder: (context, vm, _) {
      if (vm.loadState == WorkspaceLoadState.loading ||
          vm.loadState == WorkspaceLoadState.idle) {
        return const Center(child: CircularProgressIndicator());
      }
      if (vm.loadState == WorkspaceLoadState.error) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline_rounded, size: 38),
                const SizedBox(height: 12),
                Text(vm.message ?? 'Workspace unavailable.'),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: vm.load,
                  child: const Text('Try again'),
                ),
              ],
            ),
          ),
        );
      }
      final summary = vm.summary;
      final next = vm.upcoming.take(3).toList();
      return RefreshIndicator(
        onRefresh: vm.syncNow,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
          children: [
            Text(
              MaterialLocalizations.of(context).formatFullDate(DateTime.now()),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 4),
            Text(
              'Today in Folio',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(
                  context,
                ).colorScheme.primaryContainer.withValues(alpha: .45),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(
                    vm.syncPhase == SyncPhase.idle
                        ? Icons.cloud_done_outlined
                        : Icons.cloud_off_outlined,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          vm.syncPhase == SyncPhase.idle
                              ? 'Workspace connected'
                              : 'Offline-ready',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(
                          vm.message ??
                              'Changes are stored safely on this phone.',
                          style: Theme.of(context).textTheme.bodyMedium,
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
                Expanded(
                  child: _Metric(
                    value: '${summary.upcoming}',
                    label: 'Upcoming',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _Metric(
                    value: '${summary.overdue}',
                    label: 'Needs attention',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),
            Text('Next up', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            if (next.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(
                        Icons.event_available_outlined,
                        size: 34,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'No events scheduled',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 5),
                      Text(
                        'Create an order or pull to sync.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              )
            else
              for (final order in next)
                Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(14),
                    leading: const Icon(Icons.event_note_outlined),
                    title: Text(order.eventName),
                    subtitle: Text(
                      '${order.clientName} · ${MaterialLocalizations.of(context).formatMediumDate(order.eventDate)}',
                    ),
                    trailing: Text('${order.guestCount} guests'),
                  ),
                ),
          ],
        ),
      );
    },
  );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label});
  final String value, label;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 10),
          Text(value, style: Theme.of(context).textTheme.headlineLarge),
        ],
      ),
    ),
  );
}
