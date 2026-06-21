let liveMapInstance = null;
let liveMapLayer = null;
let liveMapRefreshTimer = null;
let liveMapFlights = [];
let liveMapLastUpdated = "";
const LIVE_MAP_REFRESH_MS = 30000;

function renderLiveFlightMap() {
    document.getElementById("mainPanel").innerHTML = `
        <div class="live-map-layout">
            <section class="card wide live-map-card">
                <div class="item-title">
                    <h2 style="margin:0;">Live Flight Map</h2>
                    <span class="pill" id="liveMapRefreshStamp">Loading</span>
                </div>
                <div class="live-map-toolbar">
                    <div class="live-map-stats" id="liveMapStats">
                        ${liveMapStat("Active Flights", "--")}
                        ${liveMapStat("Mapped", "--")}
                        ${liveMapStat("Network", "VAMSYS")}
                    </div>
                    <button class="inline-btn" id="liveMapReloadBtn">RELOAD MAP</button>
                </div>
                <div id="liveMapCanvas" class="live-map-canvas"></div>
            </section>
            <section class="card wide">
                <h2>Active Flight List</h2>
                <div id="liveMapList" class="live-map-list">
                    <p class="empty">Loading active flights...</p>
                </div>
            </section>
        </div>
    `;

    document.getElementById("liveMapReloadBtn").addEventListener("click", () => loadLiveFlightMap(false));
    initLiveMap();
    loadLiveFlightMap(false);
    startLiveMapAutoRefresh();
}

function initLiveMap() {
    if (typeof L === "undefined") {
        document.getElementById("liveMapCanvas").innerHTML = `<p class="error">Map library did not load. Check internet access to Leaflet CDN.</p>`;
        return;
    }

    if (liveMapInstance) {
        liveMapInstance.remove();
        liveMapInstance = null;
    }

    liveMapInstance = L.map("liveMapCanvas", {
        zoomControl: true,
        attributionControl: false
    }).setView([38.5, -3.5], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 12
    }).addTo(liveMapInstance);

    liveMapLayer = L.layerGroup().addTo(liveMapInstance);
}

async function loadLiveFlightMap(silent = false) {
    const stamp = document.getElementById("liveMapRefreshStamp");
    const list = document.getElementById("liveMapList");
    if (!list) return;

    if (!silent) {
        stamp.textContent = "Loading";
        list.innerHTML = `<p class="empty">Loading active flights...</p>`;
    }

    try {
        const res = await fetch("/api/flight-map?include_posreps=true");
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.message || json.error || `Flight map HTTP ${res.status}`);

        liveMapFlights = normalizeFlightMapData(json);
        liveMapLastUpdated = new Date().toISOString();
        renderLiveMapData();
    } catch (err) {
        stamp.textContent = "Error";
        list.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
}

function normalizeFlightMapData(json) {
    const source = Array.isArray(json?.data)
        ? json.data
        : (Array.isArray(json) ? json : (Array.isArray(json?.flights) ? json.flights : []));
    return source.map((flight) => ({
        raw: flight,
        callsign: flight.booking?.callsign || flight.callsign || flight.flight?.callsign || "UNKNOWN",
        flightNumber: flight.booking?.flightNumber || flight.booking?.flight_number || flight.flight_number || flight.flightNumber || "",
        departure: flight.booking?.departure || flight.departure || flight.departure_icao || "",
        arrival: flight.booking?.arrival || flight.arrival || flight.arrival_icao || "",
        phase: flight.phase?.name || flight.phase || flight.status || "ACTIVE",
        progress: flight.progress ?? flight.flightProgress ?? flight.percent ?? "",
        altitude: flight.position?.altitude || flight.altitude || flight.booking?.altitude || "",
        speed: flight.position?.groundspeed || flight.position?.speed || flight.groundspeed || flight.speed || "",
        heading: flight.position?.heading || flight.heading || "",
        pilot: flight.pilot?.username || flight.pilot?.name || "",
        aircraft: flight.aircraft?.name || flight.aircraft?.type || flight.aircraft_type || "",
        position: extractFlightPosition(flight),
        positionDebug: summarizePositionFields(flight)
    }));
}

function extractFlightPosition(flight) {
    const historyCandidates = [
        flight.posreps,
        flight.positionReports,
        flight.position_reports,
        flight.posReports,
        flight.pos_reports,
        flight.reports,
        flight.positionHistory,
        flight.position_history,
        flight.track,
        flight.trackPoints,
        flight.track_points,
        flight.route?.points
    ];
    const candidates = [
        flight.position,
        flight.currentPosition,
        flight.current_position,
        flight.latestPosition,
        flight.latest_posrep,
        flight.latestPosrep,
        flight.lastPosrep,
        flight.last_posrep,
        flight.last_position,
        flight.positionReport,
        flight.position_report,
        flight.livePosition,
        flight.live_position,
        flight.coordinates,
        flight.location,
        flight.geo,
        flight.posrep,
        ...historyCandidates.map((items) => Array.isArray(items) ? items[items.length - 1] : null)
    ].filter(Boolean);

    for (const item of candidates) {
        const parsed = parsePositionValue(item);
        if (parsed) return parsed;
    }

    return parsePositionValue(flight);
}

function parsePositionValue(item) {
    if (!item) return null;

    if (Array.isArray(item)) {
        return parseCoordinatePair(item);
    }

    if (typeof item === "string") {
        const parts = item.split(/[,\s]+/).map(Number).filter(Number.isFinite);
        return parts.length >= 2 ? parseCoordinatePair(parts) : null;
    }

    if (Array.isArray(item.coordinates)) {
        const parsed = parseCoordinatePair(item.coordinates);
        if (parsed) return parsed;
    }

    if (typeof item.position === "string") {
        const parsed = parsePositionValue(item.position);
        if (parsed) return parsed;
    }

    const lat = firstDefined(item.latitude, item.lat, item.Latitude, item.LAT, item.y);
    const lon = firstDefined(item.longitude, item.lng, item.lon, item.long, item.Longitude, item.LON, item.x);
    const parsedLat = Number(lat);
    const parsedLon = Number(lon);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLon) && isValidLatLon(parsedLat, parsedLon)) {
        return { lat: parsedLat, lon: parsedLon };
    }

    return null;
}

function parseCoordinatePair(values) {
    if (!Array.isArray(values) || values.length < 2) return null;
    const first = Number(values[0]);
    const second = Number(values[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

    if (isValidLatLon(first, second)) return { lat: first, lon: second };
    if (isValidLatLon(second, first)) return { lat: second, lon: first };
    return null;
}

function isValidLatLon(lat, lon) {
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== "");
}

function summarizePositionFields(flight) {
    const keys = [];
    const keyGroups = [
        ["position", flight.position],
        ["currentPosition", flight.currentPosition],
        ["current_position", flight.current_position],
        ["latestPosition", flight.latestPosition],
        ["latest_posrep", flight.latest_posrep],
        ["posrep", flight.posrep],
        ["posreps", flight.posreps],
        ["positionReports", flight.positionReports],
        ["position_reports", flight.position_reports],
        ["track", flight.track],
        ["coordinates", flight.coordinates],
        ["lat/lon", firstDefined(flight.latitude, flight.lat)]
    ];

    keyGroups.forEach(([label, value]) => {
        if (Array.isArray(value) && value.length) keys.push(`${label}[${value.length}]`);
        else if (value && typeof value === "object") keys.push(label);
        else if (value !== undefined && value !== null && value !== "") keys.push(label);
    });

    return keys.length ? keys.join(", ") : "No position fields returned";
}

function renderLiveMapData() {
    const mapped = liveMapFlights.filter((flight) => flight.position);
    document.getElementById("liveMapRefreshStamp").textContent = `Updated ${formatLiveMapTime(liveMapLastUpdated)}`;
    document.getElementById("liveMapStats").innerHTML = `
        ${liveMapStat("Active Flights", liveMapFlights.length)}
        ${liveMapStat("Mapped", mapped.length)}
        ${liveMapStat("Refresh", `${Math.round(LIVE_MAP_REFRESH_MS / 1000)}s`)}
    `;
    renderLiveMapMarkers(mapped);
    renderLiveMapList();
}

function renderLiveMapMarkers(flights) {
    if (!liveMapInstance || !liveMapLayer) return;
    liveMapLayer.clearLayers();

    const bounds = [];
    flights.forEach((flight) => {
        const marker = L.marker([flight.position.lat, flight.position.lon], {
            icon: L.divIcon({
                className: "live-plane-marker",
                html: `<span style="transform:rotate(${Number(flight.heading || 0)}deg)">&#9650;</span>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        marker.bindPopup(renderLiveMapPopup(flight));
        marker.addTo(liveMapLayer);
        bounds.push([flight.position.lat, flight.position.lon]);
    });

    if (bounds.length) {
        liveMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
    }

    renderLiveMapEmptyState(flights.length);
    window.setTimeout(() => liveMapInstance.invalidateSize(), 80);
}

function renderLiveMapEmptyState(mappedCount) {
    const canvas = document.getElementById("liveMapCanvas");
    if (!canvas) return;

    const existing = document.getElementById("liveMapEmptyState");
    if (existing) existing.remove();

    if (mappedCount > 0) return;

    const empty = document.createElement("div");
    empty.id = "liveMapEmptyState";
    empty.className = "live-map-empty";
    empty.innerHTML = `
        <strong>No live coordinates yet</strong>
        <span>${liveMapFlights.length} active flight loaded, but VAMSYS did not return usable latitude/longitude for it.</span>
    `;
    canvas.appendChild(empty);
}

function renderLiveMapPopup(flight) {
    return `
        <strong>${escapeHtml(flight.callsign)}</strong><br>
        ${escapeHtml([flight.departure, flight.arrival].filter(Boolean).join(" - "))}<br>
        ${escapeHtml(formatValue(flight.phase, "ACTIVE"))}<br>
        ALT ${escapeHtml(formatValue(flight.altitude))} / GS ${escapeHtml(formatValue(flight.speed))}
    `;
}

function renderLiveMapList() {
    const list = document.getElementById("liveMapList");
    if (!liveMapFlights.length) {
        list.innerHTML = `<p class="empty">No active VAMSYS flights were returned.</p>`;
        return;
    }

    list.innerHTML = liveMapFlights.map((flight) => `
        <article class="item live-flight-item ${flight.position ? "" : "live-flight-unmapped"}">
            <div class="item-title">
                <span>${escapeHtml(flight.callsign)} ${escapeHtml(flight.flightNumber)}</span>
                <span class="pill">${escapeHtml(formatValue(flight.phase, "ACTIVE"))}</span>
            </div>
            <div class="meta">
                <span>${escapeHtml(formatValue(flight.departure))} to ${escapeHtml(formatValue(flight.arrival))}</span>
                <span>ALT ${escapeHtml(formatValue(flight.altitude))}</span>
                <span>GS ${escapeHtml(formatValue(flight.speed))}</span>
                <span>${flight.position ? `${flight.position.lat.toFixed(3)}, ${flight.position.lon.toFixed(3)}` : "No coordinates"}</span>
                ${flight.position ? "" : `<span>Fields: ${escapeHtml(flight.positionDebug)}</span>`}
            </div>
        </article>
    `).join("");
}

function liveMapStat(label, value) {
    return `
        <div class="cdm-stat">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatValue(value))}</strong>
        </div>
    `;
}

function startLiveMapAutoRefresh() {
    stopLiveMapAutoRefresh();
    liveMapRefreshTimer = window.setInterval(() => loadLiveFlightMap(true), LIVE_MAP_REFRESH_MS);
}

function stopLiveMapAutoRefresh() {
    if (liveMapRefreshTimer) {
        window.clearInterval(liveMapRefreshTimer);
        liveMapRefreshTimer = null;
    }
    if (liveMapInstance) {
        liveMapInstance.remove();
        liveMapInstance = null;
        liveMapLayer = null;
    }
}

function formatLiveMapTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "never";
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mm = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss} UTC`;
}
