import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../workspace/workspace_view_model.dart';

class ReportsMobileView extends StatelessWidget {
  const ReportsMobileView({super.key});
  @override
  Widget build(BuildContext context) => Consumer<WorkspaceViewModel>(
    builder: (context, vm, _) {
      final completed = vm.orders
          .where((o) => o.status.toLowerCase() == 'completed')
          .length;
      final upcoming = vm.upcoming.length;
      return Scaffold(
        appBar: AppBar(title: const Text('Reports')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Operational overview',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'A concise view of the workspace currently stored on this phone.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 24),
            _ReportRow(label: 'Total orders', value: '${vm.orders.length}'),
            _ReportRow(label: 'Upcoming events', value: '$upcoming'),
            _ReportRow(label: 'Completed events', value: '$completed'),
            _ReportRow(label: 'Customers', value: '${vm.contacts.length}'),
            _ReportRow(label: 'Library dishes', value: '${vm.items.length}'),
            const SizedBox(height: 24),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.insights_outlined,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Detailed billing analytics remain authoritative on Folio Desktop. Mobile reports intentionally prioritize quick operational counts.',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    },
  );
}

class _ReportRow extends StatelessWidget {
  const _ReportRow({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 18),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(label, style: Theme.of(context).textTheme.titleMedium),
        ),
        Text(value, style: Theme.of(context).textTheme.headlineMedium),
      ],
    ),
  );
}
