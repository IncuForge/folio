export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.FOLIO_LOCAL_SQLITE === "1") {
    await import("./instrumentation-node");
  }
}
