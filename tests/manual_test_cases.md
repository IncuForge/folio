# Folio QA & Manual Test Cases Plan

This document details the step-by-step verification plan for Folio's business logic, user interface, and print layout exports.

---

## 📋 1. Core Workflow: Order Lifecycle & Payments

### Test Case 1.1: Placing a Standard Booking
- **Prerequisites**: Ensure the database is seeded with default dishes.
- **Steps**:
  1. Open Folio in the browser and navigate to the **Orders Book** tab.
  2. Click **Create Order** to open the order form.
  3. Fill in required metadata:
     - Client Name: `David Miller`
     - Phone: `9876543210`
     - Event Name: `Corporate luncheon`
     - Event Date: Set to 10 days in the future (e.g. `2026-07-01`)
     - Guest Count: `100`
  4. Select **Load Package Set** and choose **Sleek Party Pack**. Verify that the three pre-set items are loaded automatically.
  5. Check **1st Payment (Booking Deposit)**, set the amount to `₹5,000`, and check the "Paid" box.
  6. Click **Save Order**.
- **Expected Outcome**: The order appears at the top of the Orders list with "pending" status, and the payment status badge shows **"On Schedule"** (blue).

### Test Case 1.2: Order Cloning (Duplication)
- **Steps**:
  1. Find the order created in Test Case 1.1 ("David Miller - Corporate Luncheon").
  2. Click the **Clone** button next to it.
- **Expected Outcome**:
  - A new order card appears instantly.
  - Client Name is set to `David Miller (Copy)`.
  - Selected menu items, quantities, and general notes are duplicated exactly.
  - **Crucial**: The payment milestones are reset (unpaid/₹0), and the status is reset to "pending".

### Test Case 1.3: Milestone Payments Checklist
- **Steps**:
  1. Click **Edit** on a pending order.
  2. Tweak payment milestones:
     - Check **1st Payment** (Booking) as Paid.
     - Check **2nd Payment** (Midway) as Paid.
     - Leave **Final Payment** (Settlement) unchecked.
  3. Set a custom **Additional Charge**: Label `Transport`, Amount `₹1,500`.
  4. Save the order.
- **Expected Outcome**: The order billed total sum calculates: `(Booking + Midway + Transport)` as paid, and shows the remaining final payment amount as the **Pending Balance** on the dashboard and lists.

---

## 🛡️ 2. Business Guardrails: Deletions & Past Events

### Test Case 2.1: Cancellation Lock (3-Day Guard)
- **Steps**:
  1. Click **Create Order** and set the Event Date to **Tomorrow** (1 day in the future). Save it.
  2. Locate this new order in the Orders Book.
  3. Click **Delete**.
- **Expected Outcome**:
  - The system blocks the direct deletion.
  - A modal pop-up is shown: *"Warning: This event is scheduled for [Date] (in 1 days). Raw ingredients may have already been ordered or prepared. Are you sure you want to proceed?"*
  - Clicking **Go Back** cancels the action.
  - Clicking **Force Cancel/Delete** bypasses the lock and deletes the record.

### Test Case 2.2: Past Event Status Conversion
- **Steps**:
  1. Create an order with an Event Date set to **Yesterday** (in the past).
  2. Leave the final payment checkbox unchecked (outstanding balance). Save it.
- **Expected Outcome**:
  - On the Dashboard, this order appears under **"Overdue Payments"** (colored in red).
  - The payment timeline badge displays **"Past Event (Outstanding)"** (payment-overdue pulse warning).
  - The date indicator shows it as a past event.

---

## 🍕 3. Food Library & Seasonal Availability

### Test Case 3.1: Adding an Item and Setting Availability
- **Steps**:
  1. Go to the **Food Library** tab.
  2. Click **Add Food Item**. Fill in:
     - Name: `Strawberry Shrikhand`
     - Category: `Dessert`
     - Ingredients: `100g strained curd, 30g fresh strawberries, 15g sugar`
     - Style: `Plated`
  3. Save the item.
  4. Locate the card for `Strawberry Shrikhand` in the library list.
  5. Toggle the **In Season** switch to **"Out of Season"** (unavailable).
- **Expected Outcome**:
  - The card dims and displays an "Out of Season" badge.
  - Go to **Create Order** and click the **Add Individual Dish** dropdown. Verify that `Strawberry Shrikhand` is marked as `⚠️ (Out of Season)` in the selection list.
  - If selected, a prompt alerts the user that ingredients might not be in stock.

---

## 🍳 4. Exporters & Print Engines

### Test Case 4.1: Kitchen Prep Sheet Scaling
- **Steps**:
  1. Locate a confirmed order for 150 guests containing *Paneer Tikka* (ingredients configured as `100g paneer, 20g capsicum, 15g curd marinade`).
  2. Click **Kitchen Sheet** on the order card.
- **Expected Outcome**:
  - The Kitchen Sheet modal loads.
  - The raw ingredients list displays scaled values: `15 kg paneer`, `3 kg capsicum`, `2.25 kg curd marinade`.
  - The page prints on a clean background when clicking **Print Kitchen Sheet**.

### Test Case 4.2: Client Presentation Menu PDF
- **Steps**:
  1. Click **PDF Menu** on an order card.
  2. Cycle through the three visual templates: **Modern Minimalist**, **Royal Traditional**, and **Rustic Kitchen**.
- **Expected Outcome**:
  - The template preview updates its borders, alignments, and font sizes instantly.
  - Layout is centered and styled correctly for printing with no navigation links visible.

### Test Case 4.3: Excel/CSV Exporter
- **Steps**:
  1. Go to the **Settings** tab.
  2. Click **Export Bookings to CSV**.
- **Expected Outcome**:
  - A file named `catering_orders_report.csv` is downloaded.
  - Opening the file in Excel correctly aligns columns, handles numeric sums, and loads text without character encoding errors (via the UTF-8 BOM flag).
