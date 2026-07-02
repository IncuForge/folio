// tests/api.test.ts - Automated API Endpoints & Route Handlers Test Suite
// Run using: node --import tsx --test tests/api.test.ts

import test from "node:test";
process.env.NODE_ENV = "test";
// Set a known SESSION_SECRET before any imports so auth.ts uses it
process.env.SESSION_SECRET = "test_session_secret_for_unit_tests_only_32ch";

import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

// Initialize isolated test database for API testing
const TEST_DB_PATH = path.join(process.cwd(), "data", "catering_api_test.db");
if (fs.existsSync(TEST_DB_PATH)) {
  try {
    fs.unlinkSync(TEST_DB_PATH);
  } catch (e) {}
}

const testDb = new DatabaseSync(TEST_DB_PATH);
testDb.exec("PRAGMA journal_mode = WAL;");
testDb.exec("PRAGMA busy_timeout = 5000;");

// Set global.db singleton before importing routes so they connect to our mock database
(global as any).db = testDb;

// ── Mock next/headers so cookies() works outside a real request context ──────
// next/headers cannot be called outside a real Next.js request scope.
// We patch the live module export before route handlers are imported.
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);

// A mutable ref to hold the signed session cookie once generated
let _mockSessionCookie = "";

function patchNextHeaders() {
  try {
    const nextHeaders = _require("next/headers");
    (nextHeaders as any).cookies = async () => ({
      get: (name: string) =>
        name === "folio_session" ? { value: _mockSessionCookie } : undefined,
    });
  } catch {
    // If next/headers can't be loaded, tests will fail with a clear error
  }
}

// Lazy route loader variables
let routesLoaded = false;
let getItems: any, postItem: any, patchItem: any, deleteItem: any, patchAvailability: any;
let getPackages: any, postPackage: any, putPackage: any, deletePackage: any;
let getOrders: any, postOrder: any, patchOrder: any, deleteOrder: any;
let cloneOrder: any;
let exportCSV: any, exportJSON: any, exportBackup: any;
let getSettings: any, postSettings: any;

async function loadRoutes() {
  if (routesLoaded) return;

  // 1. Sign a fresh admin session token using the test SESSION_SECRET
  const { signSession } = await import("../lib/auth");
  _mockSessionCookie = await signSession({
    id: "test-admin-id",
    email: "test@cater.com",
    role: "admin",
    ts: Date.now(),
  });

  // 2. Patch next/headers BEFORE importing any route modules
  patchNextHeaders();

  const { initDb } = await import("../lib/db");
  initDb();

  getItems = (await import("../app/api/items/route")).GET;
  postItem = (await import("../app/api/items/route")).POST;
  patchItem = (await import("../app/api/items/[id]/route")).PATCH;
  deleteItem = (await import("../app/api/items/[id]/route")).DELETE;
  patchAvailability = (await import("../app/api/items/[id]/availability/route")).PATCH;

  getPackages = (await import("../app/api/packages/route")).GET;
  postPackage = (await import("../app/api/packages/route")).POST;
  putPackage = (await import("../app/api/packages/[id]/route")).PUT;
  deletePackage = (await import("../app/api/packages/[id]/route")).DELETE;

  getOrders = (await import("../app/api/orders/route")).GET;
  postOrder = (await import("../app/api/orders/route")).POST;
  patchOrder = (await import("../app/api/orders/[id]/route")).PATCH;
  deleteOrder = (await import("../app/api/orders/[id]/route")).DELETE;

  cloneOrder = (await import("../app/api/orders/[id]/clone/route")).POST;

  exportCSV = (await import("../app/api/export/csv/route")).GET;
  exportJSON = (await import("../app/api/export/json/route")).GET;
  exportBackup = (await import("../app/api/export/backup/route")).GET;

  getSettings = (await import("../app/api/settings/route")).GET;
  postSettings = (await import("../app/api/settings/route")).POST;

  routesLoaded = true;
}

test("API: Items CRUD & Availability Toggle", async () => {
  await loadRoutes();

  // 1. GET all items
  const resGet = await getItems();
  assert.strictEqual(resGet.status, 200);
  const itemsList = await resGet.json();
  assert.ok(Array.isArray(itemsList));
  assert.ok(itemsList.length > 0); // Should have seed items

  // 2. POST create a new item
  const newItemData = {
    name: "Test Kabab",
    type: "Appetizer",
    ingredients: "50g paneer, spices",
    style: "Buffet",
    notes: "Hot and spicy"
  };
  const reqPost = new Request("http://localhost/api/items", {
    method: "POST",
    body: JSON.stringify(newItemData),
    headers: { "Content-Type": "application/json" }
  });
  const resPost = await postItem(reqPost);
  assert.strictEqual(resPost.status, 201);
  const createdItem = await resPost.json();
  assert.ok(createdItem.id);
  assert.strictEqual(createdItem.name, "Test Kabab");
  assert.ok(createdItem.is_available);

  // 3. POST validate bad request (missing type)
  const badItemData = { name: "Bad Kabab" };
  const reqBadPost = new Request("http://localhost/api/items", {
    method: "POST",
    body: JSON.stringify(badItemData),
    headers: { "Content-Type": "application/json" }
  });
  const resBadPost = await postItem(reqBadPost);
  assert.strictEqual(resBadPost.status, 400);

  // 4. PATCH update item details
  const patchData = { name: "Super Test Kabab", style: "Live Counter" };
  const reqPatch = new Request(`http://localhost/api/items/${createdItem.id}`, {
    method: "PATCH",
    body: JSON.stringify(patchData),
    headers: { "Content-Type": "application/json" }
  });
  const resPatch = await patchItem(reqPatch, { params: Promise.resolve({ id: createdItem.id }) });
  assert.strictEqual(resPatch.status, 200);
  const updatedItem = await resPatch.json();
  assert.strictEqual(updatedItem.name, "Super Test Kabab");
  assert.strictEqual(updatedItem.style, "Live Counter");

  // 5. PATCH toggle availability status
  const availabilityData = { is_available: false };
  const reqAvail = new Request(`http://localhost/api/items/${createdItem.id}/availability`, {
    method: "PATCH",
    body: JSON.stringify(availabilityData),
    headers: { "Content-Type": "application/json" }
  });
  const resAvail = await patchAvailability(reqAvail, { params: Promise.resolve({ id: createdItem.id }) });
  assert.strictEqual(resAvail.status, 200);
  const updatedAvailItem = await resAvail.json();
  assert.ok(!updatedAvailItem.is_available);

  // 6. DELETE soft-delete item
  const reqDel = new Request(`http://localhost/api/items/${createdItem.id}`, {
    method: "DELETE"
  });
  const resDel = await deleteItem(reqDel, { params: Promise.resolve({ id: createdItem.id }) });
  assert.strictEqual(resDel.status, 200);
  const delResponse = await resDel.json();
  assert.strictEqual(delResponse.success, true);

  // Check it is marked is_deleted = 1
  const dbCheck = testDb.prepare("SELECT is_deleted FROM items WHERE id = ?").get(createdItem.id) as any;
  assert.strictEqual(dbCheck.is_deleted, 1);
});

test("API: Packages CRUD", async () => {
  await loadRoutes();

  // 1. GET all packages
  const resGet = await getPackages();
  assert.strictEqual(resGet.status, 200);
  const pkgsList = await resGet.json();
  assert.ok(Array.isArray(pkgsList));
  assert.ok(pkgsList.length > 0); // seed packages

  // Find a seed item id
  const itemsResult = testDb.prepare("SELECT id FROM items WHERE is_deleted = 0 LIMIT 1").get() as any;
  const itemId = itemsResult.id;

  // 2. POST create package template
  const newPkgData = {
    name: "Test Combo Pack",
    description: "Great value pack",
    itemIds: [itemId]
  };
  const reqPost = new Request("http://localhost/api/packages", {
    method: "POST",
    body: JSON.stringify(newPkgData),
    headers: { "Content-Type": "application/json" }
  });
  const resPost = await postPackage(reqPost);
  assert.strictEqual(resPost.status, 201);
  const createdPkg = await resPost.json();
  assert.ok(createdPkg.id);
  assert.strictEqual(createdPkg.name, "Test Combo Pack");
  assert.ok(createdPkg.items.length > 0);
  assert.strictEqual(createdPkg.items[0].id, itemId);

  // 2b. PUT update package template
  const updatedPkgData = {
    name: "Updated Test Combo Pack",
    description: "Updated value pack description",
    price: 399.99,
    itemIds: [itemId]
  };
  const reqPut = new Request(`http://localhost/api/packages/${createdPkg.id}`, {
    method: "PUT",
    body: JSON.stringify(updatedPkgData),
    headers: { "Content-Type": "application/json" }
  });
  const resPut = await putPackage(reqPut, { params: Promise.resolve({ id: createdPkg.id }) });
  assert.strictEqual(resPut.status, 200);
  const updatedPkgResult = await resPut.json();
  assert.strictEqual(updatedPkgResult.name, "Updated Test Combo Pack");
  assert.strictEqual(updatedPkgResult.description, "Updated value pack description");
  assert.strictEqual(updatedPkgResult.price, 399.99);

  // 3. DELETE package template
  const reqDel = new Request(`http://localhost/api/packages/${createdPkg.id}`, {
    method: "DELETE"
  });
  const resDel = await deletePackage(reqDel, { params: Promise.resolve({ id: createdPkg.id }) });
  assert.strictEqual(resDel.status, 200);
  const delResponse = await resDel.json();
  assert.strictEqual(delResponse.success, true);

  // Check database soft delete
  const dbCheck = testDb.prepare("SELECT is_deleted FROM packages WHERE id = ?").get(createdPkg.id) as any;
  assert.strictEqual(dbCheck.is_deleted, 1);
});

test("API: Orders Lifecycle, Cancellation Guard & Cloning", async () => {
  await loadRoutes();

  // 1. GET all orders
  const resGet = await getOrders();
  assert.strictEqual(resGet.status, 200);
  const ordersList = await resGet.json();
  assert.ok(Array.isArray(ordersList));

  // Find a seed item id
  const itemsResult = testDb.prepare("SELECT id FROM items WHERE is_deleted = 0 LIMIT 1").get() as any;
  const itemId = itemsResult.id;

  // 2. POST Create standard future order (10 days out)
  const dateFuture = new Date();
  dateFuture.setDate(dateFuture.getDate() + 10);
  const dateFutureStr = dateFuture.toISOString().split("T")[0];

  const futureOrderData = {
    client_name: "Bruce Wayne",
    client_phone: "555-0199",
    event_name: "Charity Banquet",
    event_date: dateFutureStr,
    event_time: "19:00",
    venue: "Wayne Manor",
    guest_count: 200,
    notes: "Elegant setup required",
    status: "pending",
    additional_charges: [
      { label: "Butler Fee", amount: 5000 }
    ],
    booking_paid: true,
    booking_amount: 10000,
    second_paid: false,
    second_amount: 15000,
    final_paid: false,
    final_amount: 20000,
    items: [
      { itemId: itemId, quantity: 200, notes: "No onions" }
    ]
  };

  const reqPostFuture = new Request("http://localhost/api/orders", {
    method: "POST",
    body: JSON.stringify(futureOrderData),
    headers: { "Content-Type": "application/json" }
  });
  const resPostFuture = await postOrder(reqPostFuture);
  assert.strictEqual(resPostFuture.status, 201);
  const createdFutureOrder = await resPostFuture.json();
  assert.ok(createdFutureOrder.id);
  assert.strictEqual(createdFutureOrder.client_name, "Bruce Wayne");
  assert.ok(createdFutureOrder.booking_paid);
  assert.strictEqual(createdFutureOrder.additional_charges.length, 1);
  assert.strictEqual(createdFutureOrder.items.length, 1);
  assert.strictEqual(createdFutureOrder.items[0].quantity, 200);

  // 3. POST Create order scheduled for tomorrow (1 day out) for testing cancellation lock
  const dateTomorrow = new Date();
  dateTomorrow.setDate(dateTomorrow.getDate() + 1);
  const dateTomorrowStr = dateTomorrow.toISOString().split("T")[0];

  const tomorrowOrderData = {
    client_name: "Clark Kent",
    event_name: "Daily Planet Lunch",
    event_date: dateTomorrowStr,
    guest_count: 30,
    booking_paid: true,
    booking_amount: 3000
  };

  const reqPostTomorrow = new Request("http://localhost/api/orders", {
    method: "POST",
    body: JSON.stringify(tomorrowOrderData),
    headers: { "Content-Type": "application/json" }
  });
  const resPostTomorrow = await postOrder(reqPostTomorrow);
  assert.strictEqual(resPostTomorrow.status, 201);
  const createdTomorrowOrder = await resPostTomorrow.json();

  // 4. PATCH Update future order
  const patchOrderData = {
    client_name: "Bruce Wayne Sr.",
    venue: "Batcave Reception",
    second_paid: true,
    items: [
      { itemId: itemId, quantity: 250, notes: "Extra crispy" }
    ]
  };
  const reqPatchOrder = new Request(`http://localhost/api/orders/${createdFutureOrder.id}`, {
    method: "PATCH",
    body: JSON.stringify(patchOrderData),
    headers: { "Content-Type": "application/json" }
  });
  const resPatchOrder = await patchOrder(reqPatchOrder, { params: Promise.resolve({ id: createdFutureOrder.id }) });
  assert.strictEqual(resPatchOrder.status, 200);
  const updatedOrder = await resPatchOrder.json();
  assert.strictEqual(updatedOrder.client_name, "Bruce Wayne Sr.");
  assert.strictEqual(updatedOrder.venue, "Batcave Reception");
  assert.ok(updatedOrder.second_paid);
  assert.strictEqual(updatedOrder.items.length, 1);
  assert.strictEqual(updatedOrder.items[0].quantity, 250);

  // 5. POST Clone order: resets payment, copies info, appends " (Copy)" to client name
  const reqClone = new Request(`http://localhost/api/orders/${createdFutureOrder.id}/clone`, {
    method: "POST"
  });
  const resClone = await cloneOrder(reqClone, { params: Promise.resolve({ id: createdFutureOrder.id }) });
  assert.strictEqual(resClone.status, 201);
  const clonedOrder = await resClone.json();
  assert.ok(clonedOrder.id);
  assert.strictEqual(clonedOrder.client_name, "Bruce Wayne Sr. (Copy)");
  assert.strictEqual(clonedOrder.status, "pending");
  assert.ok(!clonedOrder.booking_paid); // Reset payments
  assert.ok(!clonedOrder.second_paid);
  assert.ok(!clonedOrder.final_paid);
  assert.strictEqual(clonedOrder.items.length, 1); // Copied item!
  assert.strictEqual(clonedOrder.items[0].quantity, 250);

  // 6. DELETE future order (scheduled 10 days out, past 3-day lock window)
  const reqDeleteFuture = new Request(`http://localhost/api/orders/${createdFutureOrder.id}`, {
    method: "DELETE"
  });
  const resDeleteFuture = await deleteOrder(reqDeleteFuture, { params: Promise.resolve({ id: createdFutureOrder.id }) });
  assert.strictEqual(resDeleteFuture.status, 200);
  const delFutureResponse = await resDeleteFuture.json();
  assert.strictEqual(delFutureResponse.success, true);

  // 7. DELETE tomorrow order without override (should fail with cancellation_lock)
  const reqDeleteTomorrowNoOverride = new Request(`http://localhost/api/orders/${createdTomorrowOrder.id}`, {
    method: "DELETE"
  });
  const resDeleteTomorrowNoOverride = await deleteOrder(reqDeleteTomorrowNoOverride, { params: Promise.resolve({ id: createdTomorrowOrder.id }) });
  assert.strictEqual(resDeleteTomorrowNoOverride.status, 400);
  const delTomorrowNoOverrideResponse = await resDeleteTomorrowNoOverride.json();
  assert.strictEqual(delTomorrowNoOverrideResponse.error, "cancellation_lock");

  // 8. DELETE tomorrow order with override (should succeed)
  const reqDeleteTomorrowOverride = new Request(`http://localhost/api/orders/${createdTomorrowOrder.id}?override=true`, {
    method: "DELETE"
  });
  const resDeleteTomorrowOverride = await deleteOrder(reqDeleteTomorrowOverride, { params: Promise.resolve({ id: createdTomorrowOrder.id }) });
  assert.strictEqual(resDeleteTomorrowOverride.status, 200);
  const delTomorrowOverrideResponse = await resDeleteTomorrowOverride.json();
  assert.strictEqual(delTomorrowOverrideResponse.success, true);
});

test("API: Multi-Format Exporters", async () => {
  await loadRoutes();

  // 1. GET export CSV
  const resCSV = await exportCSV();
  assert.strictEqual(resCSV.status, 200);
  assert.strictEqual(resCSV.headers.get("Content-Type"), "text/csv; charset=utf-8");
  const csvBuffer = await resCSV.arrayBuffer();
  const csvBytes = new Uint8Array(csvBuffer);
  // Verify UTF-8 BOM bytes: 0xEF, 0xBB, 0xBF
  assert.strictEqual(csvBytes[0], 0xEF);
  assert.strictEqual(csvBytes[1], 0xBB);
  assert.strictEqual(csvBytes[2], 0xBF);
  // Decode remaining bytes and verify headers
  const decodedText = new TextDecoder("utf-8").decode(csvBytes.slice(3));
  assert.ok(decodedText.includes("Order ID,Client Name,Client Phone"));

  // 2. GET export JSON
  const resJSON = await exportJSON();
  assert.strictEqual(resJSON.status, 200);
  assert.strictEqual(resJSON.headers.get("Content-Type"), "application/json");
  const jsonDump = await resJSON.json();
  assert.ok(jsonDump.exportedAt);
  assert.ok(Array.isArray(jsonDump.items));
  assert.ok(Array.isArray(jsonDump.orders));

  // 3. GET export Backup (.db binary)
  const resBackup = await exportBackup();
  assert.strictEqual(resBackup.status, 200);
  assert.strictEqual(resBackup.headers.get("Content-Type"), "application/octet-stream");
  const arrayBuffer = await resBackup.arrayBuffer();
  assert.ok(arrayBuffer.byteLength > 0);

});

test("API: Payment Milestone Structured Recording & Notifications", async () => {
  await loadRoutes();
  const testDb = (global as any).db;

  const orderId = "temp-milestone-order-id";
  // Insert a test order with billing amount and pending milestones
  testDb.prepare(`
    INSERT INTO orders (
      id, client_name, event_name, event_date, guest_count,
      booking_paid, booking_amount, booking_payment_notes,
      second_paid, second_amount, second_payment_notes,
      final_paid, final_amount, final_payment_notes, status
    ) VALUES (?, 'Bill Gates', 'Private Gala', '2026-06-25', 100, 0, 5000, '', 0, 5000, '', 0, 5000, '', 'confirmed')
  `).run(orderId);

  // 1. PATCH order milestone payment using JSON structured format
  const paymentPayload = {
    booking_paid: true,
    booking_payment_notes: JSON.stringify({
      date: "2026-06-29",
      mode: "UPI",
      comment: "Txn ID: 98127391823"
    })
  };

  const reqPatch = new Request(`http://localhost/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paymentPayload)
  });

  const resPatch = await patchOrder(reqPatch, { params: Promise.resolve({ id: orderId }) });
  assert.strictEqual(resPatch.status, 200);

  const updatedOrder = await resPatch.json();
  assert.strictEqual(updatedOrder.booking_paid, true);
  
  // Verify notes are stored as valid JSON
  const notesObj = JSON.parse(updatedOrder.booking_payment_notes);
  assert.strictEqual(notesObj.date, "2026-06-29");
  assert.strictEqual(notesObj.mode, "UPI");
  assert.strictEqual(notesObj.comment, "Txn ID: 98127391823");

  // 2. Clean up test order
  testDb.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
});

test("API: Settings GET & POST", async () => {
  await loadRoutes();

  // 1. GET settings
  const resGet = await getSettings();
  assert.strictEqual(resGet.status, 200);
  const dataGet = await resGet.json();
  assert.strictEqual(dataGet.pdfBrandName, "Cater Flow Premium Catering");
  assert.strictEqual(dataGet.currencySymbol, "₹");

  // 2. POST update settings
  const updatePayload = {
    pdfBrandName: "Super Caterers Ltd",
    currencySymbol: "$"
  };
  const reqPost = new Request("http://localhost/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatePayload)
  });
  const resPost = await postSettings(reqPost);
  assert.strictEqual(resPost.status, 200);
  const dataPost = await resPost.json();
  assert.strictEqual(dataPost.pdfBrandName, "Super Caterers Ltd");
  assert.strictEqual(dataPost.currencySymbol, "$");

  // Verify DB state persists (GET again)
  const resGet2 = await getSettings();
  assert.strictEqual(resGet2.status, 200);
  const dataGet2 = await resGet2.json();
  assert.strictEqual(dataGet2.pdfBrandName, "Super Caterers Ltd");
  assert.strictEqual(dataGet2.currencySymbol, "$");
});

test.after(() => {
  const testDb = (global as any).db;
  if (testDb) {
    try {
      testDb.close();
    } catch (e) {}
  }
  if (fs.existsSync(TEST_DB_PATH)) {
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch (e) {}
  }
});
