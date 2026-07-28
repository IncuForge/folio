import 'dart:convert';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class LocalDatabaseService {
  Database? _db;
  Future<void> open() async {
    _db = await openDatabase(
      join(await getDatabasesPath(), 'folio_mobile.db'),
      version: 1,
      onCreate: (db, _) async {
        await db.execute(
          'CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
        );
        await db.execute(
          'CREATE TABLE snapshots (revision INTEGER PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL)',
        );
        await db.execute(
          'CREATE TABLE outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)',
        );
      },
    );
  }

  Database get db => _db!;
  Future<String?> meta(String key) async {
    final rows = await db.query(
      'app_meta',
      where: 'key = ?',
      whereArgs: [key],
      limit: 1,
    );
    return rows.isEmpty ? null : rows.first['value'] as String;
  }

  Future<void> setMeta(String key, String value) => db.insert('app_meta', {
    'key': key,
    'value': value,
  }, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<void> saveSnapshot(
    int revision,
    Map<String, dynamic> payload, {
    bool dirty = false,
  }) async {
    await db.transaction((txn) => _saveSnapshot(txn, revision, payload, dirty));
  }

  Future<void> saveLocalMutation({
    required int revision,
    required Map<String, dynamic> snapshot,
    required String entityType,
    required String entityId,
    required String operation,
    required Map<String, dynamic> payload,
    required String commitId,
  }) async {
    await db.transaction((txn) async {
      await _saveSnapshot(txn, revision, snapshot, true);
      await txn.insert('outbox', {
        'entity_type': entityType,
        'entity_id': entityId,
        'operation': operation,
        'payload': jsonEncode(payload),
        'created_at': DateTime.now().toUtc().toIso8601String(),
        'attempts': 0,
      });
      await txn.insert('app_meta', {
        'key': 'pending_commit_id',
        'value': commitId,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    });
  }

  Future<void> _saveSnapshot(
    DatabaseExecutor txn,
    int revision,
    Map<String, dynamic> payload,
    bool dirty,
  ) async {
    await txn.insert('snapshots', {
      'revision': revision,
      'payload': jsonEncode(payload),
      'created_at': DateTime.now().toUtc().toIso8601String(),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
    await txn.insert('app_meta', {
      'key': 'revision',
      'value': '$revision',
    }, conflictAlgorithm: ConflictAlgorithm.replace);
    await txn.insert('app_meta', {
      'key': 'dirty',
      'value': dirty ? 'true' : 'false',
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<Map<String, dynamic>?> latestSnapshot() async {
    final revision = int.tryParse(await meta('revision') ?? '');
    final rows = revision == null
        ? await db.query('snapshots', orderBy: 'created_at DESC', limit: 1)
        : await db.query(
            'snapshots',
            where: 'revision = ?',
            whereArgs: [revision],
            limit: 1,
          );
    return rows.isEmpty
        ? null
        : jsonDecode(rows.first['payload'] as String) as Map<String, dynamic>;
  }

  Future<int> revision() async =>
      int.tryParse(await meta('revision') ?? '0') ?? 0;
  Future<bool> isDirty() async => await meta('dirty') == 'true';
  Future<int> pendingCount() async =>
      Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM outbox')) ??
      0;

  Future<void> clearSyncQueue() async {
    await db.transaction((txn) async {
      await txn.delete('outbox');
      await txn.delete(
        'app_meta',
        where: 'key = ?',
        whereArgs: ['pending_commit_id'],
      );
      await txn.insert('app_meta', {
        'key': 'dirty',
        'value': 'false',
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    });
  }

  Future<void> clearWorkspace() async {
    await db.transaction((txn) async {
      await txn.delete('snapshots');
      await txn.delete('outbox');
      await txn.delete('app_meta');
    });
  }
}
