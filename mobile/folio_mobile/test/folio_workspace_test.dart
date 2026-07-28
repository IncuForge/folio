import 'package:flutter_test/flutter_test.dart';
import 'package:folio_mobile/domain/models/folio_workspace.dart';

void main() {
  test('FolioOrder round-trips required mobile and desktop fields', () {
    final order = FolioOrder(
      id: 'order-1',
      clientName: 'Anika Rao',
      clientPhone: '+91 90000 00000',
      eventName: 'Wedding reception',
      eventDate: DateTime(2026, 8, 10),
      venue: 'Garden Hall',
      guestCount: 180,
      status: 'Pending',
    );
    final restored = FolioOrder.fromJson(order.toJson());
    expect(restored.id, order.id);
    expect(restored.clientName, order.clientName);
    expect(restored.eventDate, DateTime(2026, 8, 10));
    expect(restored.guestCount, 180);
  });

  test('FolioItem accepts SQLite integer availability flags', () {
    final item = FolioItem.fromJson({
      'id': 'dish-1',
      'name': 'Dosa',
      'type': 'Main',
      'price': 60,
      'is_available': 1,
    });
    expect(item.available, isTrue);
    expect(item.price, 60);
  });

  test('FolioContact preserves international text', () {
    final contact = FolioContact(
      id: 'contact-1',
      name: '李娜',
      notes: 'بدون مكسرات',
    );
    final restored = FolioContact.fromJson(contact.toJson());
    expect(restored.name, '李娜');
    expect(restored.notes, 'بدون مكسرات');
  });
}
