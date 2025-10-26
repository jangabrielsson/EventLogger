use tauri::{Manager, Emitter, menu::{Menu, MenuItem, Submenu, PredefinedMenuItem}};

#[derive(serde::Serialize)]
struct HC3Config {
    host: Option<String>,
    user: Option<String>,
    password: Option<String>,
    protocol: Option<String>,
}

#[tauri::command]
fn get_hc3_config() -> HC3Config {
    let host = std::env::var("HC3_HOST").ok();
    let user = std::env::var("HC3_USER").ok();
    let password = std::env::var("HC3_PASSWORD").ok();
    let protocol = std::env::var("HC3_PROTOCOL").ok();
    
    println!("Reading HC3 config:");
    println!("  HC3_HOST: {}", if host.is_some() { "set" } else { "NOT SET" });
    println!("  HC3_USER: {}", if user.is_some() { "set" } else { "NOT SET" });
    println!("  HC3_PASSWORD: {}", if password.is_some() { "set" } else { "NOT SET" });
    println!("  HC3_PROTOCOL: {}", if protocol.is_some() { "set" } else { "NOT SET" });
    
    HC3Config {
        host,
        user,
        password,
        protocol,
    }
}

#[tauri::command]
fn open_hc3_info_window(app: tauri::AppHandle) {
    // Check if window already exists
    if let Some(window) = app.get_webview_window("hc3-info") {
        let _ = window.set_focus();
        return;
    }

    // Create new window
    let _window = tauri::WebviewWindowBuilder::new(
        &app,
        "hc3-info",
        tauri::WebviewUrl::App("hc3-info.html".into()),
    )
    .title("HC3 System Info")
    .inner_size(700.0, 600.0)
    .resizable(true)
    .build()
    .unwrap();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Try to load .env file from multiple locations:
  // 1. Current working directory
  // 2. Home directory (~/.env on Unix, %USERPROFILE%\.env on Windows)
  
  // Try current directory first
  match dotenvy::dotenv() {
    Ok(path) => println!("Loaded .env from: {:?}", path),
    Err(e) => println!("No .env in current directory: {}", e),
  }
  
  // Try home directory (cross-platform)
  // On Unix: $HOME, On Windows: %USERPROFILE%
  let home_var = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
  if let Ok(home_dir) = std::env::var(home_var) {
    let home_env = std::path::PathBuf::from(home_dir).join(".env");
    println!("Trying to load .env from home: {:?}", home_env);
    match dotenvy::from_path(&home_env) {
      Ok(_) => println!("Successfully loaded .env from home directory"),
      Err(e) => println!("Failed to load .env from home directory: {}", e),
    }
  } else {
    println!("Could not determine home directory (${} not set)", home_var);
  }
  
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Create Window menu with HC3 System Info item
      let open_hc3_info = MenuItem::with_id(app, "open_hc3_info", "HC3 System Info", true, None::<&str>)?;
      let check_for_updates = MenuItem::with_id(app, "check_for_updates", "Check for Updates...", true, None::<&str>)?;
      let toggle_devtools = MenuItem::with_id(app, "toggle_devtools", "Toggle Developer Tools", true, Some("CmdOrCtrl+Shift+I"))?;
      let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
          &open_hc3_info,
          &toggle_devtools,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::minimize(app, None)?,
          &PredefinedMenuItem::close_window(app, None)?,
        ],
      )?;

      // Create main menu with app menu and window menu
      let menu = Menu::with_items(
        app,
        &[
          &Submenu::with_items(
            app,
            "HC3 Event Logger",
            true,
            &[
              &PredefinedMenuItem::about(app, None, None)?,
              &check_for_updates,
              &PredefinedMenuItem::separator(app)?,
              &PredefinedMenuItem::services(app, None)?,
              &PredefinedMenuItem::separator(app)?,
              &PredefinedMenuItem::hide(app, None)?,
              &PredefinedMenuItem::hide_others(app, None)?,
              &PredefinedMenuItem::show_all(app, None)?,
              &PredefinedMenuItem::separator(app)?,
              &PredefinedMenuItem::quit(app, None)?,
            ],
          )?,
          &window_menu,
        ],
      )?;
      
      app.set_menu(menu)?;
      
      // Handle menu events
      app.on_menu_event(move |app, event| {
        if event.id() == "open_hc3_info" {
          open_hc3_info_window(app.clone());
        } else if event.id() == "check_for_updates" {
          // Emit event to frontend to trigger update check
          let _ = app.emit("check-for-updates", ());
        } else if event.id() == "toggle_devtools" {
          // Toggle devtools directly in Rust
          if let Some(webview) = app.get_webview_window("main") {
            #[cfg(any(debug_assertions, feature = "devtools"))]
            {
              if webview.is_devtools_open() {
                webview.close_devtools();
              } else {
                webview.open_devtools();
              }
            }
          }
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![open_hc3_info_window, get_hc3_config])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
