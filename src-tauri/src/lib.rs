#[cfg(desktop)]
mod sync_server;

#[cfg(target_os = "windows")]
mod windows_snap;

#[cfg(desktop)]
use tauri::Manager;

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
    builder
      .manage(sync_state)
      .invoke_handler(tauri::generate_handler![
        sync_server::sync_status,
        sync_server::sync_create_pairing,
        sync_server::sync_snapshot_state,
        sync_server::sync_commit_host,
        sync_server::sync_revoke_device,
      ])
      .plugin(tauri_plugin_updater::Builder::new().build())
      .plugin(tauri_plugin_process::init())
  };

  #[cfg(mobile)]
  let builder = builder
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_barcode_scanner::init());

  builder
    .setup(|app| {
      #[cfg(desktop)]
      {
        let data_dir = app.path().app_data_dir()?;
        let sync_state = app.state::<sync_server::SyncServerState>().inner().clone();
        sync_server::start(sync_state, data_dir);
      }
      #[cfg(target_os = "windows")]
      {
        let main_window = app
          .get_webview_window("main")
          .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "main window not found"))?;
        windows_snap::install(&main_window)?;
      }
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