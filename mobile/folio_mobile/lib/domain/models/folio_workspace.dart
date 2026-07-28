class FolioOrder {
  const FolioOrder({
    required this.id,
    required this.clientName,
    required this.eventName,
    required this.eventDate,
    required this.status,
    this.clientPhone = '',
    this.eventTime = '',
    this.venue = '',
    this.guestCount = 0,
    this.notes = '',
  });

  final String id;
  final String clientName;
  final String clientPhone;
  final String eventName;
  final DateTime eventDate;
  final String eventTime;
  final String venue;
  final int guestCount;
  final String notes;
  final String status;

  factory FolioOrder.fromJson(Map<String, dynamic> value) => FolioOrder(
    id: '${value['id'] ?? ''}',
    clientName: '${value['client_name'] ?? ''}',
    clientPhone: '${value['client_phone'] ?? ''}',
    eventName: '${value['event_name'] ?? ''}',
    eventDate:
        DateTime.tryParse('${value['event_date'] ?? ''}') ?? DateTime.now(),
    eventTime: '${value['event_time'] ?? ''}',
    venue: '${value['venue'] ?? ''}',
    guestCount: (value['guest_count'] as num?)?.toInt() ?? 0,
    notes: '${value['notes'] ?? ''}',
    status: '${value['status'] ?? 'Pending'}',
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'client_name': clientName,
    'client_phone': clientPhone,
    'event_name': eventName,
    'event_date': eventDate.toIso8601String().split('T').first,
    'event_end_date': null,
    'event_time': eventTime,
    'venue': venue,
    'guest_count': guestCount,
    'notes': notes,
    'status': status,
    'additional_charges': '[]',
    'booking_paid': 0,
    'booking_amount': 0,
    'second_paid': 0,
    'second_amount': 0,
    'final_paid': 0,
    'final_amount': 0,
    'package_id': null,
    'package_price': 0,
    'packages_selected': '[]',
    'sessions': '[]',
    'discount_percent': 0,
    'is_deleted': 0,
  };
}

class FolioContact {
  const FolioContact({
    required this.id,
    required this.name,
    this.phone = '',
    this.email = '',
    this.notes = '',
  });
  final String id, name, phone, email, notes;
  factory FolioContact.fromJson(Map<String, dynamic> value) => FolioContact(
    id: '${value['id'] ?? ''}',
    name: '${value['name'] ?? ''}',
    phone: '${value['phone'] ?? ''}',
    email: '${value['email'] ?? ''}',
    notes: '${value['notes'] ?? ''}',
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'phone': phone,
    'email': email,
    'address': '',
    'preferences': '',
    'allergens': '[]',
    'notes': notes,
    'is_deleted': 0,
  };
}

class FolioItem {
  const FolioItem({
    required this.id,
    required this.name,
    required this.type,
    this.ingredients = '',
    this.price = 0,
    this.available = true,
  });
  final String id, name, type, ingredients;
  final double price;
  final bool available;
  factory FolioItem.fromJson(Map<String, dynamic> value) => FolioItem(
    id: '${value['id'] ?? ''}',
    name: '${value['name'] ?? ''}',
    type: '${value['type'] ?? 'Dish'}',
    ingredients: '${value['ingredients'] ?? ''}',
    price: (value['price'] as num?)?.toDouble() ?? 0,
    available: value['is_available'] == true || value['is_available'] == 1,
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'type': type,
    'ingredients': ingredients,
    'style': 'Buffet',
    'image': '',
    'notes': '',
    'price': price,
    'is_available': available ? 1 : 0,
    'is_deleted': 0,
  };
}

class WorkspaceSummary {
  const WorkspaceSummary({
    required this.upcoming,
    required this.overdue,
    required this.revenue,
  });
  final int upcoming, overdue;
  final double revenue;
}
