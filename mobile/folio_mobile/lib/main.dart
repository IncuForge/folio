import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'data/repositories/sync_repository.dart';
import 'data/repositories/workspace_repository.dart';
import 'data/services/local_database_service.dart';
import 'data/services/secure_store_service.dart';
import 'data/services/sync_api_service.dart';
import 'ui/features/workspace/workspace_view_model.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final database = LocalDatabaseService();
  await database.open();
  final api = SyncApiService();
  final secureStore = SecureStoreService();
  final syncRepository = SyncRepository(
    database: database,
    api: api,
    secureStore: secureStore,
  );
  final workspaceRepository = WorkspaceRepository(
    database: database,
    api: api,
    secureStore: secureStore,
  );
  runApp(
    MultiProvider(
      providers: [
        Provider.value(value: syncRepository),
        Provider.value(value: workspaceRepository),
        ChangeNotifierProvider(
          create: (_) => WorkspaceViewModel(workspaceRepository),
        ),
      ],
      child: const FolioApp(),
    ),
  );
}
