import 'package:flutter/material.dart';
import '../../../../domain/models/folio_workspace.dart';

class NewOrderSheet extends StatefulWidget {
  const NewOrderSheet({super.key, required this.onSave});
  final Future<void> Function(FolioOrder order) onSave;
  @override
  State<NewOrderSheet> createState() => _NewOrderSheetState();
}

class _NewOrderSheetState extends State<NewOrderSheet> {
  final formKey = GlobalKey<FormState>();
  final client = TextEditingController();
  final phone = TextEditingController();
  final event = TextEditingController();
  final venue = TextEditingController();
  final guests = TextEditingController(text: '50');
  DateTime date = DateTime.now().add(const Duration(days: 1));
  bool saving = false;

  @override
  void dispose() {
    client.dispose();
    phone.dispose();
    event.dispose();
    venue.dispose();
    guests.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (!formKey.currentState!.validate() || saving) return;
    setState(() => saving = true);
    final id = 'order-${DateTime.now().microsecondsSinceEpoch}';
    await widget.onSave(
      FolioOrder(
        id: id,
        clientName: client.text.trim(),
        clientPhone: phone.text.trim(),
        eventName: event.text.trim(),
        eventDate: date,
        venue: venue.text.trim(),
        guestCount: int.tryParse(guests.text) ?? 0,
        status: 'Pending',
      ),
    );
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(
      left: 20,
      right: 20,
      top: 12,
      bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
    ),
    child: SafeArea(
      top: false,
      child: Form(
        key: formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Create order',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                    tooltip: 'Close',
                  ),
                ],
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: client,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Client name'),
                validator: (v) => v == null || v.trim().isEmpty
                    ? 'Enter the client name.'
                    : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Phone number'),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: event,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Event name'),
                validator: (v) => v == null || v.trim().isEmpty
                    ? 'Enter the event name.'
                    : null,
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: () async {
                  final selected = await showDatePicker(
                    context: context,
                    firstDate: DateTime.now().subtract(
                      const Duration(days: 365),
                    ),
                    lastDate: DateTime.now().add(const Duration(days: 3650)),
                    initialDate: date,
                  );
                  if (selected != null) setState(() => date = selected);
                },
                icon: const Icon(Icons.calendar_today_outlined),
                label: Text(
                  MaterialLocalizations.of(context).formatMediumDate(date),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: venue,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Venue'),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: guests,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Guest count'),
                validator: (v) => (int.tryParse(v ?? '') ?? 0) < 1
                    ? 'Enter at least one guest.'
                    : null,
              ),
              const SizedBox(height: 22),
              FilledButton.icon(
                onPressed: saving ? null : save,
                icon: saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_rounded),
                label: Text(saving ? 'Saving…' : 'Create order'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

Future<void> showNewOrderSheet(
  BuildContext context,
  Future<void> Function(FolioOrder order) onSave,
) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  showDragHandle: true,
  builder: (_) => NewOrderSheet(onSave: onSave),
);
