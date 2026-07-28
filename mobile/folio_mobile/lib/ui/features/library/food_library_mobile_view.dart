import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../../domain/models/folio_workspace.dart';
import '../workspace/workspace_view_model.dart';
import '../../widgets/folio_states.dart';

class FoodLibraryMobileView extends StatelessWidget {
  const FoodLibraryMobileView({super.key});

  @override
  Widget build(BuildContext context) => Consumer<WorkspaceViewModel>(
    builder: (context, vm, _) => Scaffold(
      appBar: AppBar(title: const Text('Food library')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(context, vm),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add dish'),
      ),
      body: vm.items.isEmpty
          ? FolioEmptyState(
              icon: Icons.restaurant_outlined,
              title: 'Your library is empty',
              message: 'Add reusable dishes, prices and ingredient notes.',
              actionLabel: 'Add dish',
              onAction: () => _edit(context, vm),
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              itemCount: vm.items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = vm.items[index];
                return Card(
                  child: InkWell(
                    onTap: () => _edit(context, vm, item),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: Theme.of(
                                context,
                              ).colorScheme.primaryContainer,
                              borderRadius: BorderRadius.circular(7),
                            ),
                            child: const Icon(Icons.restaurant_menu_rounded),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.name,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium,
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '${item.type} · ${item.ingredients.isEmpty ? 'No ingredient notes' : item.ingredients}',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                NumberFormat.simpleCurrency(
                                  name: vm.currencyCode,
                                  decimalDigits: item.price % 1 == 0 ? 0 : 2,
                                ).format(item.price),
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 5),
                              Icon(
                                item.available
                                    ? Icons.check_circle_outline_rounded
                                    : Icons.block_rounded,
                                size: 18,
                                color: item.available
                                    ? Theme.of(context).colorScheme.primary
                                    : Theme.of(context).colorScheme.error,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    ),
  );

  Future<void> _edit(
    BuildContext context,
    WorkspaceViewModel vm, [
    FolioItem? existing,
  ]) async {
    final name = TextEditingController(text: existing?.name);
    final type = TextEditingController(text: existing?.type ?? 'Main');
    final ingredients = TextEditingController(text: existing?.ingredients);
    final price = TextEditingController(text: existing?.price.toString());
    final key = GlobalKey<FormState>();
    var available = existing?.available ?? true;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            8,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 24,
          ),
          child: Form(
            key: key,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    existing == null ? 'Add dish' : 'Edit dish',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Dish name'),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter a dish name.'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: type,
                    decoration: const InputDecoration(labelText: 'Category'),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter a category.'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: ingredients,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'Ingredients'),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: price,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(labelText: 'Price'),
                  ),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Available this season'),
                    value: available,
                    onChanged: (value) =>
                        setSheetState(() => available = value),
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: () async {
                      if (!key.currentState!.validate()) return;
                      await vm.addItem(
                        FolioItem(
                          id:
                              existing?.id ??
                              'item-${DateTime.now().microsecondsSinceEpoch}',
                          name: name.text.trim(),
                          type: type.text.trim(),
                          ingredients: ingredients.text.trim(),
                          price: double.tryParse(price.text) ?? 0,
                          available: available,
                        ),
                      );
                      if (sheetContext.mounted) Navigator.pop(sheetContext);
                    },
                    child: const Text('Save dish'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    name.dispose();
    type.dispose();
    ingredients.dispose();
    price.dispose();
  }
}
