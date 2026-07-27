#[cfg(desktop)]
mod sync_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init());

  #[cfg(desktop)]
  let builder = {
    let sync_state = sync_server::SyncServerState::default();
    sync_server::start(sync_state.clone());
    builder
      .manage(sync_state)
      .invoke_handler(tauri::generate_handler![sync_server::sync_status, sync_server::sync_create_pairing])
      .plugin(tauri_plugin_updater::Builder::new().build())
      .plugin(tauri_plugin_process::init())
  };

  #[cfg(mobile)]
  let builder = builder
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_barcode_scanner::init());

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
