import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../domain/models/folio_workspace.dart';
import '../workspace/workspace_view_model.dart';
import '../../widgets/folio_states.dart';

class CustomersView extends StatelessWidget {
  const CustomersView({super.key});
  @override
  Widget build(BuildContext context) => Consumer<WorkspaceViewModel>(
    builder: (context, vm, _) {
      final contacts = vm.contacts;
      return Scaffold(
        appBar: AppBar(title: const Text('Customers')),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => _edit(context, vm),
          icon: const Icon(Icons.person_add_alt_1_rounded),
          label: const Text('Add customer'),
        ),
        body: contacts.isEmpty
            ? FolioEmptyState(
                icon: Icons.people_outline_rounded,
                title: 'No customers yet',
                message:
                    'Store contact details so new orders are quicker to create.',
                actionLabel: 'Add customer',
                onAction: () => _edit(context, vm),
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                itemCount: contacts.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (_, index) {
                  final contact = contacts[index];
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 8,
                    ),
                    leading: CircleAvatar(
                      child: Text(
                        contact.name.isEmpty
                            ? '?'
                            : contact.name.characters.first.toUpperCase(),
                      ),
                    ),
                    title: Text(contact.name),
                    subtitle: Text(
                      [
                        contact.phone,
                        contact.email,
                      ].where((v) => v.isNotEmpty).join(' · '),
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => _edit(context, vm, contact),
                  );
                },
              ),
      );
    },
  );

  Future<void> _edit(
    BuildContext context,
    WorkspaceViewModel vm, [
    FolioContact? existing,
  ]) async {
    final name = TextEditingController(text: existing?.name);
    final phone = TextEditingController(text: existing?.phone);
    final email = TextEditingController(text: existing?.email);
    final notes = TextEditingController(text: existing?.notes);
    final key = GlobalKey<FormState>();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          8,
          20,
          MediaQuery.viewInsetsOf(sheetContext).bottom + 24,
        ),
        child: Form(
          key: key,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  existing == null ? 'Add customer' : 'Edit customer',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 18),
                TextFormField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Name'),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Enter a name.' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Phone'),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: notes,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Notes'),
                ),
                const SizedBox(height: 22),
                FilledButton(
                  onPressed: () async {
                    if (!key.currentState!.validate()) return;
                    await vm.addContact(
                      FolioContact(
                        id:
                            existing?.id ??
                            'contact-${DateTime.now().microsecondsSinceEpoch}',
                        name: name.text.trim(),
                        phone: phone.text.trim(),
                        email: email.text.trim().toLowerCase(),
                        notes: notes.text.trim(),
                      ),
                    );
                    if (sheetContext.mounted) Navigator.pop(sheetContext);
                  },
                  child: const Text('Save customer'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    name.dispose();
    phone.dispose();
    email.dispose();
    notes.dispose();
  }
}
