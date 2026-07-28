import 'package:flutter/foundation.dart';
import '../../../data/repositories/workspace_repository.dart';
import '../../../domain/models/folio_workspace.dart';

enum WorkspaceLoadState { idle, loading, ready, error }

enum SyncPhase { local, idle, syncing, offline, conflict }

class WorkspaceViewModel extends ChangeNotifier {
  WorkspaceViewModel(this._repository);
  final WorkspaceRepository _repository;
  Map<String, dynamic> _snapshot = const {};
  WorkspaceLoadState loadState = WorkspaceLoadState.idle;
  SyncPhase syncPhase = SyncPhase.local;
  String? message;

  List<FolioOrder> get orders =>
      _snapshot.isEmpty ? const [] : _repository.orders(_snapshot);
  List<FolioContact> get contacts =>
      _snapshot.isEmpty ? const [] : _repository.contacts(_snapshot);
  List<FolioItem> get items =>
      _snapshot.isEmpty ? const [] : _repository.items(_snapshot);
  Map<String, String> get settings =>
      _snapshot.isEmpty ? const {} : _repository.settings(_snapshot);
  String get currencyCode => settings['currencyCode'] ?? 'INR';
  List<FolioOrder> get upcoming => orders
      .where(
        (order) => !order.eventDate.isBefore(
          DateTime.now().subtract(const Duration(days: 1)),
        ),
      )
      .toList();
  WorkspaceSummary get summary => WorkspaceSummary(
    upcoming: upcoming.length,
    overdue: orders
        .where(
          (order) =>
              order.status.toLowerCase().contains('pending') &&
              order.eventDate.isBefore(DateTime.now()),
        )
        .length,
    revenue: orders.fold(0, (total, _) => total),
  );

  Future<void> load() async {
    if (loadState == WorkspaceLoadState.loading) return;
    loadState = WorkspaceLoadState.loading;
    notifyListeners();
    try {
      _snapshot = await _repository.load();
      syncPhase = await _repository.mode() == 'paired'
          ? SyncPhase.idle
          : SyncPhase.local;
      loadState = WorkspaceLoadState.ready;
      message = null;
    } catch (error) {
      loadState = WorkspaceLoadState.error;
      message = 'The local workspace could not be opened.';
    }
    notifyListeners();
  }

  Future<void> addOrder(FolioOrder order) async {
    _snapshot = await _repository.addOrder(_snapshot, order);
    await _changed();
  }

  Future<void> addContact(FolioContact contact) async {
    _snapshot = await _repository.addContact(_snapshot, contact);
    await _changed();
  }

  Future<void> addItem(FolioItem item) async {
    _snapshot = await _repository.addItem(_snapshot, item);
    await _changed();
  }

  Future<void> saveSetting(String key, String value) async {
    _snapshot = await _repository.saveSetting(_snapshot, key, value);
    await _changed();
  }

  Future<void> _changed() async {
    if (syncPhase != SyncPhase.local) syncPhase = SyncPhase.offline;
    message = syncPhase == SyncPhase.local
        ? 'Saved on this phone.'
        : 'Saved offline. Sync when the desktop is reachable.';
    notifyListeners();
  }

  Future<void> syncNow() async {
    if (syncPhase == SyncPhase.syncing) return;
    syncPhase = SyncPhase.syncing;
    message = 'Synchronizing workspace…';
    notifyListeners();
    try {
      _snapshot = await _repository.syncNow(_snapshot);
      syncPhase = await _repository.mode() == 'paired'
          ? SyncPhase.idle
          : SyncPhase.local;
      message = syncPhase == SyncPhase.local
          ? 'This workspace stays on this phone.'
          : 'Workspace is up to date.';
    } on WorkspaceSyncConflict catch (error) {
      syncPhase = SyncPhase.conflict;
      message = error.message;
    } catch (_) {
      syncPhase = SyncPhase.offline;
      message = 'Desktop unavailable. Your changes remain safe on this phone.';
    }
    notifyListeners();
  }

  Future<void> resolveWithDesktop() async {
    syncPhase = SyncPhase.syncing;
    notifyListeners();
    try {
      _snapshot = await _repository.useDesktopCopy();
      syncPhase = SyncPhase.idle;
      message = 'Using the latest desktop workspace.';
    } catch (_) {
      syncPhase = SyncPhase.offline;
      message = 'The desktop is still unreachable.';
    }
    notifyListeners();
  }

  Future<void> resolveWithPhone() async {
    syncPhase = SyncPhase.syncing;
    notifyListeners();
    try {
      _snapshot = await _repository.keepPhoneCopy(_snapshot);
      syncPhase = SyncPhase.idle;
      message = 'Phone changes were applied to the desktop workspace.';
    } catch (_) {
      syncPhase = SyncPhase.conflict;
      message = 'The workspace changed again. Review and retry.';
    }
    notifyListeners();
  }

  Future<void> clearLocalData() => _repository.clear();
}
