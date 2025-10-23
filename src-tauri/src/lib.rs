use tauri::{Manager, menu::{Menu, MenuItem, Submenu, PredefinedMenuItem}};

#[derive(serde::Serialize)]
struct HC3Config {
    host: Option<String>,
    user: Option<String>,
    password: Option<String>,
}

#[tauri::command]
fn get_hc3_config() -> HC3Config {
    HC3Config {
        host: std::env::var("HC3_HOST").ok(),
        user: std::env::var("HC3_USER").ok(),
        password: std::env::var("HC3_PASSWORD").ok(),
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
  let _ = dotenvy::dotenv();
  
  // Try home directory (cross-platform)
  // On Unix: $HOME, On Windows: %USERPROFILE%
  let home_var = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
  if let Ok(home_dir) = std::env::var(home_var) {
    let home_env = std::path::PathBuf::from(home_dir).join(".env");
    let _ = dotenvy::from_path(home_env);
  }
  
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
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
      let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
          &open_hc3_info,
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
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![open_hc3_info_window, get_hc3_config])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
