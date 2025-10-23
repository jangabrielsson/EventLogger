# macOS Code Signing Guide

## Current State

The app is currently **not code-signed**, which means macOS will show a "damaged" or "unidentified developer" warning when users try to open it.

## User Workaround (Temporary Solution)

Users can bypass the Gatekeeper warning using one of these methods:

### Method 1: Terminal Command (Recommended)
```bash
xattr -cr /Applications/HC3\ Event\ Logger.app
```

### Method 2: Right-Click Open
1. Right-click (or Control-click) the app
2. Hold the **Option** key
3. Click "Open"
4. Click "Open" in the confirmation dialog

### Method 3: System Settings
1. Try to open the app (it will be blocked)
2. Go to System Settings > Privacy & Security
3. Scroll down and click "Open Anyway"
4. Try opening the app again

## Setting Up Code Signing (For Developer)

To properly sign the app and eliminate these warnings, you need an Apple Developer account.

### Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com/programs/

2. **Developer ID Certificate**
   - Log in to https://developer.apple.com/account
   - Go to Certificates, Identifiers & Profiles
   - Create a "Developer ID Application" certificate
   - Download and install it in Keychain Access

3. **App-Specific Password** (for notarization)
   - Go to https://appleid.apple.com/
   - Sign in and generate an app-specific password
   - Save this password securely

### GitHub Actions Setup

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

1. `APPLE_CERTIFICATE` - Base64 encoded .p12 certificate
2. `APPLE_CERTIFICATE_PASSWORD` - Password for the certificate
3. `APPLE_ID` - Your Apple ID email
4. `APPLE_PASSWORD` - App-specific password
5. `APPLE_TEAM_ID` - Your Team ID from developer.apple.com

#### Export Certificate as Base64

```bash
# Export certificate from Keychain as .p12
# Then convert to base64:
base64 -i certificate.p12 | pbcopy
```

### Update tauri.conf.json

Add signing configuration:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
      "entitlements": null,
      "exceptionDomain": "",
      "frameworks": [],
      "providerShortName": "TEAM_ID"
    }
  }
}
```

### Update GitHub Workflow

Replace the macOS build step with:

```yaml
- name: Build and sign Tauri app (macOS)
  if: matrix.platform.os == 'macos-latest'
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  with:
    tagName: ${{ github.ref_name }}
    releaseName: 'HC3 Event Logger ${{ github.ref_name }}'
    args: --target ${{ matrix.platform.target }}
```

## Benefits of Code Signing

- ✓ No more Gatekeeper warnings
- ✓ Users can open the app normally
- ✓ App appears as "verified" by Apple
- ✓ Notarization ensures no malware
- ✓ Better user trust and experience

## Cost-Benefit Analysis

**Cost:** $99/year for Apple Developer Program

**Benefits:**
- Professional appearance
- No user friction
- Required for Mac App Store distribution
- Access to beta software and tools

## Alternative: Self-Distribution Notice

If you choose not to sign the app, always include clear instructions in:
- Release notes
- README.md
- Installation documentation

Make it easy for users to bypass Gatekeeper safely.
