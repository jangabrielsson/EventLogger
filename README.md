# HC3 Event Logger

A desktop application for monitoring Fibaro Home Center 3 (HC3) events in real-time.

## Download

**Recommended:** Download the latest pre-built release from GitHub:

👉 **[Download Latest Release](https://github.com/jangabrielsson/EventLogger/releases/latest)**

Available for:
- **macOS (Apple Silicon M1/M2/M3):** `HC3-Event-Logger_aarch64.app.tar.gz`
- **macOS (Intel):** `HC3-Event-Logger_x64.app.tar.gz`
- **Windows:** `HC3-Event-Logger_x64-setup.exe`

For detailed installation instructions, see [FORUM_POST.html](FORUM_POST.html) or the [releases page](https://github.com/jangabrielsson/EventLogger/releases/latest).

## Features

- ✅ Real-time event monitoring with live updates
- ✅ HC3 system information viewer
- ✅ Multi-window interface
- ✅ No CORS issues (native app bypasses browser restrictions)
- ✅ Small file size (~5MB)
- ✅ Fast startup and low memory usage
- ✅ Secure local connection to your HC3

## Quick Start

### 1. Install the App

**macOS:**
1. Download the appropriate `.tar.gz` file for your Mac
2. Extract and drag to Applications folder
3. Right-click and select "Open" (first time only)

**Windows:**
1. Download `HC3-Event-Logger_x64-setup.exe`
2. Run the installer
3. Launch from Start Menu

### 2. Configure HC3 Credentials

You need to configure your HC3 connection details before using the app.

#### Option A: .env File (Recommended)

Create a file named `.env` with your HC3 credentials. The app checks these locations in order:

**macOS:**
1. Your home directory: `~/.env` (Recommended - easiest to create and manage)
2. Current working directory when app is launched
3. Same directory as the .app file

**Windows:**
1. Your home directory: `C:\Users\YourUsername\.env` (Recommended)
2. Installation directory: `C:\Program Files\HC3 Event Logger\.env`

Content of `.env` file:
```
HC3_HOST=192.168.1.57
HC3_USER=admin
HC3_PASSWORD=yourpassword
```

**Create the file on macOS:**
```bash
nano ~/.env
# Paste the content above, edit with your credentials
# Press Ctrl+X, then Y, then Enter to save
```

**Create the file on Windows:**
```powershell
notepad $env:USERPROFILE\.env
# Paste the content above, edit with your credentials, and save
```

Replace with your actual HC3 IP address, username, and password.

#### Option B: Environment Variables

**macOS/Linux:**
```bash
export HC3_HOST=192.168.1.57
export HC3_USER=admin
export HC3_PASSWORD=yourpassword
open /Applications/HC3\ Event\ Logger.app
```

**Windows (PowerShell):**
```powershell
$env:HC3_HOST="192.168.1.57"
$env:HC3_USER="admin"
$env:HC3_PASSWORD="yourpassword"
Start-Process "C:\Program Files\HC3 Event Logger\HC3 Event Logger.exe"
```

**Note:** Restart the application after configuring credentials.

---

## For Developers

---

## For Developers

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jangabrielsson/EventLogger.git
   cd EventLogger
   ```

2. **Configure credentials** (for development)
   ```bash
   cp .env.example .env
   # Edit .env with your HC3 credentials
   ```

3. **Requirements**
   - Rust (install from https://rustup.rs)
   - Tauri CLI: `cargo install tauri-cli`

### Development Mode (Hot Reload)

Run the app in development mode with hot-reload:

```bash
cargo tauri dev
```

This will:
- Start the Tauri development server
- Open the app window
- **Automatically reload** when you edit HTML, CSS, or JavaScript files
- Show console output in the terminal

You can edit files in the `src/` directory and see changes immediately without restarting!

### Building for Distribution

**macOS:**
```bash
cargo tauri build
```
Built app will be in: `src-tauri/target/release/bundle/macos/`

**Windows:**
```bash
cargo tauri build
```
Built installer will be in: `src-tauri/target/release/bundle/nsis/`

### Development Workflow

1. **Start dev mode**: `cargo tauri dev`
2. **Edit files**: Modify `src/index.html`, `src/styles.css`, or `src/script.js`
3. **See changes**: The app automatically reloads
4. **Build**: When ready, run `cargo tauri build`

### Project Structure

```
EventLogger/
├── src/                    # Frontend files (HTML, CSS, JS)
│   ├── index.html         # Main window UI
│   ├── hc3-info.html      # HC3 System Info window
│   ├── styles.css         # Styles
│   └── script.js          # HC3 communication logic
└── src-tauri/             # Rust backend
    ├── src/               # Rust source code
    │   ├── main.rs        # Entry point
    │   └── lib.rs         # App setup, commands, menu
    ├── tauri.conf.json    # Tauri configuration
    └── Cargo.toml         # Rust dependencies
```

### Configuration

Edit `src-tauri/tauri.conf.json` to change:
- Window size and title
- App icon
- Bundle identifier
- Security settings

## Troubleshooting

### App shows "Credentials Not Configured"
- Ensure `.env` file exists in the correct location
- Verify file is named exactly `.env` (not `.env.txt`)
- Check credentials are correct
- Restart the application

### Cannot connect to HC3
- Verify HC3 IP address is correct
- Ensure computer is on same network as HC3
- Test by opening `http://YOUR_HC3_IP` in a browser

### macOS: App won't open
- Right-click app and select "Open" (first time only)
- Go to System Preferences → Security & Privacy → "Open Anyway"

### Windows: Installer blocked
- Click "More info" → "Run anyway"
- App is safe but not signed with Microsoft certificate

## Support

- **Issues:** [GitHub Issues](https://github.com/jangabrielsson/EventLogger/issues)
- **Documentation:** See [FORUM_POST.html](FORUM_POST.html) for detailed instructions

## License

See [LICENSE](LICENSE) file for details.