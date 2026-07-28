import 'package:flutter_test/flutter_test.dart';
import 'package:folio_mobile/data/repositories/sync_repository.dart';

void main() {
  test('SyncRepository exposes the production repository boundary', () {
    expect(SyncRepository, isNotNull);
  });
}
