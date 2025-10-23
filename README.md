# HC3 Event Logger - Tauri App

A desktop application for monitoring Fibaro Home Center 3 (HC3) events in real-time.

## Development Mode (Hot Reload)

To run the app in development mode with hot-reload:

```bash
cargo tauri dev
```

This will:
- Start the Tauri development server
- Open the app window
- **Automatically reload** when you edit HTML, CSS, or JavaScript files
- Show console output in the terminal

You can edit files in the `src/` directory and see changes immediately without restarting!

## Building for Distribution

To create a standalone `.app` for macOS:

```bash
cargo tauri build
```

The built app will be in: `src-tauri/target/release/bundle/macos/`

## Project Structure

```
EventLogger2/
├── src/                    # Frontend files (HTML, CSS, JS)
│   ├── index.html         # Main UI
│   ├── styles.css         # Styles
│   └── script.js          # HC3 communication logic
└── src-tauri/             # Rust backend
    ├── src/               # Rust source code
    ├── tauri.conf.json    # Tauri configuration
    └── Cargo.toml         # Rust dependencies
```

## Features

- ✅ No CORS issues (native app bypasses browser restrictions)
- ✅ Hot reload in dev mode
- ✅ Small file size (~5MB)
- ✅ Single `.app` file for distribution
- ✅ Fast startup and low memory usage

## Development Workflow

1. **Start dev mode**: `cargo tauri dev`
2. **Edit files**: Modify `src/index.html`, `src/styles.css`, or `src/script.js`
3. **See changes**: The app automatically reloads
4. **Build**: When ready, run `cargo tauri build`

## Configuration

Edit `src-tauri/tauri.conf.json` to change:
- Window size and title
- App icon
- Bundle identifier
- Security settings

## Requirements

- Rust (already installed ✅)
- Tauri CLI (already installed ✅)

## Notes

- No Node.js or npm required!
- Direct connection to HC3 works (no proxy needed)
- Use your HC3 IP address directly (e.g., `192.168.1.57`)