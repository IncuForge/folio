use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
  collections::HashMap,
  fs,
  io::Read,
  path::PathBuf,
  sync::{Arc, Mutex},
  thread,
  time::{SystemTime, UNIX_EPOCH},
};
use tiny_http::{Header, Method, Response, Server, StatusCode};

const SYNC_PORT: u16 = 47631;
const MAX_BODY_BYTES: u64 = 32 * 1024 * 1024;
const MAX_COMMIT_IDS: usize = 2_000;

#[derive(Clone, Default)]
pub struct SyncServerState(pub Arc<Mutex<SyncInner>>);

#[derive(Default)]
pub struct SyncInner {
  address: String,
  snapshot: Option<Value>,
  revision: u64,
  pairing_code: Option<String>,
  pairing_expires_at: u64,
  pairing_failures: Vec<u64>,
  devices: HashMap<String, DeviceRecord>,
  commits: Vec<CommitRecord>,
  state_file: Option<PathBuf>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceRecord {
  id: String,
  name: String,
  paired_at: u64,
  last_seen_at: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommitRecord { id: String, revision: u64 }

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedState {
  snapshot: Option<Value>,
  revision: u64,
  devices: HashMap<String, DeviceRecord>,
  commits: Vec<CommitRecord>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
  running: bool,
  address: String,
  revision: u64,
  paired_devices: Vec<DeviceRecord>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingInfo {
  address: String,
  code: String,
  expires_at: u64,
  payload: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotState { revision: u64, snapshot: Option<Value> }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitResult {
  accepted: bool,
  revision: u64,
  snapshot: Option<Value>,
  error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairRequest { code: String, device_name: Option<String>, device_id: Option<String> }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncRequest { commit_id: String, base_revision: u64, snapshot: Value }

fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }

fn token(bytes: usize) -> String {
  let mut data = vec![0u8; bytes];
  rand::thread_rng().fill_bytes(&mut data);
  data.iter().map(|byte| format!("{byte:02x}")).collect()
}
fn token_key(value: &str) -> String {
  let digest = Sha256::digest(value.as_bytes());
  digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn json_response(value: Value, status: u16) -> Response<std::io::Cursor<Vec<u8>>> {
  let body = serde_json::to_vec(&value).unwrap_or_else(|_| b"{}".to_vec());
  let mut response = Response::from_data(body).with_status_code(StatusCode(status));
  response.add_header(Header::from_bytes("Content-Type", "application/json").unwrap());
  response
}

fn valid_snapshot(value: &Value) -> bool {
  value.get("format").and_then(Value::as_str) == Some("folio.backup")
    && value.get("version").and_then(Value::as_u64) == Some(2)
    && value.get("tables").and_then(Value::as_object).is_some()
}

fn persist(inner: &SyncInner) {
  let Some(path) = &inner.state_file else { return; };
  let state = PersistedState {
    snapshot: inner.snapshot.clone(),
    revision: inner.revision,
    devices: inner.devices.clone(),
    commits: inner.commits.clone(),
  };
  if let Ok(payload) = serde_json::to_vec(&state) {
    let temporary = path.with_extension("tmp");
    let backup = path.with_extension("bak");
    if fs::write(&temporary, payload).is_ok() {
      if path.exists() { let _ = fs::copy(path, &backup); let _ = fs::remove_file(path); }
      if fs::rename(&temporary, path).is_err() && backup.exists() { let _ = fs::copy(&backup, path); }
    }
  }
}

fn load(state: &SyncServerState, data_dir: PathBuf) {
  let _ = fs::create_dir_all(&data_dir);
  let path = data_dir.join("sync-state.json");
  let restored = fs::read(&path).ok().and_then(|bytes| serde_json::from_slice::<PersistedState>(&bytes).ok());
  let mut inner = state.0.lock().unwrap();
  inner.state_file = Some(path);
  if let Some(restored) = restored {
    inner.snapshot = restored.snapshot;
    inner.revision = restored.revision;
    inner.devices = restored.devices;
    inner.commits = restored.commits;
  }
}

fn commit(inner: &mut SyncInner, request: SyncRequest) -> CommitResult {
  if let Some(existing) = inner.commits.iter().find(|entry| entry.id == request.commit_id) {
    return CommitResult { accepted: true, revision: existing.revision, snapshot: None, error: None };
  }
  if request.commit_id.len() < 16 || request.commit_id.len() > 128 {
    return CommitResult { accepted: false, revision: inner.revision, snapshot: None, error: Some("Invalid commit identifier.".into()) };
  }
  if !valid_snapshot(&request.snapshot) {
    return CommitResult { accepted: false, revision: inner.revision, snapshot: None, error: Some("Invalid Folio snapshot.".into()) };
  }
  if request.base_revision != inner.revision {
    return CommitResult { accepted: false, revision: inner.revision, snapshot: inner.snapshot.clone(), error: Some("The workspace changed on another device.".into()) };
  }
  inner.revision += 1;
  inner.snapshot = Some(request.snapshot);
  let revision = inner.revision;
  inner.commits.push(CommitRecord { id: request.commit_id, revision });
  if inner.commits.len() > MAX_COMMIT_IDS {
    let excess = inner.commits.len() - MAX_COMMIT_IDS;
    inner.commits.drain(0..excess);
  }
  persist(inner);
  CommitResult { accepted: true, revision, snapshot: None, error: None }
}

pub fn start(state: SyncServerState, data_dir: PathBuf) {
  load(&state, data_dir);
  let ip = local_ip_address::local_ip().map(|value| value.to_string()).unwrap_or_else(|_| "127.0.0.1".into());
  state.0.lock().unwrap().address = format!("http://{ip}:{SYNC_PORT}");
  thread::spawn(move || {
    let Ok(server) = Server::http(format!("0.0.0.0:{SYNC_PORT}")) else { return; };
    for mut request in server.incoming_requests() {
      if request.method() == &Method::Options {
        let _ = request.respond(json_response(json!({"ok": true}), 204));
        continue;
      }
      let path = request.url().split('?').next().unwrap_or(request.url()).to_string();
      if request.method() == &Method::Get && path == "/health" {
        let inner = state.0.lock().unwrap();
        let _ = request.respond(json_response(json!({"ok": true, "service": "folio-sync", "version": 2, "revision": inner.revision}), 200));
        continue;
      }
      if request.method() == &Method::Post && (path == "/pair" || path == "/sync") {
        if request.body_length().map(|length| length as u64 > MAX_BODY_BYTES).unwrap_or(false) {
          let _ = request.respond(json_response(json!({"error": "Request is too large."}), 413));
          continue;
        }
        let mut body = String::new();
        if request.as_reader().take(MAX_BODY_BYTES + 1).read_to_string(&mut body).is_err() || body.len() as u64 > MAX_BODY_BYTES {
          let _ = request.respond(json_response(json!({"error": "Request is too large."}), 413));
          continue;
        }
        if path == "/pair" {
          let parsed = serde_json::from_str::<PairRequest>(&body);
          let mut inner = state.0.lock().unwrap();
          let timestamp = now();
          inner.pairing_failures.retain(|attempt| *attempt + 60 > timestamp);
          if inner.pairing_failures.len() >= 10 {
            let _ = request.respond(json_response(json!({"error": "Too many pairing attempts. Try again shortly."}), 429));
            continue;
          }
          let valid = parsed.as_ref().ok().map(|item| Some(&item.code) == inner.pairing_code.as_ref() && timestamp <= inner.pairing_expires_at).unwrap_or(false);
          if !valid {
            inner.pairing_failures.push(timestamp);
            let _ = request.respond(json_response(json!({"error": "Pairing code is invalid or expired."}), 401));
            continue;
          }
          let item = parsed.unwrap();
          inner.pairing_failures.clear();
          let device_token = token(32);
          let device = DeviceRecord {
            id: item.device_id.unwrap_or_else(|| token(16)),
            name: item.device_name.unwrap_or_else(|| "Android device".into()).chars().take(80).collect(),
            paired_at: timestamp,
            last_seen_at: timestamp,
          };
          inner.devices.insert(token_key(&device_token), device);
          inner.pairing_code = None;
          persist(&inner);
          let _ = request.respond(json_response(json!({"ok": true, "deviceToken": device_token, "snapshotUrl": "/snapshot", "syncUrl": "/sync", "revision": inner.revision}), 200));
          continue;
        }
        let supplied = token_key(&bearer_token(&request));
        let parsed = serde_json::from_str::<SyncRequest>(&body);
        let mut inner = state.0.lock().unwrap();
        let Some(device) = inner.devices.get_mut(&supplied) else {
          let _ = request.respond(json_response(json!({"error": "This device is not paired."}), 401));
          continue;
        };
        device.last_seen_at = now();
        let result = parsed.map(|item| commit(&mut inner, item));
        let response = match result {
          Ok(result) => {
            let status = if result.accepted { 200 } else if result.snapshot.is_some() { 409 } else { 400 };
            (serde_json::to_value(result).unwrap_or_else(|_| json!({"error": "Sync failed."})), status)
          }
          Err(_) => (json!({"error": "Malformed sync request."}), 400),
        };
        let _ = request.respond(json_response(response.0, response.1));
        continue;
      }
      if request.method() == &Method::Get && path == "/snapshot" {
        let supplied = token_key(&bearer_token(&request));
        let mut inner = state.0.lock().unwrap();
        let Some(device) = inner.devices.get_mut(&supplied) else {
          let _ = request.respond(json_response(json!({"error": "This device is not paired."}), 401));
          continue;
        };
        device.last_seen_at = now();
        let response = inner.snapshot.clone().map(|snapshot| json!({"ok": true, "revision": inner.revision, "snapshot": snapshot})).unwrap_or_else(|| json!({"error": "Desktop snapshot is not ready."}));
        let status = if inner.snapshot.is_some() { 200 } else { 503 };
        let _ = request.respond(json_response(response, status));
        continue;
      }
      let _ = request.respond(json_response(json!({"error": "Not found"}), 404));
    }
  });
}

fn bearer_token(request: &tiny_http::Request) -> String {
  request.headers().iter()
    .find(|header| header.field.equiv("Authorization"))
    .map(|header| header.value.as_str().to_string())
    .unwrap_or_default()
    .strip_prefix("Bearer ")
    .unwrap_or("")
    .to_string()
}

#[tauri::command]
pub fn sync_status(state: tauri::State<'_, SyncServerState>) -> SyncStatus {
  let inner = state.0.lock().unwrap();
  SyncStatus { running: !inner.address.is_empty(), address: inner.address.clone(), revision: inner.revision, paired_devices: inner.devices.values().cloned().collect() }
}

#[tauri::command]
pub fn sync_create_pairing(snapshot: Value, state: tauri::State<'_, SyncServerState>) -> PairingInfo {
  let mut inner = state.0.lock().unwrap();
  if inner.snapshot.is_none() { inner.snapshot = Some(snapshot); inner.revision = 1; persist(&inner); }
  let code = format!("{:06}", rand::random::<u32>() % 1_000_000);
  let expires_at = now() + 300;
  inner.pairing_code = Some(code.clone());
  inner.pairing_expires_at = expires_at;
  let payload = json!({"version": 2, "address": inner.address.clone(), "code": code.clone()}).to_string();
  PairingInfo { address: inner.address.clone(), code, expires_at, payload }
}

#[tauri::command]
pub fn sync_snapshot_state(state: tauri::State<'_, SyncServerState>) -> SnapshotState {
  let inner = state.0.lock().unwrap();
  SnapshotState { revision: inner.revision, snapshot: inner.snapshot.clone() }
}

#[tauri::command]
pub fn sync_commit_host(commit_id: String, base_revision: u64, snapshot: Value, state: tauri::State<'_, SyncServerState>) -> CommitResult {
  commit(&mut state.0.lock().unwrap(), SyncRequest { commit_id, base_revision, snapshot })
}

#[tauri::command]
pub fn sync_revoke_device(device_id: String, state: tauri::State<'_, SyncServerState>) -> bool {
  let mut inner = state.0.lock().unwrap();
  let before = inner.devices.len();
  inner.devices.retain(|_, device| device.id != device_id);
  let removed = inner.devices.len() != before;
  if removed { persist(&inner); }
  removed
}