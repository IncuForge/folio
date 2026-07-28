export type CurrencyOption = {
  code: string;
  name: string;
  symbol: string;
  label: string;
};

const FALLBACK_CODES = [
  "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD","BIF","BMD","BND","BOB","BRL","BSD","BTN","BWP","BYN","BZD","CAD","CDF","CHF","CLP","CNY","COP","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ERN","ETB","EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD","GNF","GTQ","GYD","HKD","HNL","HTG","HUF","IDR","ILS","INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR","KMF","KPW","KRW","KWD","KYD","KZT","LAK","LBP","LKR","LRD","LSL","LYD","MAD","MDL","MGA","MKD","MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MYR","MZN","NAD","NGN","NIO","NOK","NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG","QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK","SGD","SHP","SLE","SOS","SRD","SSP","STN","SYP","SZL","THB","TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS","UAH","UGX","USD","UYU","UZS","VES","VND","VUV","WST","XAF","XCD","XOF","XPF","YER","ZAR","ZMW","ZWL"
];

const LEGACY_SYMBOL_CODES: Record<string, string> = {
  "₹": "INR", "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₩": "KRW", "₽": "RUB", "₺": "TRY", "₫": "VND", "₱": "PHP", "฿": "THB", "₪": "ILS", "₦": "NGN", "₴": "UAH", "₡": "CRC", "₲": "PYG", "₵": "GHS", "₸": "KZT", "₾": "GEL"
};

const PREFERRED_CODES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "AED", "SGD", "JPY", "CNY"];

export function resolveCurrencyCode(value?: string | null, fallback = "INR") {
  const normalized = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  return LEGACY_SYMBOL_CODES[String(value || "").trim()] || fallback;
}

export function getCurrencySymbol(codeOrSymbol?: string | null, locale?: string) {
  const original = String(codeOrSymbol || "").trim();
  const code = resolveCurrencyCode(original);
  if (LEGACY_SYMBOL_CODES[original]) return original;
  try {
    const part = new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((entry) => entry.type === "currency");
    return part?.value || code;
  } catch {
    return code;
  }
}

export function getCurrencyOptions(locale?: string): CurrencyOption[] {
  const intlWithSupportedValues = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] };
  const codes = intlWithSupportedValues.supportedValuesOf?.("currency") || FALLBACK_CODES;
  const displayNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(locale, { type: "currency" }) : null;
  const uniqueCodes = [...new Set(codes.map((code) => code.toUpperCase()))];
  return uniqueCodes.map((code) => {
    const name = displayNames?.of(code) || code;
    const symbol = getCurrencySymbol(code, locale);
    return { code, name, symbol, label: `${code} · ${symbol} · ${name}` };
  }).sort((a, b) => {
    const aPreferred = PREFERRED_CODES.indexOf(a.code);
    const bPreferred = PREFERRED_CODES.indexOf(b.code);
    if (aPreferred !== -1 || bPreferred !== -1) {
      if (aPreferred === -1) return 1;
      if (bPreferred === -1) return -1;
      return aPreferred - bPreferred;
    }
    return a.name.localeCompare(b.name, locale);
  });
}

export function formatCurrency(amount: number, codeOrSymbol?: string | null, locale?: string) {
  const code = resolveCurrencyCode(codeOrSymbol);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).format(Number(amount) || 0);
  } catch {
    return `${getCurrencySymbol(codeOrSymbol, locale)}${(Number(amount) || 0).toLocaleString(locale)}`;
  }
}

export function getDefaultPaymentMethods(codeOrSymbol?: string | null) {
  const code = resolveCurrencyCode(codeOrSymbol);
  if (code === "INR") return ["UPI", "Cash", "Card", "Bank Transfer", "Cheque"];
  if (code === "USD") return ["Bank Transfer", "Cash", "Card", "PayPal", "Cheque"];
  if (["EUR", "GBP", "AUD", "CAD", "NZD", "SGD"].includes(code)) return ["Bank Transfer", "Cash", "Card", "PayPal", "Cheque"];
  return ["Bank Transfer", "Cash", "Card", "Cheque", "Other"];
}