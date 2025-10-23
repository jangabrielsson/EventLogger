# Icon Replacement Guide

## About the Icon Design

The icon features:
- A document/list representing the event log
- Orange dots representing logged events
- A clock symbol showing timestamps/real-time monitoring
- Blue color scheme for a professional, technical look

## Converting the SVG to Required Formats

### Option 1: Using Tauri's Icon Command (Recommended)

Tauri can automatically generate all required icon formats from a single PNG:

1. **Convert SVG to a high-res PNG (1024x1024 or larger)**
   
   Using ImageMagick:
   ```bash
   brew install imagemagick
   convert -background none icon-source.svg -resize 1024x1024 icon-1024.png
   ```
   
   Or using an online tool like:
   - https://convertio.co/svg-png/
   - https://cloudconvert.com/svg-to-png

2. **Use Tauri's icon generator**
   ```bash
   cargo install tauri-cli
   cargo tauri icon icon-1024.png
   ```
   
   This will automatically generate all the required formats and place them in `src-tauri/icons/`

### Option 2: Manual Conversion

If you prefer manual control, you'll need to create these sizes:

**PNG files:**
- 32x32.png
- 128x128.png
- 128x128@2x.png (256x256)
- icon.png (512x512 recommended)

**Platform-specific:**
- icon.icns (macOS) - use `png2icns` or Icon Composer
- icon.ico (Windows) - use ImageMagick or online converter
- Various Square*Logo.png files (Windows Store)

#### Using ImageMagick for batch conversion:
```bash
# Install ImageMagick
brew install imagemagick

# Generate different sizes
convert -background none icon-source.svg -resize 32x32 src-tauri/icons/32x32.png
convert -background none icon-source.svg -resize 128x128 src-tauri/icons/128x128.png
convert -background none icon-source.svg -resize 256x256 src-tauri/icons/128x128@2x.png
convert -background none icon-source.svg -resize 512x512 src-tauri/icons/icon.png

# For .icns (macOS)
brew install libicns
png2icns src-tauri/icons/icon.icns src-tauri/icons/icon.png

# For .ico (Windows)
convert src-tauri/icons/icon.png -define icon:auto-resize=256,128,96,64,48,32,16 src-tauri/icons/icon.ico
```

### Option 3: Online Tools

Use online icon generators:
- https://www.appicon.co/ (generates all formats)
- https://icon.kitchen/ (specifically for app icons)

Upload your SVG or a high-res PNG and download the generated icon pack.

## Customizing the Icon

The source SVG file is at: `icon-source.svg`

To modify colors or design:
1. Open `icon-source.svg` in a text editor or vector editor (Inkscape, Figma, Adobe Illustrator)
2. Edit the colors:
   - Blue background: `#1e3a8a` (change the fill in the circle element)
   - Orange dots: `#f97316` (change the fill in the event dots)
3. Save and regenerate the icon formats

## Testing the Icon

After replacing the icons:
1. Clean the build: `cd src-tauri && cargo clean`
2. Rebuild: `cargo tauri dev` or `cargo tauri build`
3. The new icon should appear in:
   - The app window title bar
   - The dock/taskbar
   - The application bundle

## Quick Start Command

The fastest way to get started:

```bash
# From the project root
brew install imagemagick
convert -background none icon-source.svg -resize 1024x1024 icon-1024.png
cargo tauri icon icon-1024.png
```

This will replace all icons automatically!
