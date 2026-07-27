use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, io::Read, sync::{Arc, Mutex}, thread, time::{SystemTime, UNIX_EPOCH}};
use tiny_http::{Header, Method, Response, Server, StatusCode};

const SYNC_PORT: u16 = 47631;

#[derive(Clone, Default)]
pub struct SyncServerState(pub Arc<Mutex<SyncInner>>);

#[derive(Default)]
pub struct SyncInner {
  pub address: String,
  pub snapshot: Option<Value>,
  pub pairing_code: Option<String>,
  pub pairing_expires_at: u64,
  pub devices: HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
  running: bool,
  address: String,
  paired_devices: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingInfo {
  address: String,
  code: String,
  expires_at: u64,
  payload: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairRequest { code: String, device_name: Option<String> }

fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }
fn token(bytes: usize) -> String {
  let mut data = vec![0u8; bytes];
  rand::thread_rng().fill_bytes(&mut data);
  data.iter().map(|byte| format!("{byte:02x}")).collect()
}
fn json_response(value: Value, status: u16) -> Response<std::io::Cursor<Vec<u8>>> {
  let body = serde_json::to_vec(&value).unwrap_or_else(|_| b"{}".to_vec());
  let mut response = Response::from_data(body).with_status_code(StatusCode(status));
  response.add_header(Header::from_bytes("Content-Type", "application/json").unwrap());
  response.add_header(Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap());
  response.add_header(Header::from_bytes("Access-Control-Allow-Headers", "Authorization, Content-Type").unwrap());
  response
}

pub fn start(state: SyncServerState) {
  let ip = local_ip_address::local_ip().map(|value| value.to_string()).unwrap_or_else(|_| "127.0.0.1".into());
  let address = format!("http://{ip}:{SYNC_PORT}");
  state.0.lock().unwrap().address = address;
  thread::spawn(move || {
    let Ok(server) = Server::http(format!("0.0.0.0:{SYNC_PORT}")) else { return; };
    for mut request in server.incoming_requests() {
      if request.method() == &Method::Options {
        let _ = request.respond(json_response(json!({"ok": true}), 204));
        continue;
      }
      let path = request.url().split('?').next().unwrap_or(request.url()).to_string();
      if request.method() == &Method::Get && path == "/health" {
        let _ = request.respond(json_response(json!({"ok": true, "service": "folio-sync", "version": 1}), 200));
        continue;
      }
      if request.method() == &Method::Post && path == "/pair" {
        let mut body = String::new();
        let _ = request.as_reader().read_to_string(&mut body);
        let parsed = serde_json::from_str::<PairRequest>(&body);
        let mut inner = state.0.lock().unwrap();
        let valid = parsed.as_ref().ok().map(|item| Some(&item.code) == inner.pairing_code.as_ref() && now() <= inner.pairing_expires_at).unwrap_or(false);
        if !valid {
          let _ = request.respond(json_response(json!({"error": "Pairing code is invalid or expired."}), 401));
          continue;
        }
        let device_token = token(32);
        let device_name = parsed.ok().and_then(|item| item.device_name).unwrap_or_else(|| "Android device".into());
        inner.devices.insert(device_token.clone(), device_name);
        inner.pairing_code = None;
        let _ = request.respond(json_response(json!({"ok": true, "deviceToken": device_token, "snapshotUrl": "/snapshot"}), 200));
        continue;
      }
      if request.method() == &Method::Get && path == "/snapshot" {
        let auth = request.headers().iter().find(|header| header.field.equiv("Authorization")).map(|header| header.value.as_str().to_string()).unwrap_or_default();
        let supplied = auth.strip_prefix("Bearer ").unwrap_or("");
        let inner = state.0.lock().unwrap();
        if !inner.devices.contains_key(supplied) {
          let _ = request.respond(json_response(json!({"error": "This device is not paired."}), 401));
          continue;
        }
        let response = inner.snapshot.clone().map(|snapshot| json!({"ok": true, "snapshot": snapshot})).unwrap_or_else(|| json!({"error": "Desktop snapshot is not ready."}));
        let status = if inner.snapshot.is_some() { 200 } else { 503 };
        let _ = request.respond(json_response(response, status));
        continue;
      }
      let _ = request.respond(json_response(json!({"error": "Not found"}), 404));
    }
  });
}

#[tauri::command]
pub fn sync_status(state: tauri::State<'_, SyncServerState>) -> SyncStatus {
  let inner = state.0.lock().unwrap();
  SyncStatus { running: !inner.address.is_empty(), address: inner.address.clone(), paired_devices: inner.devices.values().cloned().collect() }
}

#[tauri::command]
pub fn sync_create_pairing(snapshot: Value, state: tauri::State<'_, SyncServerState>) -> PairingInfo {
  let mut inner = state.0.lock().unwrap();
  let code = format!("{:06}", (rand::random::<u32>() % 1_000_000));
  let expires_at = now() + 300;
  inner.snapshot = Some(snapshot);
  inner.pairing_code = Some(code.clone());
  inner.pairing_expires_at = expires_at;
  let payload = json!({"version": 1, "address": inner.address.clone(), "code": code}).to_string();
  PairingInfo { address: inner.address.clone(), code, expires_at, payload }
}
