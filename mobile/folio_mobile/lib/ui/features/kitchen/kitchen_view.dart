import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../workspace/workspace_view_model.dart';
import '../../widgets/folio_states.dart';

class KitchenView extends StatefulWidget {
  const KitchenView({super.key});
  @override
  State<KitchenView> createState() => _KitchenViewState();
}

class _KitchenViewState extends State<KitchenView> {
  int range = 0;
  @override
  Widget build(BuildContext context) => Consumer<WorkspaceViewModel>(
    builder: (context, vm, _) {
      final today = DateTime.now();
      final end = range == 0
          ? DateTime(today.year, today.month, today.day, 23, 59)
          : today.add(const Duration(days: 7));
      final orders = vm.upcoming
          .where((order) => !order.eventDate.isAfter(end))
          .toList();
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 120),
        children: [
          const FolioStatusStrip(
            icon: Icons.offline_bolt_outlined,
            title: 'Kitchen mode works offline',
            message:
                'Upcoming service details remain available when the desktop is unreachable.',
          ),
          const SizedBox(height: 20),
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 0, label: Text('Today')),
              ButtonSegment(value: 1, label: Text('Next 7 days')),
            ],
            selected: {range},
            onSelectionChanged: (value) => setState(() => range = value.first),
            showSelectedIcon: false,
          ),
          const SizedBox(height: 24),
          if (orders.isEmpty)
            const FolioEmptyState(
              icon: Icons.restaurant_menu_outlined,
              title: 'No preparation due',
              message: 'Upcoming orders will be grouped here by service date.',
            )
          else
            for (final order in orders)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              order.eventName,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          Text(
                            MaterialLocalizations.of(
                              context,
                            ).formatMediumDate(order.eventDate),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('${order.clientName} · ${order.guestCount} guests'),
                      if (order.venue.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(order.venue),
                      ],
                      if (order.notes.isNotEmpty) ...[
                        const Divider(height: 24),
                        Text(order.notes),
                      ],
                    ],
                  ),
                ),
              ),
        ],
      );
    },
  );
}
