import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../domain/models/folio_workspace.dart';
import '../workspace/workspace_view_model.dart';
import '../../widgets/folio_states.dart';
import 'new_order_sheet.dart';

class OrdersView extends StatefulWidget {
  const OrdersView({super.key});
  @override
  State<OrdersView> createState() => _OrdersViewState();
}

class _OrdersViewState extends State<OrdersView> {
  final search = TextEditingController();
  int segment = 0;
  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Consumer<WorkspaceViewModel>(
    builder: (context, vm, _) {
      final threshold = DateTime.now().subtract(const Duration(days: 1));
      final query = search.text.toLowerCase();
      final orders = vm.orders.where((order) {
        final upcoming = !order.eventDate.isBefore(threshold);
        final inSegment = segment == 0 ? upcoming : !upcoming;
        return inSegment &&
            '${order.clientName} ${order.eventName} ${order.clientPhone}'
                .toLowerCase()
                .contains(query);
      }).toList();
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 120),
        children: [
          TextField(
            controller: search,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Search clients, events or phone',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: search.text.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () {
                        search.clear();
                        setState(() {});
                      },
                      icon: const Icon(Icons.close_rounded),
                      tooltip: 'Clear search',
                    ),
            ),
          ),
          const SizedBox(height: 16),
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 0, label: Text('Upcoming')),
              ButtonSegment(value: 1, label: Text('Past')),
            ],
            selected: {segment},
            onSelectionChanged: (value) =>
                setState(() => segment = value.first),
            showSelectedIcon: false,
          ),
          const SizedBox(height: 24),
          if (orders.isEmpty)
            FolioEmptyState(
              icon: Icons.receipt_long_outlined,
              title: query.isEmpty
                  ? 'No ${segment == 0 ? 'upcoming' : 'past'} orders'
                  : 'No matching orders',
              message: query.isEmpty
                  ? 'Create an order here or sync bookings from Folio Desktop.'
                  : 'Try another client, event or phone number.',
              actionLabel: query.isEmpty ? 'New order' : null,
              onAction: query.isEmpty
                  ? () => showNewOrderSheet(context, vm.addOrder)
                  : null,
            )
          else
            for (final order in orders) _OrderCard(order: order),
        ],
      );
    },
  );
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final FolioOrder order;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: const Icon(Icons.receipt_long_outlined),
      title: Text(order.eventName),
      subtitle: Text(
        '${order.clientName} · ${MaterialLocalizations.of(context).formatMediumDate(order.eventDate)}',
      ),
      trailing: Chip(label: Text(order.status)),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Divider(),
              Text(
                '${order.guestCount} guests${order.venue.isEmpty ? '' : ' · ${order.venue}'}',
              ),
              if (order.clientPhone.isNotEmpty) ...[
                const SizedBox(height: 6),
                SelectableText(order.clientPhone),
              ],
              if (order.notes.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(order.notes),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}
