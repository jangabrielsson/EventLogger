// HC3 Event Logger - Simplified Table View

// Event type to API endpoint mapping
const EVENT_TYPE_TO_API = {
    "AlarmPartitionArmedEvent": "/alarms/v1/partitions/<id>",
    "AlarmPartitionBreachedEvent": "/alarms/v1/partitions/<id>",
    "AlarmPartitionModifiedEvent": "/alarms/v1/partitions/<id>",
    "HomeArmStateChangedEvent": "/alarms/v1/partitions/<id>",
    "WeatherChangedEvent": "/weather",
    "GlobalVariableChangedEvent": "/globalVariables/<id>",
    "GlobalVariableAddedEvent": "/globalVariables/<id>",
    "GlobalVariableRemovedEvent": "/globalVariables/<id>",
    "DevicePropertyUpdatedEvent": "/devices/<id>",
    "CentralSceneEvent": "/devices/<id>",
    "SceneActivationEvent": "/devices/<id>",
    "AccessControlEvent": "/devices/<id>",
    "CustomEvent": "/customEvents/<id>",
    "PluginChangedViewEvent": "/devices/<id>",
    "DeviceRemovedEvent": "/devices/<id>",
    "DeviceChangedRoomEvent": "/devices/<id>",
    "DeviceCreatedEvent": "/devices/<id>",
    "DeviceModifiedEvent": "/devices/<id>",
    "PluginProcessCrashedEvent": "/devices/<id>",
    "SceneStartedEvent": "/scenes/<id>",
    "SceneFinishedEvent": "/scenes/<id>",
    "SceneRunningInstancesEvent": "/scenes/<id>",
    "SceneRemovedEvent": "/scenes/<id>",
    "SceneModifiedEvent": "/scenes/<id>",
    "SceneCreatedEvent": "/scenes/<id>",
    "ActiveProfileChangedEvent": "/profiles/<id>",
    "ClimateZoneChangedEvent": "/panels/climate/<id>",
    "ClimateZoneSetpointChangedEvent": "/panels/climate/<id>",
    "NotificationCreatedEvent": "/notificationCenter/<id>",
    "NotificationRemovedEvent": "/notificationCenter/<id>",
    "NotificationUpdatedEvent": "/notificationCenter/<id>",
    "RoomCreatedEvent": "/rooms/<id>",
    "RoomRemovedEvent": "/rooms/<id>",
    "RoomModifiedEvent": "/rooms/<id>",
    "SectionCreatedEvent": "/sections/<id>",
    "SectionRemovedEvent": "/sections/<id>",
    "SectionModifiedEvent": "/sections/<id>",
    "QuickAppFilesChangedEvent": "/devices/<id>",
    "DeviceActionRanEvent": "/devices/<id>"
};

// Priority order for JSON keys
const KEY_PRIORITY_ORDER = [
    "id", "name", "roomID", "view", "type", "baseType", 
    "enabled", "visible", "isPlugin", "parentId", "viewXml", 
    "hasUIView", "configXml", "interfaces", "properties"
];

// Custom JSON stringify with key ordering
function stringifyWithOrderedKeys(obj, indent = 2) {
    function sortKeys(obj) {
        if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
            return obj;
        }
        
        const sorted = {};
        const keys = Object.keys(obj);
        
        // Separate priority keys and other keys
        const priorityKeys = [];
        const otherKeys = [];
        
        keys.forEach(key => {
            const priorityIndex = KEY_PRIORITY_ORDER.indexOf(key);
            if (priorityIndex !== -1) {
                priorityKeys.push({ key, index: priorityIndex });
            } else {
                otherKeys.push(key);
            }
        });
        
        // Sort priority keys by their index
        priorityKeys.sort((a, b) => a.index - b.index);
        
        // Sort other keys alphabetically
        otherKeys.sort();
        
        // Build the sorted object
        priorityKeys.forEach(({ key }) => {
            sorted[key] = sortKeys(obj[key]);
        });
        
        otherKeys.forEach(key => {
            sorted[key] = sortKeys(obj[key]);
        });
        
        return sorted;
    }
    
    const sortedObj = sortKeys(obj);
    return JSON.stringify(sortedObj, null, indent);
}

// Wrapper for HTTP requests that works in Tauri
async function httpGet(url, headers = {}) {
    if (window.__TAURI__ && window.__TAURI__.http) {
        const { fetch: tauriFetch } = window.__TAURI__.http;
        
        const response = await tauriFetch(url, {
            method: 'GET',
            headers: headers,
            responseType: 1 // Text
        });
        
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText || '',
            headers: new Map(Object.entries(response.headers || {})),
            json: async () => {
                const text = await response.text();
                return JSON.parse(text);
            },
            text: () => response.text()
        };
    } else {
        return await fetch(url, { method: 'GET', headers: headers });
    }
}

class HC3EventLogger {
    constructor() {
        this.isConnected = false;
        this.eventCount = 0;
        this.autoScroll = true;
        this.eventTypes = new Set();
        this.selectedEventTypes = new Set();
        this.filteredIds = new Set(); // IDs that are selected for filtering
        this.sortColumn = 'time';
        this.sortDirection = 'desc'; // Start with newest first
        this.events = []; // Store all events for sorting
        this.needsSort = false; // Track if we need to re-sort on next render
        this.valueFilterPattern = null; // Regex pattern for filtering by value
        
        // Get configuration from environment
        this.config = {
            ip: null,
            username: null,
            password: null,
            protocol: 'http' // Default to http
        };
        
        this.initializeElements();
        this.bindEvents();
        this.loadConfig();
    }

    initializeElements() {
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.clearBtn = document.getElementById('clearBtn');
        this.clearFiltersBtn = document.getElementById('clearFiltersBtn');
        this.autoScrollCheckbox = document.getElementById('autoScroll');
        this.eventCountElement = document.getElementById('eventCount');
        this.eventTableBody = document.getElementById('eventTableBody');
        this.selectAllEvents = document.getElementById('selectAllEvents');
        this.eventTypeFilters = document.getElementById('eventTypeFilters');
        this.valueFilterInput = document.getElementById('valueFilter');
        this.idFilterButton = document.getElementById('idFilterButton');
        this.idFilterMenu = document.getElementById('idFilterMenu');
        this.idFilterList = document.getElementById('idFilterList');
        this.selectAllIds = document.getElementById('selectAllIds');
        
        // Dialog elements
        this.idInfoDialog = document.getElementById('idInfoDialog');
        this.dialogOverlay = document.getElementById('dialogOverlay');
        this.dialogTitle = document.getElementById('dialogTitle');
        this.dialogJson = document.getElementById('dialogJson');
        this.dialogClose = document.getElementById('dialogClose');
        this.dialogCloseBtn = document.getElementById('dialogCloseBtn');
        this.dialogCopyBtn = document.getElementById('dialogCopyBtn');
    }

    bindEvents() {
        this.clearBtn.addEventListener('click', () => this.clearLog());
        this.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        this.autoScrollCheckbox.addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });
        this.selectAllEvents.addEventListener('change', (e) => {
            this.toggleAllEventTypes(e.target.checked);
        });
        
        // Setup ID filter dropdown
        this.idFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleIdFilterMenu();
        });
        
        this.selectAllIds.addEventListener('change', (e) => {
            this.toggleAllIds(e.target.checked);
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.idFilterMenu.contains(e.target) && !this.idFilterButton.contains(e.target)) {
                this.closeIdFilterMenu();
            }
        });
        
        // Dialog event handlers
        this.dialogClose.addEventListener('click', () => this.closeDialog());
        this.dialogCloseBtn.addEventListener('click', () => this.closeDialog());
        this.dialogOverlay.addEventListener('click', () => this.closeDialog());
        this.dialogCopyBtn.addEventListener('click', () => this.copyDialogJson());
        
        // Setup value filter input with debouncing
        let filterTimeout;
        this.valueFilterInput.addEventListener('input', (e) => {
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => {
                this.updateValueFilter(e.target.value);
            }, 300); // 300ms debounce
        });
        
        // Initialize column widths as fixed pixels
        this.initializeColumnWidths();
        
        // Setup column resizing
        this.setupColumnResizing();
        
        // Setup column sorting
        this.setupColumnSorting();
        
        // Set initial sort indicator
        this.updateSortIndicators();
    }
    
    initializeColumnWidths() {
        const table = document.querySelector('.event-table');
        const allColumns = Array.from(table.querySelectorAll('thead th'));
        
        // Lock in current widths as fixed pixels
        allColumns.forEach(col => {
            const width = col.offsetWidth;
            col.style.width = width + 'px';
            col.style.minWidth = width + 'px';
            col.style.maxWidth = width + 'px';
        });
        
        // Store the widths for later use
        this.columnWidths = allColumns.map(col => col.offsetWidth);
    }
    
    clearFilters() {
        // Clear ID filters
        this.filteredIds.clear();
        
        // Check all ID filter checkboxes
        const idCheckboxes = this.idFilterList.querySelectorAll('input[type="checkbox"]');
        idCheckboxes.forEach(cb => {
            cb.checked = true;
        });
        this.selectAllIds.checked = true;
        this.updateIdFilterButtonLabel();
        
        // Clear event type filters
        this.selectedEventTypes.clear();
        
        // Check all event type checkboxes
        const checkboxes = this.eventTypeFilters.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
        });
        this.selectAllEvents.checked = true;
        
        // Clear value filter
        this.valueFilterInput.value = '';
        this.valueFilterPattern = null;
        this.valueFilterInput.classList.remove('filter-error');
        
        // Re-apply filters (which now shows everything)
        this.filterDisplayedEvents();
    }
    
    toggleIdFilterMenu() {
        this.idFilterMenu.classList.toggle('show');
        this.idFilterButton.classList.toggle('active');
    }
    
    closeIdFilterMenu() {
        this.idFilterMenu.classList.remove('show');
        this.idFilterButton.classList.remove('active');
    }
    
    toggleAllIds(selectAll) {
        const checkboxes = this.idFilterList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = selectAll;
        });
        
        if (selectAll) {
            this.filteredIds.clear();
        } else {
            // Add all IDs to filtered set (meaning hide all)
            checkboxes.forEach(cb => {
                this.filteredIds.add(cb.value);
            });
        }
        
        this.updateIdFilterButtonLabel();
        this.filterDisplayedEvents();
    }
    
    addIdToFilter(id) {
        // Check if this ID already exists in the filter list
        const existingCheckbox = this.idFilterList.querySelector(`input[value="${id}"]`);
        if (existingCheckbox) {
            return;
        }
        
        // Create new checkbox for this ID
        const label = document.createElement('label');
        label.className = 'id-filter-item';
        label.innerHTML = `
            <input type="checkbox" value="${id}" checked>
            <span>${id}</span>
        `;
        
        const checkbox = label.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Remove from filtered set (show this ID)
                this.filteredIds.delete(id);
            } else {
                // Add to filtered set (hide this ID)
                this.filteredIds.add(id);
            }
            this.updateSelectAllIdsState();
            this.updateIdFilterButtonLabel();
            this.filterDisplayedEvents();
        });
        
        // Insert in sorted order
        const items = Array.from(this.idFilterList.querySelectorAll('.id-filter-item'));
        let inserted = false;
        for (const item of items) {
            const itemId = item.querySelector('input').value;
            if (String(id).localeCompare(String(itemId)) < 0) {
                this.idFilterList.insertBefore(label, item);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this.idFilterList.appendChild(label);
        }
    }
    
    updateSelectAllIdsState() {
        const allCheckboxes = this.idFilterList.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
        this.selectAllIds.checked = allChecked;
    }
    
    updateIdFilterButtonLabel() {
        const allCheckboxes = this.idFilterList.querySelectorAll('input[type="checkbox"]');
        const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
        const totalCount = allCheckboxes.length;
        
        const label = this.idFilterButton.querySelector('.id-filter-label');
        if (checkedCount === 0) {
            label.textContent = 'No IDs';
        } else if (checkedCount === totalCount) {
            label.textContent = 'All IDs';
        } else {
            label.textContent = `${checkedCount} of ${totalCount}`;
        }
    }
    
    updateValueFilter(filterText) {
        if (!filterText || filterText.trim() === '') {
            // Empty filter matches everything
            this.valueFilterPattern = null;
            this.valueFilterInput.classList.remove('filter-error');
        } else {
            try {
                // Try to compile the regex
                this.valueFilterPattern = new RegExp(filterText, 'i'); // case-insensitive
                this.valueFilterInput.classList.remove('filter-error');
            } catch (error) {
                // Invalid regex
                console.warn('Invalid regex pattern:', error);
                this.valueFilterInput.classList.add('filter-error');
                this.valueFilterPattern = null;
            }
        }
        
        // Re-apply filters with new pattern
        this.filterDisplayedEvents();
    }

    updateSortIndicators() {
        const sortableHeaders = document.querySelectorAll('th.sortable');
        
        sortableHeaders.forEach(header => {
            header.classList.remove('sorted');
            const indicator = header.querySelector('.sort-indicator');
            if (indicator) {
                indicator.textContent = '↕';
            }
        });
        
        if (this.sortColumn) {
            const activeHeader = document.querySelector(`th[data-sort="${this.sortColumn}"]`);
            if (activeHeader) {
                activeHeader.classList.add('sorted');
                const indicator = activeHeader.querySelector('.sort-indicator');
                if (indicator) {
                    indicator.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
                }
            }
        }
    }

    setupColumnSorting() {
        const sortableHeaders = document.querySelectorAll('th.sortable');
        
        sortableHeaders.forEach(th => {
            th.addEventListener('click', (e) => {
                // Don't sort if clicking on resize handle
                if (e.target.classList.contains('resize-handle')) {
                    return;
                }
                
                const column = th.dataset.sort;
                
                // Toggle sort direction if clicking same column
                if (this.sortColumn === column) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = column;
                    this.sortDirection = 'asc';
                }
                
                // Update UI indicators
                this.updateSortIndicators();
                
                // Mark that sorting needs to happen
                this.needsSort = true;
                
                // Re-render table with sorted events
                this.renderTable();
            });
        });
    }

    setupColumnResizing() {
        const table = document.querySelector('.event-table');
        const resizableColumns = table.querySelectorAll('th.resizable');
        
        resizableColumns.forEach(th => {
            const handle = th.querySelector('.resize-handle');
            let startX, startWidth, allHeaderColumns, startWidths, columnIndex;
            
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startX = e.pageX;
                startWidth = th.offsetWidth;
                
                // Store all header columns and their starting widths
                allHeaderColumns = Array.from(table.querySelectorAll('thead th'));
                columnIndex = allHeaderColumns.indexOf(th);
                startWidths = allHeaderColumns.map(col => col.offsetWidth);
                
                // Convert all columns to fixed pixel widths to prevent redistribution
                allHeaderColumns.forEach((col, idx) => {
                    const width = startWidths[idx];
                    col.style.width = width + 'px';
                    col.style.minWidth = width + 'px';
                    col.style.maxWidth = width + 'px';
                });
                
                // Also lock body row widths
                this.updateBodyColumnWidths(startWidths);
                
                const onMouseMove = (e) => {
                    const delta = e.pageX - startX;
                    const newWidth = startWidth + delta;
                    const minWidth = 50; // Minimum column width
                    
                    if (newWidth >= minWidth) {
                        // Update the resized header column
                        th.style.width = newWidth + 'px';
                        th.style.minWidth = newWidth + 'px';
                        th.style.maxWidth = newWidth + 'px';
                        
                        // Update all body cells in the same column
                        const rows = table.querySelectorAll('tbody tr');
                        rows.forEach(row => {
                            const cells = row.querySelectorAll('td');
                            if (cells[columnIndex]) {
                                cells[columnIndex].style.width = newWidth + 'px';
                                cells[columnIndex].style.minWidth = newWidth + 'px';
                                cells[columnIndex].style.maxWidth = newWidth + 'px';
                            }
                        });
                    }
                };
                
                const onMouseUp = () => {
                    // Update stored column widths after resize
                    const allColumns = Array.from(table.querySelectorAll('thead th'));
                    this.columnWidths = allColumns.map(col => col.offsetWidth);
                    
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }
    
    updateBodyColumnWidths(widths) {
        const table = document.querySelector('.event-table');
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, idx) => {
                if (widths[idx]) {
                    cell.style.width = widths[idx] + 'px';
                    cell.style.minWidth = widths[idx] + 'px';
                    cell.style.maxWidth = widths[idx] + 'px';
                }
            });
        });
    }

    async loadConfig() {
        // Try to get config from environment variables via Tauri
        if (window.__TAURI__) {
            try {
                const { invoke } = window.__TAURI__.core;
                const config = await invoke('get_hc3_config');
                
                console.log('Config from environment:', {
                    host: config.host || 'NOT SET',
                    user: config.user || 'NOT SET',
                    password: config.password ? 'SET' : 'NOT SET',
                    protocol: config.protocol || 'NOT SET (defaults to http)'
                });

                if (!config.host || !config.user || !config.password) {
                    this.showConfigError();
                    return;
                }
                
                this.config.ip = config.host;
                this.config.username = config.user;
                this.config.password = config.password;
                this.config.protocol = config.protocol || 'http'; // Default to http if not specified
                
                // Save to localStorage so other windows can access
                localStorage.setItem('hc3Host', this.config.ip);
                localStorage.setItem('hc3User', this.config.username);
                localStorage.setItem('hc3Password', this.config.password);
                localStorage.setItem('hc3Protocol', this.config.protocol);
                
                console.log('Config loaded:', {
                    ip: this.config.ip,
                    username: this.config.username,
                    password: '***',
                    protocol: this.config.protocol
                });
                
                // Auto-connect on startup
                this.connect();
            } catch (error) {
                console.error('Failed to load config:', error);
                this.updateStatus('', 'Configuration Error');
            }
        }
    }

    showConfigError() {
        const errorHtml = `
            <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 1.5rem; margin: 2rem;">
                <h2 style="color: #856404; margin-bottom: 1rem;">⚠️ HC3 Credentials Not Configured</h2>
                <p style="color: #856404; margin-bottom: 0.75rem; line-height: 1.6;">
                    The HC3 connection settings have not been configured. 
                    To connect to your HC3 controller, you need to set up your credentials.
                </p>
                
                <div style="background: white; border-left: 4px solid #ffc107; padding: 1rem; margin: 1rem 0; font-family: monospace; font-size: 0.9rem;">
                    <strong style="display: block; margin-bottom: 0.5rem;">Option 1: Environment Variables</strong>
                    Set these before launching the app:<br><br>
                    <code style="background: #f5f5f5; padding: 2px 6px;">HC3_HOST</code> - HC3 IP address (e.g., 192.168.1.57)<br>
                    <code style="background: #f5f5f5; padding: 2px 6px;">HC3_USER</code> - HC3 username (e.g., admin)<br>
                    <code style="background: #f5f5f5; padding: 2px 6px;">HC3_PASSWORD</code> - HC3 password
                </div>
                
                <div style="background: white; border-left: 4px solid #ffc107; padding: 1rem; margin: 1rem 0; font-family: monospace; font-size: 0.9rem;">
                    <strong style="display: block; margin-bottom: 0.5rem;">Option 2: .env File (Recommended)</strong>
                    Create a <code style="background: #f5f5f5; padding: 2px 6px;">~/.env</code> file in your home directory:<br><br>
                    <strong>macOS/Linux:</strong> <code style="background: #f5f5f5; padding: 2px 6px;">nano ~/.env</code><br>
                    <strong>Windows:</strong> <code style="background: #f5f5f5; padding: 2px 6px;">notepad %USERPROFILE%\\.env</code><br><br>
                    Content:<br>
                    HC3_HOST=192.168.1.57<br>
                    HC3_USER=admin<br>
                    HC3_PASSWORD=yourpassword<br>
                    HC3_PROTOCOL=http
                </div>
                
                <div style="background: white; border-left: 4px solid #ffc107; padding: 1rem; margin: 1rem 0; font-family: monospace; font-size: 0.9rem;">
                    <strong style="display: block; margin-bottom: 0.5rem;">Important:</strong>
                    Variable names must be exactly:<br>
                    • <code style="background: #f5f5f5; padding: 2px 6px;">HC3_HOST</code> (not HC3_URL)<br>
                    • <code style="background: #f5f5f5; padding: 2px 6px;">HC3_USER</code> (not HC3_USERNAME)<br>
                    • <code style="background: #f5f5f5; padding: 2px 6px;">HC3_PASSWORD</code><br>
                    • <code style="background: #f5f5f5; padding: 2px 6px;">HC3_PROTOCOL</code> (optional, defaults to http)<br><br>
                    HC3_HOST should be just the IP address (no http://)<br>
                    HC3_PROTOCOL should be either 'http' or 'https'
                </div>
                
                <p style="margin-top: 1rem; color: #856404;">
                    <strong>Note:</strong> After setting credentials, restart the application.
                </p>
            </div>
        `;
        
        // Show in main content area
        const contentElement = document.querySelector('.content');
        if (contentElement) {
            contentElement.innerHTML = errorHtml;
        } else {
            console.error('Content element not found for showing config error');
        }
        this.updateStatus('', 'Credentials Not Configured');
    }

    updateStatus(indicatorClass, text) {
        this.statusIndicator.className = `status-indicator ${indicatorClass}`;
        this.statusText.textContent = text;
    }

    async connect() {
        const { ip, username, password, protocol } = this.config;
        
        if (!ip || !username || !password) {
            this.updateStatus('', 'Missing configuration');
            return;
        }

        try {
            this.updateStatus('', 'Connecting...');
            
            // Test connection
            const testUrl = `${protocol}://${ip}/api/refreshStates?last=0`;
            const credentials = btoa(`${username}:${password}`);
            
            const response = await httpGet(testUrl, {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Connection successful, start event stream
            this.isConnected = true;
            this.updateStatus('connected', 'Connected');
            this.startEventStream(ip, username, password, protocol);

        } catch (error) {
            console.error('Connection error:', error);
            this.updateStatus('', `Connection Failed: ${error.message}`);
        }
    }

    startEventStream(ip, username, password, protocol) {
        const credentials = btoa(`${username}:${password}`);
        let lastEventId = 0;
        
        const pollEvents = async () => {
            if (!this.isConnected) return;

            try {
                const url = `${protocol}://${ip}/api/refreshStates?last=${lastEventId}&timeout=30`;
                const response = await httpGet(url, {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/json'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                
                if (data.last) {
                    lastEventId = data.last;
                }

                if (data.events && Array.isArray(data.events)) {
                    data.events.forEach(event => {
                        this.processEvent(event);
                    });
                }

                // Poll again immediately (the server will hold the connection for up to 30s)
                pollEvents();

            } catch (error) {
                if (this.isConnected) {
                    console.error('Polling error:', error);
                    this.updateStatus('', 'Connection Lost');
                    this.isConnected = false;
                }
            }
        };

        pollEvents();
    }

    processEvent(event) {
        const eventType = event.type || 'Unknown';
        
        // Add event type to the set
        if (!this.eventTypes.has(eventType)) {
            this.eventTypes.add(eventType);
            this.addEventTypeFilter(eventType);
            // New event types start unchecked (filtered out)
            this.selectedEventTypes.add(eventType);
        }
        
        // Extract and track ID for filter dropdown
        let id = event.id || event.deviceId;
        if (!id && event.data) {
            id = event.data.id || event.data.deviceId || event.data.deviceID || event.data.variableName;
        }
        if (id && id !== '-') {
            this.addIdToFilter(String(id));
        }
        
        // Store event for sorting
        this.events.push(event);
        
        // Increment count
        this.eventCount++;
        this.eventCountElement.textContent = this.eventCount;
        
        // Only re-render entire table if auto-scroll is on or sorting was just changed
        // This prevents the list from jumping when user is reading with auto-scroll off
        if (this.sortColumn && (this.autoScroll || this.needsSort)) {
            this.renderTable();
            this.needsSort = false;
        } else {
            // Otherwise just add to bottom (faster and doesn't disturb scroll position)
            this.addEventToTable(event, false); // false = don't add to events array again
        }
    }
    
    renderTable() {
        // Sort events if a sort column is selected
        let sortedEvents = [...this.events];
        
        if (this.sortColumn) {
            sortedEvents.sort((a, b) => {
                let aVal, bVal;
                
                switch(this.sortColumn) {
                    case 'event':
                        aVal = (a.type || 'Unknown').toLowerCase();
                        bVal = (b.type || 'Unknown').toLowerCase();
                        break;
                    case 'time':
                        aVal = a.timestamp || a.created || 0;
                        bVal = b.timestamp || b.created || 0;
                        break;
                    case 'id':
                        aVal = a.id || a.deviceId || (a.data && (a.data.id || a.data.deviceId || a.data.deviceID || a.data.variableName)) || '';
                        bVal = b.id || b.deviceId || (b.data && (b.data.id || b.data.deviceId || b.data.deviceID || b.data.variableName)) || '';
                        // Convert to string for comparison
                        aVal = String(aVal);
                        bVal = String(bVal);
                        break;
                }
                
                if (this.sortDirection === 'asc') {
                    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                } else {
                    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
                }
            });
        }
        
        // Save current scroll position and height if auto-scroll is disabled
        const scrollContainer = this.eventTableBody.parentElement;
        const savedScrollTop = this.autoScroll ? null : scrollContainer.scrollTop;
        const oldScrollHeight = this.autoScroll ? null : scrollContainer.scrollHeight;
        
        // Clear and re-render table
        this.eventTableBody.innerHTML = '';
        sortedEvents.forEach(event => {
            this.addEventToTable(event, false); // false = don't add to events array again
        });
        
        // Restore scroll position or auto-scroll to bottom
        if (this.autoScroll) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        } else if (savedScrollTop !== null && oldScrollHeight !== null) {
            // Adjust scroll position to compensate for content added at the top
            const newScrollHeight = scrollContainer.scrollHeight;
            const heightDifference = newScrollHeight - oldScrollHeight;
            scrollContainer.scrollTop = savedScrollTop + heightDifference;
        }
    }

    stripEventSuffix(eventType) {
        return eventType.endsWith('Event') ? eventType.slice(0, -5) : eventType;
    }

    addEventTypeFilter(eventType) {
        const displayName = this.stripEventSuffix(eventType);
        const label = document.createElement('label');
        label.className = 'filter-item';
        label.innerHTML = `
            <input type="checkbox" value="${eventType}">
            <span>${displayName}</span>
        `;
        
        // Start new event types as unchecked (filtered out)
        this.selectedEventTypes.add(eventType);
        
        const checkbox = label.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.selectedEventTypes.delete(eventType);
            } else {
                this.selectedEventTypes.add(eventType);
            }
            this.updateSelectAllState();
            this.filterDisplayedEvents();
        });
        
        this.eventTypeFilters.appendChild(label);
    }

    toggleAllEventTypes(selectAll) {
        const checkboxes = this.eventTypeFilters.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = selectAll;
        });
        
        if (selectAll) {
            this.selectedEventTypes.clear();
        } else {
            this.eventTypes.forEach(type => this.selectedEventTypes.add(type));
        }
        this.filterDisplayedEvents();
    }

    updateSelectAllState() {
        const allChecked = this.eventTypeFilters.querySelectorAll('input[type="checkbox"]:checked').length === this.eventTypes.size;
        this.selectAllEvents.checked = allChecked;
    }

    filterDisplayedEvents() {
        const rows = this.eventTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const eventType = row.dataset.eventType;
            const eventId = row.dataset.eventId;
            
            // Check event type filter
            const eventTypeMatch = this.selectedEventTypes.size === 0 || !this.selectedEventTypes.has(eventType);
            
            // Check ID filter (if no IDs in filteredIds, show all; if ID is in filteredIds, hide it)
            const idMatch = this.filteredIds.size === 0 || !this.filteredIds.has(eventId);
            
            // Check value filter (if pattern exists, test against value content)
            let valueMatch = true;
            if (this.valueFilterPattern) {
                const valueCell = row.querySelector('.event-value');
                if (valueCell) {
                    // Get the display text (formatted value)
                    // Remove the tooltip content from the text
                    const tooltipEl = valueCell.querySelector('.value-tooltip');
                    let displayText = valueCell.textContent || '';
                    if (tooltipEl) {
                        // Remove tooltip text from display text
                        displayText = displayText.replace(tooltipEl.textContent, '').trim();
                    }
                    
                    // Test pattern against the display value only
                    valueMatch = this.valueFilterPattern.test(displayText);
                }
            }
            
            // Show row only if all filters pass
            if (eventTypeMatch && idMatch && valueMatch) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    addEventToTable(event, addToArray = true) {
        const row = document.createElement('tr');
        
        const eventType = event.type || 'Unknown';
        const displayType = this.stripEventSuffix(eventType);
        const time = this.formatTime(event.timestamp || event.created);
        
        // Try to get ID from multiple sources
        let id = event.id || event.deviceId;
        if (!id && event.data) {
            id = event.data.id || event.data.deviceId || event.data.deviceID || event.data.variableName;
        }
        id = id || '-';
        
        const { shortValue, fullValue } = this.formatValue(event);
        
        // Don't escape shortValue if it contains HTML formatting (for colors/emojis)
        const displayValue = shortValue.includes('<span') ? shortValue : this.escapeHtml(shortValue);
        
        row.innerHTML = `
            <td class="col-event"><span class="event-type clickable" title="Click to copy full event JSON">${displayType}</span></td>
            <td class="col-time"><span class="event-time">${time}</span></td>
            <td class="col-id"><span class="event-id" data-id="${id}">${id}</span></td>
            <td class="col-value"><span class="event-value">${displayValue}<div class="value-tooltip">${this.escapeHtml(fullValue)}</div></span></td>
        `;
        
        row.dataset.eventType = eventType;
        row.dataset.eventId = String(id);
        
        // Store the full event data on the row for later access
        row.eventData = event;
        
        // Add click handler to Event cell to copy JSON
        const eventSpan = row.querySelector('.event-type');
        eventSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyEventToClipboard(event);
        });
        
        // Add click handler to ID cell to show info dialog
        const idSpan = row.querySelector('.event-id');
        if (id !== '-' && EVENT_TYPE_TO_API[eventType]) {
            idSpan.classList.add('clickable');
            idSpan.title = 'Click to view details';
            idSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showIdInfoDialog(id, eventType);
            });
        }
        
        // Apply filter immediately for new events
        const eventTypeMatch = this.selectedEventTypes.size === 0 || !this.selectedEventTypes.has(eventType);
        const idMatch = this.filteredIds.size === 0 || !this.filteredIds.has(String(id));
        
        // Check value filter
        let valueMatch = true;
        if (this.valueFilterPattern) {
            // Test pattern against display value (formatted), or full value if no formatting
            const testValue = shortValue || fullValue;
            valueMatch = this.valueFilterPattern.test(testValue);
        }
        
        if (!eventTypeMatch || !idMatch || !valueMatch) {
            row.style.display = 'none';
        }
        
        this.eventTableBody.appendChild(row);
        
        // Apply current column widths to new row
        this.applyColumnWidthsToRow(row);
        
        if (addToArray) {
            this.eventCount++;
            this.eventCountElement.textContent = this.eventCount;
        }
        
        if (this.autoScroll && addToArray) {
            this.eventTableBody.parentElement.scrollTop = this.eventTableBody.parentElement.scrollHeight;
        }
    }
    
    applyColumnWidthsToRow(row) {
        const cells = row.querySelectorAll('td');
        
        // Use stored column widths if available, otherwise get from headers
        if (this.columnWidths) {
            cells.forEach((cell, idx) => {
                if (this.columnWidths[idx]) {
                    const width = this.columnWidths[idx];
                    cell.style.width = width + 'px';
                    cell.style.minWidth = width + 'px';
                    cell.style.maxWidth = width + 'px';
                }
            });
        } else {
            const table = document.querySelector('.event-table');
            const headerColumns = table.querySelectorAll('thead th');
            cells.forEach((cell, idx) => {
                if (headerColumns[idx]) {
                    const width = headerColumns[idx].offsetWidth;
                    cell.style.width = width + 'px';
                    cell.style.minWidth = width + 'px';
                    cell.style.maxWidth = width + 'px';
                }
            });
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatValueForDisplay(event) {
        const eventType = event.type || 'Unknown';
        const data = event.data || {};
        
        // Custom formatters for specific event types
        switch(eventType) {
            case 'DevicePropertyUpdatedEvent':
                return this.formatDevicePropertyUpdate(data);
            
            case 'PluginChangedViewEvent':
                return this.formatPluginChangedView(data);
            
            case 'DeviceActionRanEvent':
                return this.formatDeviceActionRan(data);
            
            case 'PluginProcessCrashedEvent':
                return this.formatPluginProcessCrashed(data);
            
            case 'WeatherChangedEvent':
                return this.formatWeatherChanged(data);
            
            case 'GlobalVariableAddedEvent':
                return this.formatGlobalVariableAdded(data);
            
            case 'GlobalVariableChangedEvent':
                return this.formatGlobalVariableChanged(data);
            
            case 'GlobalVariableRemovedEvent':
                return this.formatGlobalVariableRemoved(data);
            
            // Add more event type formatters here as needed
            // case 'OtherEventType':
            //     return this.formatOtherEvent(data);
            
            default:
                // Fall back to generic JSON formatting
                return this.formatGenericValue(event);
        }
    }
    
    formatPluginChangedView(data) {
        const componentName = data.componentName || '';
        const propertyName = data.propertyName || '';
        const newValue = data.newValue !== undefined ? data.newValue : '';
        
        return `${componentName}/${propertyName}/${newValue}`;
    }
    
    formatDeviceActionRan(data) {
        const actionName = data.actionName || '';
        const args = data.args || [];
        
        // Format args as comma-separated values
        const argsStr = Array.isArray(args) ? args.join(', ') : String(args);
        
        return `${actionName}(${argsStr})`;
    }
    
    formatPluginProcessCrashed(data) {
        const error = data.error || 'Unknown error';
        
        return error;
    }
    
    formatWeatherChanged(data) {
        const change = data.change || '';
        const newValue = data.newValue !== undefined ? data.newValue : '';
        
        return `${change}: ${newValue}`;
    }
    
    formatGlobalVariableAdded(data) {
        // For added variables, show value or newValue
        return data.value !== undefined ? data.value : (data.newValue !== undefined ? data.newValue : '');
    }
    
    formatGlobalVariableChanged(data) {
        // For changed variables, show the new value
        return data.newValue !== undefined ? data.newValue : '';
    }
    
    formatGlobalVariableRemoved(data) {
        // For removed variables, show nothing
        return '';
    }
    
    formatDevicePropertyUpdate(data) {
        const propName = data.property || data.propertyName;
        const value = data.value !== undefined ? data.value : data.newValue;
        
        // If it's an 'icon' property, show the newValue.path
        if (propName === 'icon') {
            const iconPath = data.newValue && data.newValue.path ? data.newValue.path : (typeof data.newValue === 'string' ? data.newValue : value);
            return `🖼️ ${propName}: ${iconPath}`;
        }
        
        // If it's 'lastChanged' or 'lastBreached', format as date
        if (propName === 'lastChanged' || propName === 'lastBreached') {
            const date = new Date(value * 1000);
            const formattedDate = date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            return `🕐 ${propName}: ${formattedDate}`;
        }
        
        // If it's a 'value' or 'state' property, format specially
        if (propName === 'value' || propName === 'state') {
            // Determine if value is "good" (green) or "bad" (red)
            let isGood = false;
            if (typeof value === 'boolean') {
                isGood = value;
            } else if (typeof value === 'number') {
                isGood = value > 0;
            }
            
            const color = isGood ? 'green' : 'red';
            const emoji = isGood ? '✓' : '✗';
            
            return `<span style="color: ${color}; font-weight: 600;">${emoji} ${propName}: ${value}</span>`;
        }
        
        // For other properties, show property name and value
        if (propName && value !== undefined) {
            return `${propName}: ${value}`;
        }
        
        // Fallback to JSON if structure doesn't match expected format
        return JSON.stringify(data);
    }
    
    formatGenericValue(event) {
        // Create a clean object with relevant fields
        const value = {};
        
        // Common fields to exclude from value display
        const excludeFields = ['type', 'timestamp', 'created', 'id', 'deviceId'];
        
        Object.keys(event).forEach(key => {
            if (!excludeFields.includes(key)) {
                value[key] = event[key];
            }
        });
        
        // If there's only one field left, show it directly
        const keys = Object.keys(value);
        if (keys.length === 1 && typeof value[keys[0]] !== 'object') {
            return String(value[keys[0]]);
        }
        
        return JSON.stringify(value);
    }
    
    formatValue(event) {
        // Get display-formatted value (may include HTML)
        const shortValue = this.formatValueForDisplay(event);
        
        // Get full JSON for tooltip (always plain JSON)
        const value = {};
        const excludeFields = ['type', 'timestamp', 'created', 'id', 'deviceId'];
        
        Object.keys(event).forEach(key => {
            if (!excludeFields.includes(key)) {
                value[key] = event[key];
            }
        });
        
        const keys = Object.keys(value);
        let fullValue;
        if (keys.length === 1 && typeof value[keys[0]] !== 'object') {
            fullValue = String(value[keys[0]]);
        } else {
            fullValue = JSON.stringify(value, null, 2);
        }
        
        return {
            shortValue: shortValue,
            fullValue: fullValue
        };
    }

    clearLog() {
        this.eventTableBody.innerHTML = '';
        this.events = [];
        this.eventCount = 0;
        this.eventCountElement.textContent = '0';
        this.filteredIds.clear();
    }
    
    async copyEventToClipboard(event) {
        const jsonString = JSON.stringify(event, null, 2);
        
        try {
            // Try to use the Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(jsonString);
                this.showCopyNotification('Event JSON copied to clipboard!');
            } else {
                // Fallback for older browsers or Tauri
                const textarea = document.createElement('textarea');
                textarea.value = jsonString;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.showCopyNotification('Event JSON copied to clipboard!');
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showCopyNotification('Failed to copy to clipboard', true);
        }
    }
    
    showCopyNotification(message, isError = false) {
        // Create or reuse notification element
        let notification = document.getElementById('copyNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'copyNotification';
            notification.className = 'copy-notification';
            document.body.appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = 'copy-notification' + (isError ? ' error' : ' success');
        notification.style.display = 'block';
        
        // Hide after 2 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 2000);
    }
    
    async showIdInfoDialog(id, eventType) {
        // Get API endpoint for this event type
        const apiPath = EVENT_TYPE_TO_API[eventType];
        if (!apiPath) {
            console.warn('No API mapping for event type:', eventType);
            return;
        }
        
        // Build the full URL
        let url = `${this.config.protocol}://${this.config.ip}/api${apiPath}`;
        
        // Replace <id> placeholder (unless it's WeatherChangedEvent which doesn't use ID)
        if (eventType !== 'WeatherChangedEvent') {
            url = url.replace('<id>', id);
        }
        
        // Show dialog with loading state
        this.dialogTitle.textContent = `${eventType} - ID: ${id}`;
        this.dialogJson.textContent = 'Loading...';
        this.idInfoDialog.classList.add('show');
        
        // Fetch the data
        try {
            const credentials = btoa(`${this.config.username}:${this.config.password}`);
            const response = await httpGet(url, {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Store the JSON for copying (with custom key ordering)
            this.currentDialogJson = stringifyWithOrderedKeys(data, 2);
            
            // Display in dialog
            this.dialogJson.textContent = this.currentDialogJson;
            
        } catch (error) {
            console.error('Failed to fetch ID info:', error);
            this.dialogJson.textContent = `Error: ${error.message}`;
            this.currentDialogJson = null;
        }
    }
    
    closeDialog() {
        this.idInfoDialog.classList.remove('show');
        this.currentDialogJson = null;
    }
    
    async copyDialogJson() {
        if (!this.currentDialogJson) {
            this.showCopyNotification('No JSON to copy', true);
            return;
        }
        
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(this.currentDialogJson);
                this.showCopyNotification('JSON copied to clipboard!');
            } else {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = this.currentDialogJson;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.showCopyNotification('JSON copied to clipboard!');
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showCopyNotification('Failed to copy to clipboard', true);
        }
    }
}

// Initialize the logger when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.logger = new HC3EventLogger();
});

