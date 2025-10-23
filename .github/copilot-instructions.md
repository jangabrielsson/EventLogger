# GitHub Copilot Instructions for EventLogger

## Project Overview
HC3 Event Logger - A Tauri 2.x desktop application for monitoring Fibaro Home Center 3 events in real-time.

## Technology Stack
- **Framework**: Tauri 2.9.1
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Backend**: Rust
- **Build System**: Cargo + Tauri CLI
- **Target Platforms**: macOS (Intel/Apple Silicon), Windows

## Important Architectural Patterns

### HTTP Requests
Always use Tauri's HTTP plugin, never browser fetch directly:

```javascript
const { fetch } = window.__TAURI__.http;

const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': authHeader },
    responseType: 1 // Text response type
});

const responseText = await response.text();
const data = JSON.parse(responseText);
```

**Key points:**
- Always set `responseType: 1` for text responses
- Call `.text()` to get the response body
- Parse JSON manually from the text
- Never use `response.data` directly - it doesn't work reliably

### Multi-Window Architecture

#### Creating New Windows
1. **Add HTML file** in `src/` directory
2. **Update capabilities** in `src-tauri/capabilities/default.json`:
   ```json
   "windows": [
     "main",
     "your-new-window"
   ]
   ```
3. **Add Rust command** in `src-tauri/src/lib.rs`:
   ```rust
   #[tauri::command]
   fn open_your_window(app: tauri::AppHandle) {
       if let Some(window) = app.get_webview_window("your-window") {
           let _ = window.set_focus();
           return;
       }
       
       let _window = tauri::WebviewWindowBuilder::new(
           &app,
           "your-window",
           tauri::WebviewUrl::App("your-window.html".into()),
       )
       .title("Your Window Title")
       .inner_size(800.0, 600.0)
       .resizable(true)
       .build()
       .unwrap();
   }
   ```
4. **Add to menu** if needed
5. **Register command** in `invoke_handler`

#### Menu Structure (macOS)
Always include proper macOS menu structure with App menu and Window menu:

```rust
use tauri::{Manager, menu::{Menu, MenuItem, Submenu, PredefinedMenuItem}};

// In setup:
let window_menu = Submenu::with_items(
    app,
    "Window",
    true,
    &[
        &custom_menu_item,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::minimize(app, None)?,
        &PredefinedMenuItem::close_window(app, None)?,
    ],
)?;

let menu = Menu::with_items(
    app,
    &[
        &Submenu::with_items(
            app,
            "App Name",
            true,
            &[
                &PredefinedMenuItem::about(app, None, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ],
        )?,
        &window_menu,
    ],
)?;

app.set_menu(menu)?;
```

### Sharing Data Between Windows
Use `localStorage` to share configuration between windows:

```javascript
// Main window sets:
localStorage.setItem('hc3Host', this.config.ip);
localStorage.setItem('hc3User', this.config.username);
localStorage.setItem('hc3Password', this.config.password);

// Other windows read:
const hc3Host = localStorage.getItem('hc3Host');
const hc3User = localStorage.getItem('hc3User');
const hc3Password = localStorage.getItem('hc3Password');
```

## HC3 API Integration

### Common Endpoints
- `/api/settings/info` - System information (version, serial, platform, z-wave, etc.)
- `/api/home` - Home settings (timezone, temperature unit, etc.)
- `/api/refreshStates` - Long-polling for events

### Authentication
Always use Basic Auth with base64 encoded credentials:
```javascript
const authHeader = 'Basic ' + btoa(username + ':' + password);
```

## File Organization
```
src/
  ├── index.html          # Main window
  ├── script.js           # Main window logic
  ├── styles.css          # Main window styles
  └── hc3-info.html       # HC3 System Info window
src-tauri/
  ├── src/
  │   ├── main.rs         # Entry point
  │   └── lib.rs          # Tauri app builder, commands, menu
  ├── capabilities/
  │   └── default.json    # Window permissions
  └── tauri.conf.json     # App configuration
```

## Common Pitfalls

### ❌ Don't
- Use browser `fetch()` directly - it causes CORS issues
- Parse `response.data` as JSON directly - use `.text()` then parse
- Forget to add new windows to `capabilities/default.json`
- Skip `responseType: 1` when using Tauri HTTP plugin
- Create menus without proper macOS structure (app menu + window menu)

### ✅ Do
- Always use `window.__TAURI__.http.fetch()` for HTTP requests
- Set `responseType: 1` and parse text manually
- Add all windows to capabilities for HTTP permissions
- Use localStorage for cross-window data sharing
- Include proper macOS menu structure with predefined items
- Check if window exists before creating (prevent duplicates)

## Build & Release

### Version Management
Use `./scripts/version.sh` to:
- Prompt for new version number
- Update `tauri.conf.json` and `Cargo.toml`
- Update `Cargo.lock`
- Create git tag
- Push to trigger GitHub Actions release build

### GitHub Actions
- Triggered on git tags matching `v*`
- Builds for macOS (Intel + Apple Silicon) and Windows
- Creates GitHub release with installers
- Requires `contents: write` permission

## Testing
- Run in dev mode: `cd src-tauri && cargo tauri dev`
- Build production: `cd src-tauri && cargo tauri build`
- Clean build: `cd src-tauri && cargo clean`

## Troubleshooting

### "http.fetch not allowed on window"
- Add window name to `capabilities/default.json` windows array

### "undefined is not an object" when accessing response
- Make sure to use `responseType: 1` and `.text()` before parsing JSON

### Menu not showing on macOS
- Include proper app menu with predefined items (About, Quit, etc.)
- Structure: App menu → Other menus

### Window opens multiple times
- Check if window exists first: `app.get_webview_window("window-id")`
- Focus existing window instead of creating new one
