import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../calendar/calendar_view.dart';
import '../customers/customers_view.dart';
import '../kitchen/kitchen_view.dart';
import '../library/food_library_mobile_view.dart';
import '../orders/new_order_sheet.dart';
import '../orders/orders_view.dart';
import '../reports/reports_mobile_view.dart';
import '../settings/settings_mobile_view.dart';
import '../today/today_view.dart';
import '../workspace/workspace_view_model.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int index = 0;
  static const labels = ['Today', 'Orders', 'Calendar', 'Kitchen'];
  static const pages = [
    TodayView(),
    OrdersView(),
    CalendarView(),
    KitchenView(),
  ];
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<WorkspaceViewModel>().load(),
    );
  }

  Future<void> open(Widget page) async {
    Navigator.pop(context);
    await Navigator.push(context, MaterialPageRoute(builder: (_) => page));
  }

  void more() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('More', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.people_outline_rounded),
              title: const Text('Customers'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => open(const CustomersView()),
            ),
            ListTile(
              leading: const Icon(Icons.restaurant_outlined),
              title: const Text('Food library'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => open(const FoodLibraryMobileView()),
            ),
            ListTile(
              leading: const Icon(Icons.insights_outlined),
              title: const Text('Reports'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => open(const ReportsMobileView()),
            ),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Settings'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => open(const SettingsMobileView()),
            ),
            const Divider(),
            Consumer<WorkspaceViewModel>(
              builder: (context, vm, _) => ListTile(
                leading: Icon(
                  vm.syncPhase == SyncPhase.idle
                      ? Icons.cloud_done_outlined
                      : Icons.sync_rounded,
                ),
                title: const Text('Sync now'),
                subtitle: Text(vm.message ?? 'Refresh the desktop workspace'),
                onTap: () async {
                  Navigator.pop(context);
                  await vm.syncNow();
                  if (mounted) {
                    ScaffoldMessenger.of(this.context).showSnackBar(
                      SnackBar(content: Text(vm.message ?? 'Sync finished.')),
                    );
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: index == 0,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop && index != 0) setState(() => index = 0);
    },
    child: Scaffold(
      appBar: AppBar(
        title: AnimatedSwitcher(
          duration: Duration(
            milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 180,
          ),
          child: Text(labels[index], key: ValueKey(index)),
        ),
        actions: [
          Consumer<WorkspaceViewModel>(
            builder: (context, vm, _) => IconButton(
              onPressed: vm.syncPhase == SyncPhase.syncing
                  ? null
                  : () async {
                      await vm.syncNow();
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(vm.message ?? 'Sync finished.'),
                          ),
                        );
                      }
                    },
              tooltip: 'Sync status: ${vm.syncPhase.name}',
              icon: Icon(
                vm.syncPhase == SyncPhase.idle
                    ? Icons.cloud_done_outlined
                    : vm.syncPhase == SyncPhase.conflict
                    ? Icons.warning_amber_rounded
                    : Icons.cloud_off_outlined,
              ),
            ),
          ),
          IconButton(
            onPressed: more,
            tooltip: 'More',
            icon: const Icon(Icons.more_vert_rounded),
          ),
        ],
      ),
      body: AnimatedSwitcher(
        duration: Duration(
          milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 220,
        ),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween(
              begin: const Offset(.025, 0),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        ),
        child: KeyedSubtree(key: ValueKey(index), child: pages[index]),
      ),
      floatingActionButton: index < 2
          ? Consumer<WorkspaceViewModel>(
              builder: (context, vm, _) => FloatingActionButton.extended(
                onPressed: () => showNewOrderSheet(context, vm.addOrder),
                icon: const Icon(Icons.add_rounded),
                label: const Text('New order'),
              ),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.today_outlined),
            selectedIcon: Icon(Icons.today_rounded),
            label: 'Today',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long_rounded),
            label: 'Orders',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month_rounded),
            label: 'Calendar',
          ),
          NavigationDestination(
            icon: Icon(Icons.restaurant_menu_outlined),
            selectedIcon: Icon(Icons.restaurant_menu_rounded),
            label: 'Kitchen',
          ),
        ],
      ),
    ),
  );
}
