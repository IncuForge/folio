// tests/db.test.ts - Automated SQLite Database & Business Logic Test Suite
// Run using: node --import tsx --test tests/db.test.ts

import test from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const TEST_DB_PATH = path.join(process.cwd(), "data", "catering_test.db");

// Helper to clean up and initialize test database
function setupTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new DatabaseSync(TEST_DB_PATH);
  
  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      ingredients TEXT,
      style TEXT,
      image TEXT,
      notes TEXT,
      is_available INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS package_items (
      package_id TEXT,
      item_id TEXT,
      PRIMARY KEY (package_id, item_id),
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      event_name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT,
      venue TEXT,
      guest_count INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      additional_charges TEXT DEFAULT '[]',
      booking_paid INTEGER DEFAULT 0,
      booking_amount REAL DEFAULT 0,
      booking_payment_notes TEXT DEFAULT '',
      second_paid INTEGER DEFAULT 0,
      second_amount REAL DEFAULT 0,
      second_payment_notes TEXT DEFAULT '',
      final_paid INTEGER DEFAULT 0,
      final_amount REAL DEFAULT 0,
      final_payment_notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      order_id TEXT,
      item_id TEXT,
      quantity INTEGER,
      notes TEXT,
      PRIMARY KEY (order_id, item_id),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );
  `);

  return db;
}

test("Folio Database - CRUD operations on Items", () => {
  const db = setupTestDb();
  const itemId = crypto.randomUUID();

  // Test Create
  db.prepare(`
    INSERT INTO items (id, name, type, ingredients, style, image, notes, is_available, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
  `).run(itemId, "Paneer Kadhai", "Main Course", "120g paneer, 30g capsicum", "Buffet", "", "Extra gravy");

  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId) as any;
  assert.strictEqual(item.name, "Paneer Kadhai");
  assert.strictEqual(item.type, "Main Course");
  assert.strictEqual(item.is_available, 1);
  assert.strictEqual(item.is_deleted, 0);

  // Test Update Availability (Seasonality Toggle)
  db.prepare("UPDATE items SET is_available = 0 WHERE id = ?").run(itemId);
  const updatedItem = db.prepare("SELECT is_available FROM items WHERE id = ?").get(itemId) as any;
  assert.strictEqual(updatedItem.is_available, 0);

  // Test Soft Delete
  db.prepare("UPDATE items SET is_deleted = 1 WHERE id = ?").run(itemId);
  const deletedItem = db.prepare("SELECT is_deleted FROM items WHERE id = ?").get(itemId) as any;
  assert.strictEqual(deletedItem.is_deleted, 1);
  
  db.close();
});

test("Folio Database - Package templates linkage", () => {
  const db = setupTestDb();
  
  const itemId1 = crypto.randomUUID();
  const itemId2 = crypto.randomUUID();
  const packageId = crypto.randomUUID();

  // Insert Items
  db.prepare("INSERT INTO items (id, name, type) VALUES (?, ?, ?), (?, ?, ?)").run(
    itemId1, "Samosa", "Appetizer",
    itemId2, "Jalebi", "Dessert"
  );

  // Insert Package template
  db.prepare("INSERT INTO packages (id, name, description) VALUES (?, ?, ?)")
    .run(packageId, "Mini Tea Combo", "Standard Samosa and Jalebi package");

  // Link items to package
  db.prepare("INSERT INTO package_items (package_id, item_id) VALUES (?, ?), (?, ?)")
    .run(packageId, itemId1, packageId, itemId2);

  // Query and check
  const links = db.prepare(`
    SELECT i.name 
    FROM items i
    JOIN package_items pi ON i.id = pi.item_id
    WHERE pi.package_id = ?
  `).all(packageId) as any[];

  assert.strictEqual(links.length, 2);
  const names = links.map(x => x.name);
  assert.ok(names.includes("Samosa"));
  assert.ok(names.includes("Jalebi"));

  db.close();
});

test("Folio Database - Order Placement and Cost Summing", () => {
  const db = setupTestDb();
  
  const orderId = crypto.randomUUID();
  const additionalCharges = JSON.stringify([
    { label: "Delivery", amount: 1500 },
    { label: "Waiters", amount: 2000 }
  ]);

  db.prepare(`
    INSERT INTO orders (
      id, client_name, event_name, event_date, guest_count, additional_charges,
      booking_paid, booking_amount, second_paid, second_amount, final_paid, final_amount
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 5000, 1, 10000, 0, 8000)
  `).run(orderId, "Alice Brown", "Birthday Party", "2026-07-20", 50, additionalCharges);

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
  assert.strictEqual(order.client_name, "Alice Brown");
  
  // Calculate total costs
  const charges = JSON.parse(order.additional_charges) as any[];
  const chargesSum = charges.reduce((s, c) => s + c.amount, 0);
  assert.strictEqual(chargesSum, 3500);

  const totalCost = order.booking_amount + order.second_amount + order.final_amount + chargesSum;
  assert.strictEqual(totalCost, 26500);

  const totalCollected = (order.booking_paid ? order.booking_amount : 0) + 
                         (order.second_paid ? order.second_amount : 0) + 
                         (order.final_paid ? order.final_amount : 0);
  assert.strictEqual(totalCollected, 15000);

  const outstanding = totalCost - totalCollected;
  assert.strictEqual(outstanding, 11500); // 8000 (final) + 3500 (additional charges outstanding)

  db.close();
});

test("Folio Database - Order Cloning business rules (Resetting payments)", () => {
  const db = setupTestDb();
  
  const orderId = crypto.randomUUID();
  const clonedOrderId = crypto.randomUUID();

  // Create referenced item first to satisfy foreign key constraints
  db.prepare("INSERT INTO items (id, name, type) VALUES (?, ?, ?)").run(
    "item-id-foo", "Sample Item", "Main Course"
  );

  // Create original order with paid milestones
  db.prepare(`
    INSERT INTO orders (
      id, client_name, event_name, event_date, guest_count,
      booking_paid, booking_amount, second_paid, second_amount, final_paid, final_amount, status
    ) VALUES (?, ?, ?, ?, ?, 1, 3000, 1, 5000, 1, 2000, 'completed')
  `).run(orderId, "Jack White", "Retirement Gala", "2026-06-15", 80);

  db.prepare("INSERT INTO order_items (order_id, item_id, quantity) VALUES (?, ?, ?)").run(
    orderId, "item-id-foo", 80
  );

  // Clone operation: resets payments, unsets checks, copies info, sets status to pending
  const original = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
  db.prepare(`
    INSERT INTO orders (
      id, client_name, event_name, event_date, guest_count, additional_charges,
      booking_paid, booking_amount, second_paid, second_amount, final_paid, final_amount, status
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 'pending')
  `).run(
    clonedOrderId,
    `${original.client_name} (Copy)`,
    original.event_name,
    original.event_date,
    original.guest_count,
    original.additional_charges
  );

  // Assert cloned states
  const cloned = db.prepare("SELECT * FROM orders WHERE id = ?").get(clonedOrderId) as any;
  assert.strictEqual(cloned.client_name, "Jack White (Copy)");
  assert.strictEqual(cloned.status, "pending");
  assert.strictEqual(cloned.booking_paid, 0);
  assert.strictEqual(cloned.booking_amount, 0);
  assert.strictEqual(cloned.second_paid, 0);
  assert.strictEqual(cloned.final_paid, 0);

  db.close();
});

test("Folio Database - Deletion Safety guard date threshold", () => {
  const db = setupTestDb();
  
  const orderIdSafe = crypto.randomUUID();
  const orderIdLocked = crypto.randomUUID();

  // Safe Order (Event date is in 10 days)
  const dateSafe = new Date();
  dateSafe.setDate(dateSafe.getDate() + 10);
  const dateSafeStr = dateSafe.toISOString().split("T")[0];

  // Locked Order (Event date is Tomorrow - in 1 day)
  const dateLocked = new Date();
  dateLocked.setDate(dateLocked.getDate() + 1);
  const dateLockedStr = dateLocked.toISOString().split("T")[0];

  db.prepare("INSERT INTO orders (id, client_name, event_name, event_date) VALUES (?, ?, ?, ?)")
    .run(orderIdSafe, "Safe Client", "Future Lunch", dateSafeStr);
  
  db.prepare("INSERT INTO orders (id, client_name, event_name, event_date) VALUES (?, ?, ?, ?)")
    .run(orderIdLocked, "Urgent Client", "Immediate Dinner", dateLockedStr);

  // Cancellation logic checker
  const checkCancellationWindow = (eventDateStr: string): boolean => {
    const eventDate = new Date(eventDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    eventDate.setHours(0,0,0,0);

    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Returns true if within 3 days threshold (lock warning applies)
    return diffDays >= 0 && diffDays <= 3;
  };

  assert.strictEqual(checkCancellationWindow(dateSafeStr), false); // No warning window
  assert.strictEqual(checkCancellationWindow(dateLockedStr), true);  // Within 3-day warning lock!

  db.close();
});

// Tear down test file after all checks run
test.after(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});
