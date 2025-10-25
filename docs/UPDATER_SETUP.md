# Tauri Updater Setup Guide

## Overview

The HC3 Event Logger now includes automatic update functionality using Tauri's built-in updater plugin. Users can check for updates via the menu, and the app will download and install updates from GitHub Releases.

## What Was Installed

### 1. Dependencies
- Added `tauri-plugin-updater = "2"` to `Cargo.toml`

### 2. Configuration
- Configured updater in `tauri.conf.json` with GitHub endpoint
- Added "Check for Updates" menu item in the app menu
- Added frontend updater code with user dialogs

### 3. How It Works
- Users click "Check for Updates..." in the app menu
- App checks GitHub releases for newer versions
- If available, shows a dialog with release notes
- Downloads and installs update in the background
- Prompts to restart the app

## Next Steps: Signing Setup

For the updater to work in production, you need to:

### 1. Generate Signing Keys

```bash
# Generate a new keypair (run this once)
cargo tauri signer generate -w ~/.tauri/eventlogger.key

# This will output:
# - Private key (saved to ~/.tauri/eventlogger.key)
# - Public key (printed to console)
```

**⚠️ IMPORTANT:**
- Save the private key securely
- **NEVER commit the private key to git**
- Add `~/.tauri/` to `.gitignore` if not already there

### 2. Add Public Key to Config

Copy the public key from the output and add it to `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/jangabrielsson/EventLogger/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"  // Replace with actual public key
    }
  }
}
```

### 3. Update GitHub Actions Workflow

Your `.github/workflows/release.yml` needs to be updated to:
1. Sign the release artifacts using the private key
2. Generate a `latest.json` manifest file

Add this to your workflow (after the build step):

```yaml
- name: Sign and create updater artifacts
  env:
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  run: |
    cd src-tauri
    cargo tauri signer sign ./target/release/bundle/**/*.{dmg,app.tar.gz,nsis.zip,msi.zip} --private-key "$TAURI_SIGNING_PRIVATE_KEY" --password "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
```

### 4. Add GitHub Secrets

In your GitHub repository settings, add these secrets:

1. Go to Settings → Secrets and variables → Actions
2. Add new repository secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`: Content of `~/.tauri/eventlogger.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password if you set one (can be empty string)

### 5. Generate latest.json

Your GitHub Actions workflow needs to generate a `latest.json` file that contains:

```json
{
  "version": "0.2.3",
  "notes": "Release notes here",
  "pub_date": "2025-10-25T10:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "signature-here",
      "url": "https://github.com/jangabrielsson/EventLogger/releases/download/v0.2.3/HC3-Event-Logger_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "signature-here",
      "url": "https://github.com/jangabrielsson/EventLogger/releases/download/v0.2.3/HC3-Event-Logger_aarch64.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "signature-here",
      "url": "https://github.com/jangabrielsson/EventLogger/releases/download/v0.2.3/HC3-Event-Logger_x64-setup.nsis.zip"
    }
  }
}
```

## Testing the Updater

### Development Testing

1. Build a release version with an older version number
2. Install it
3. Update version in `tauri.conf.json` and `Cargo.toml`
4. Create a new release on GitHub (with signed artifacts)
5. Run the installed app and click "Check for Updates..."

### Manual Testing Without GitHub

You can test the updater locally by:

1. Creating a local HTTP server with a `latest.json` file
2. Temporarily changing the endpoint in `tauri.conf.json`
3. Testing the update flow

## User Experience

When a user clicks "Check for Updates...":

1. **Update Available:**
   - Shows dialog with version number and release notes
   - "Update" button downloads and installs
   - "Later" button dismisses the dialog
   - After install, prompts to restart

2. **No Update Available:**
   - Shows "You are running the latest version!" message

3. **Error:**
   - Shows error message if check fails

## Optional: Auto-Check on Startup

The updater code includes a commented-out line for automatic update checks on startup:

```javascript
// In setupUpdater() function:
setTimeout(() => checkForUpdates(true), 3000);
```

Uncomment this line if you want silent update checks when the app launches (checks after 3 seconds).

## Security Notes

- Updates are cryptographically signed
- Public key is embedded in the app
- Private key is used only in CI/CD
- Users' apps verify signatures before installing
- HTTPS is used for all update downloads

## Troubleshooting

### "Update check failed"
- Check internet connection
- Verify GitHub release exists
- Check `latest.json` format
- Verify public key matches private key

### Updates not detected
- Ensure version numbers follow semantic versioning
- Version in `latest.json` must be greater than installed version
- Check endpoint URL is correct

### Signature verification failed
- Public key in config must match signing key
- Ensure artifacts are signed correctly
- Check signature format in `latest.json`

## References

- [Tauri Updater Plugin Docs](https://v2.tauri.app/plugin/updater/)
- [Signing Guide](https://v2.tauri.app/security/signing/)
- [Release Workflow Examples](https://github.com/tauri-apps/tauri-action)
