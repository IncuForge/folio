// types/schema.ts - Shared Database Models and API Type Safety Contracts

export interface Item {
  id: string;
  name: string;
  type: string;
  ingredients: string;
  style: string;
  image: string;
  notes: string;
  price: number;
  is_available: boolean;
  is_deleted?: boolean;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  price?: number | null;
  is_deleted?: boolean;
  items?: Item[];
}

export interface OrderItem {
  item_id: string;
  quantity: number;
  item_notes: string;
  name: string;
  type: string;
  ingredients: string;
  style: string;
  image?: string;
  is_available?: boolean;
  price: number;
}

export interface AdditionalCharge {
  label: string;
  amount: number;
}

export interface OrderSession {
  id?: string;
  name: string;
  session_date: string;
  session_time?: string;
  guest_count: number;
  package_id?: string | null;
  package_price?: number;
  notes?: string;
  items: Array<{ itemId: string; name?: string; type?: string; price?: number; quantity: number; notes?: string }>;
}

export interface Order {
  id: string;
  client_name: string;
  client_phone: string;
  event_name: string;
  event_date: string;
  event_end_date?: string | null;
  event_time: string;
  venue: string;
  guest_count: number;
  notes: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  additional_charges: AdditionalCharge[];
  booking_paid: boolean;
  booking_amount: number;
  booking_payment_notes?: string;
  second_paid: boolean;
  second_amount: number;
  second_payment_notes?: string;
  final_paid: boolean;
  final_amount: number;
  final_payment_notes?: string;
  package_id?: string | null;
  package_price?: number;
  packages_selected?: Array<{ packageId: string; quantity: number; price: number }>;
  sessions?: OrderSession[];
  created_at: string;
  items?: OrderItem[];
  discount_percent?: number;
}

// API Create / Update Request Payloads

export interface CreateItemRequest {
  name: string;
  type: string;
  ingredients?: string;
  style?: string;
  image?: string;
  notes?: string;
  price?: number;
}

export interface UpdateItemRequest extends Partial<CreateItemRequest> {
  is_available?: boolean;
}

export interface CreatePackageRequest {
  name: string;
  description?: string;
  price?: number | null;
  itemIds?: string[];
}

export interface CreateOrderRequest {
  client_name: string;
  client_phone?: string;
  event_name: string;
  event_date: string;
  event_end_date?: string | null;
  event_time?: string;
  venue?: string;
  guest_count?: number;
  notes?: string;
  status?: string;
  additional_charges?: AdditionalCharge[];
  booking_paid?: boolean;
  booking_amount?: number;
  booking_payment_notes?: string;
  second_paid?: boolean;
  second_amount?: number;
  second_payment_notes?: string;
  final_paid?: boolean;
  final_amount?: number;
  final_payment_notes?: string;
  package_id?: string | null;
  package_price?: number;
  packages_selected?: Array<{ packageId: string; quantity: number; price: number }>;
  sessions?: OrderSession[];
  items?: Array<{ itemId: string; quantity: number; notes?: string }>;
}

export interface UpdateOrderRequest extends Partial<CreateOrderRequest> {}
