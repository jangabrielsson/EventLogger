// HC3 Event Logger - Simplified Table View

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
        
        // Get configuration from environment
        this.config = {
            ip: null,
            username: null,
            password: null
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
        
        // Setup column resizing
        this.setupColumnResizing();
        
        // Setup column sorting
        this.setupColumnSorting();
        
        // Set initial sort indicator
        this.updateSortIndicators();
    }
    
    clearFilters() {
        // Clear ID filters
        this.filteredIds.clear();
        
        // Update ID styling
        document.querySelectorAll('.event-id.filtered').forEach(el => {
            el.classList.remove('filtered');
        });
        
        // Clear event type filters
        this.selectedEventTypes.clear();
        
        // Check all event type checkboxes
        const checkboxes = this.eventTypeFilters.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
        });
        this.selectAllEvents.checked = true;
        
        // Re-apply filters (which now shows everything)
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
            let startX, startWidth;
            
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startX = e.pageX;
                startWidth = th.offsetWidth;
                
                const onMouseMove = (e) => {
                    const newWidth = startWidth + (e.pageX - startX);
                    const minWidth = 50; // Minimum column width
                    
                    if (newWidth >= minWidth) {
                        // Update both th and corresponding td elements
                        th.style.width = newWidth + 'px';
                        const columnClass = Array.from(th.classList).find(cls => cls.startsWith('col-'));
                        if (columnClass) {
                            const tds = table.querySelectorAll(`.${columnClass}`);
                            tds.forEach(td => {
                                td.style.width = newWidth + 'px';
                            });
                        }
                    }
                };
                
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }

    async loadConfig() {
        // Try to get config from Tauri command line args or environment
        if (window.__TAURI__) {
            try {
                // For now, use hardcoded values from .env
                // In production, these would be passed via CLI args
                this.config.ip = '192.168.1.57';
                this.config.username = 'admin';
                this.config.password = 'Admin1477!';
                
                console.log('Config loaded:', {
                    ip: this.config.ip,
                    username: this.config.username,
                    password: '***'
                });
                
                // Auto-connect on startup
                this.connect();
            } catch (error) {
                console.error('Failed to load config:', error);
                this.updateStatus('', 'Configuration Error');
            }
        }
    }

    updateStatus(indicatorClass, text) {
        this.statusIndicator.className = `status-indicator ${indicatorClass}`;
        this.statusText.textContent = text;
    }

    async connect() {
        const { ip, username, password } = this.config;
        
        if (!ip || !username || !password) {
            this.updateStatus('', 'Missing configuration');
            return;
        }

        try {
            this.updateStatus('', 'Connecting...');
            
            // Test connection
            const testUrl = `http://${ip}/api/refreshStates?last=0`;
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
            this.startEventStream(ip, username, password);

        } catch (error) {
            console.error('Connection error:', error);
            this.updateStatus('', `Connection Failed: ${error.message}`);
        }
    }

    startEventStream(ip, username, password) {
        const credentials = btoa(`${username}:${password}`);
        let lastEventId = 0;
        
        const pollEvents = async () => {
            if (!this.isConnected) return;

            try {
                const url = `http://${ip}/api/refreshStates?last=${lastEventId}&timeout=30`;
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
        
        // Store event for sorting
        this.events.push(event);
        
        // Increment count
        this.eventCount++;
        this.eventCountElement.textContent = this.eventCount;
        
        // If sorting is active, re-render entire table to maintain sort order
        if (this.sortColumn) {
            this.renderTable();
        } else {
            // Otherwise just add to bottom (faster for large event lists)
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
                        aVal = a.id || a.deviceId || (a.data && (a.data.id || a.data.deviceId || a.data.deviceID)) || '';
                        bVal = b.id || b.deviceId || (b.data && (b.data.id || b.data.deviceId || b.data.deviceID)) || '';
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
        
        // Clear and re-render table
        this.eventTableBody.innerHTML = '';
        sortedEvents.forEach(event => {
            this.addEventToTable(event, false); // false = don't add to events array again
        });
        
        // Auto-scroll if enabled
        if (this.autoScroll) {
            this.eventTableBody.parentElement.scrollTop = this.eventTableBody.parentElement.scrollHeight;
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
            
            // Check ID filter (if no IDs selected, show all; otherwise only show selected IDs)
            const idMatch = this.filteredIds.size === 0 || this.filteredIds.has(eventId);
            
            // Show row only if both filters pass
            if (eventTypeMatch && idMatch) {
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
            id = event.data.id || event.data.deviceId || event.data.deviceID;
        }
        id = id || '-';
        
        const { shortValue, fullValue } = this.formatValue(event);
        
        const isFiltered = this.filteredIds.has(String(id));
        
        // Don't escape shortValue if it contains HTML formatting (for colors/emojis)
        const displayValue = shortValue.includes('<span') ? shortValue : this.escapeHtml(shortValue);
        
        row.innerHTML = `
            <td class="col-event"><span class="event-type">${displayType}</span></td>
            <td class="col-time"><span class="event-time">${time}</span></td>
            <td class="col-id"><span class="event-id ${isFiltered ? 'filtered' : ''}" data-id="${id}">${id}</span></td>
            <td class="col-value"><span class="event-value">${displayValue}<div class="value-tooltip">${this.escapeHtml(fullValue)}</div></span></td>
        `;
        
        row.dataset.eventType = eventType;
        row.dataset.eventId = String(id);
        
        // Add click handler to ID cell
        const idSpan = row.querySelector('.event-id');
        idSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleIdFilter(String(id));
        });
        
        // Apply filter immediately for new events
        const eventTypeMatch = this.selectedEventTypes.size === 0 || !this.selectedEventTypes.has(eventType);
        const idMatch = this.filteredIds.size === 0 || this.filteredIds.has(String(id));
        
        if (!eventTypeMatch || !idMatch) {
            row.style.display = 'none';
        }
        
        this.eventTableBody.appendChild(row);
        
        if (addToArray) {
            this.eventCount++;
            this.eventCountElement.textContent = this.eventCount;
        }
        
        if (this.autoScroll && addToArray) {
            this.eventTableBody.parentElement.scrollTop = this.eventTableBody.parentElement.scrollHeight;
        }
    }
    
    toggleIdFilter(id) {
        if (id === '-') return; // Don't filter on empty IDs
        
        if (this.filteredIds.has(id)) {
            this.filteredIds.delete(id);
        } else {
            this.filteredIds.add(id);
        }
        
        // Update all ID cells with this ID
        document.querySelectorAll(`.event-id[data-id="${id}"]`).forEach(el => {
            if (this.filteredIds.has(id)) {
                el.classList.add('filtered');
            } else {
                el.classList.remove('filtered');
            }
        });
        
        // Re-apply filters
        this.filterDisplayedEvents();
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
}

// Initialize the logger when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.logger = new HC3EventLogger();
});
