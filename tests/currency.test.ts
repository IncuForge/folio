import assert from "node:assert/strict";
import test from "node:test";
import { formatCurrency, getCurrencyOptions, getCurrencySymbol, getDefaultPaymentMethods, resolveCurrencyCode } from "../lib/currencies";

test("legacy currency symbols migrate to ISO 4217 codes", () => {
  assert.equal(resolveCurrencyCode("₹"), "INR");
  assert.equal(resolveCurrencyCode("$"), "USD");
  assert.equal(resolveCurrencyCode("EUR"), "EUR");
});

test("currency catalog covers broad international usage", () => {
  const options = getCurrencyOptions("en");
  assert.ok(options.length >= 140);
  for (const code of ["INR", "USD", "EUR", "GBP", "AED", "JPY", "BRL", "ZAR", "NGN", "SGD"]) {
    assert.ok(options.some((option) => option.code === code), `missing ${code}`);
  }
});

test("currency symbols and formatting are locale aware", () => {
  assert.equal(getCurrencySymbol("INR", "en-IN"), "₹");
  assert.match(formatCurrency(1234.5, "EUR", "de-DE"), /1[.\s]234,50/);
  assert.deepEqual(getDefaultPaymentMethods("INR").slice(0, 2), ["UPI", "Cash"]);
});