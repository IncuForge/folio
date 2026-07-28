import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../workspace/workspace_view_model.dart';
import '../../widgets/folio_states.dart';

class CalendarView extends StatefulWidget {
  const CalendarView({super.key});
  @override
  State<CalendarView> createState() => _CalendarViewState();
}

class _CalendarViewState extends State<CalendarView> {
  DateTime month = DateTime(DateTime.now().year, DateTime.now().month);
  @override
  Widget build(BuildContext context) => Consumer<WorkspaceViewModel>(
    builder: (context, vm, _) {
      final events = vm.orders
          .where(
            (o) =>
                o.eventDate.year == month.year &&
                o.eventDate.month == month.month,
          )
          .toList();
      final label = MaterialLocalizations.of(context).formatMonthYear(month);
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Row(
            children: [
              IconButton.outlined(
                onPressed: () => setState(
                  () => month = DateTime(month.year, month.month - 1),
                ),
                icon: const Icon(Icons.chevron_left_rounded),
                tooltip: 'Previous month',
              ),
              Expanded(
                child: AnimatedSwitcher(
                  duration: Duration(
                    milliseconds: MediaQuery.disableAnimationsOf(context)
                        ? 0
                        : 180,
                  ),
                  child: Text(
                    label,
                    key: ValueKey(month),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
              ),
              IconButton.outlined(
                onPressed: () => setState(
                  () => month = DateTime(month.year, month.month + 1),
                ),
                icon: const Icon(Icons.chevron_right_rounded),
                tooltip: 'Next month',
              ),
            ],
          ),
          const SizedBox(height: 20),
          const FolioStatusStrip(
            icon: Icons.view_agenda_outlined,
            title: 'Mobile agenda',
            message:
                'Events are ordered by date for fast scanning and comfortable text sizes.',
          ),
          const SizedBox(height: 20),
          if (events.isEmpty)
            const FolioEmptyState(
              icon: Icons.event_available_outlined,
              title: 'Nothing scheduled',
              message: 'Orders for this month will appear here in date order.',
            )
          else
            for (final order in events)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: Theme.of(context).dividerColor),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 58,
                      child: Column(
                        children: [
                          Text(
                            '${order.eventDate.day}',
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                          Text(
                            MaterialLocalizations.of(context)
                                .formatShortMonthDay(order.eventDate)
                                .split(' ')
                                .first,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            order.eventName,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${order.clientName} · ${order.guestCount} guests',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
        ],
      );
    },
  );
}
