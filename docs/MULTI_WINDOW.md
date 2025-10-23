# Multi-Window Support

## Overview
Added support for multiple windows in the Event Logger app. Users can now open a secondary "HC3 System Info" window from a menu.

## Implementation

### Menu System
- Added a menu with "HC3 System Info" menu item
- Menu is configured in the Tauri setup function
- Menu events trigger the window creation command

### Window Management
- **Command**: `open_hc3_info_window` - Creates or focuses the HC3 info window
- **Window ID**: `hc3-info` - Used to track and prevent duplicates
- **Window Features**:
  - Size: 700x600 pixels
  - Resizable: Yes
  - Prevents duplicate windows (focuses existing if already open)

### Files Added/Modified

#### `src-tauri/src/lib.rs`
- Added menu creation with "HC3 System Info" item
- Added `open_hc3_info_window` Tauri command
- Registered command handler
- Added menu event listener

#### `src/hc3-info.html`
- New HTML file for the HC3 info window
- Displays system information (placeholder for now)
- Modern, responsive design
- Sections for:
  - Connection status
  - IP address
  - System version
  - Serial number
  - Uptime (future)

## Usage
1. Launch the app
2. Click on the menu and select "HC3 System Info"
3. A new window opens showing HC3 system information
4. If the window is already open, it will be focused instead of creating a duplicate

## Future Enhancements
- Fetch actual HC3 system data via API
- Add more system metrics (CPU, memory, device count, etc.)
- Add refresh button
- Add real-time updates
- Add ability to open other utility windows (devices, scenes, etc.)
