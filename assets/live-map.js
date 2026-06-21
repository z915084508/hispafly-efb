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
        departure: flight.departureAirport?.icao || flight.departureAirport?.identifier || flight.booking?.departure || flight.departure || flight.departure_icao || "",
        arrival: flight.arrivalAirport?.icao || flight.arrivalAirport?.identifier || flight.booking?.arrival || flight.arrival || flight.arrival_icao || "",
        phase: flight.progress?.currentPhase || flight.phase?.name || flight.phase || flight.status || "ACTIVE",
        progress: flight.progress ?? flight.flightProgress ?? flight.percent ?? "",
        altitude: firstDefined(flight.progress?.altitude, flight.position?.altitude, flight.altitude, flight.booking?.altitude, ""),
        speed: firstDefined(flight.progress?.groundSpeed, flight.position?.groundspeed, flight.position?.speed, flight.groundspeed, flight.speed, ""),
        heading: firstDefined(flight.progress?.magneticHeading, flight.progress?.magnetic_heading, flight.position?.heading, flight.heading, ""),
        pilot: flight.pilot?.username || flight.pilot?.name || "",
        aircraft: flight.aircraft?.name || flight.aircraft?.type || flight.aircraft_type || "",
        position: extractFlightPosition(flight),
        route: extractRoutePositions(flight),
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
        flight.route?.points,
        flight.progress?.posreps
    ];
    const candidates = [
        flight.progress?.location,
        flight.progress,
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

    const directPosition = parsePositionValue(flight);
    if (directPosition) return directPosition;

    return extractAirportPosition(flight.departureAirport);
}

function extractRoutePositions(flight) {
    const route = [];
    const departure = extractAirportPosition(flight.departureAirport);
    const arrival = extractAirportPosition(flight.arrivalAirport);
    if (departure) route.push(departure);
    if (arrival && (!departure || departure.lat !== arrival.lat || departure.lon !== arrival.lon)) {
        route.push(arrival);
    }
    return route;
}

function extractAirportPosition(airport) {
    if (!airport) return null;
    return parsePositionValue(airport);
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
        ["progress", flight.progress],
        ["progress.posreps", flight.progress?.posreps],
        ["positionReports", flight.positionReports],
        ["position_reports", flight.position_reports],
        ["track", flight.track],
        ["coordinates", flight.coordinates],
        ["departureAirport", flight.departureAirport],
        ["arrivalAirport", flight.arrivalAirport],
        ["lat/lon", firstDefined(flight.latitude, flight.lat, flight.progress?.latitude, flight.progress?.lat)]
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
    renderVectorLiveMap(flights);
    if (!liveMapInstance || !liveMapLayer) return;
    liveMapLayer.clearLayers();

    const bounds = [];
    flights.forEach((flight) => {
        if (flight.route.length >= 2) {
            const routeLine = L.polyline(flight.route.map((point) => [point.lat, point.lon]), {
                color: "#10b981",
                weight: 4,
                opacity: 0.78
            });
            routeLine.addTo(liveMapLayer);
            flight.route.forEach((point) => bounds.push([point.lat, point.lon]));
        }

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

function renderVectorLiveMap(flights) {
    const canvas = document.getElementById("liveMapCanvas");
    if (!canvas) return;

    const existing = document.getElementById("liveMapVector");
    if (existing) existing.remove();

    if (!flights.length) return;

    const points = [];
    flights.forEach((flight) => {
        if (flight.position) points.push({ ...flight.position, label: flight.callsign, type: "aircraft" });
        flight.route.forEach((point, index) => {
            points.push({
                ...point,
                label: index === 0 ? flight.departure : flight.arrival,
                type: index === 0 ? "dep" : "arr"
            });
        });
    });

    const bounds = getVectorBounds(points);
    const project = (point) => projectVectorPoint(point, bounds);
    const gridLines = renderVectorGrid(bounds, project);
    const routes = flights.map((flight) => renderVectorRoute(flight, project)).join("");
    const aircraft = flights.map((flight) => renderVectorAircraft(flight, project)).join("");
    const labels = flights.map((flight) => renderVectorLabels(flight, project)).join("");

    const vector = document.createElement("div");
    vector.id = "liveMapVector";
    vector.className = "live-map-vector";
    vector.innerHTML = `
        <svg viewBox="0 0 1000 430" role="img" aria-label="Live flight vector map">
            <defs>
                <radialGradient id="liveMapGlow" cx="50%" cy="48%" r="58%">
                    <stop offset="0%" stop-color="rgba(0,180,216,0.20)" />
                    <stop offset="100%" stop-color="rgba(0,0,0,0)" />
                </radialGradient>
                <filter id="planeShadow" x="-80%" y="-80%" width="260%" height="260%">
                    <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="rgba(0,0,0,0.5)" />
                </filter>
            </defs>
            <rect width="1000" height="430" rx="14" fill="rgba(3,14,24,0.82)" />
            <rect width="1000" height="430" rx="14" fill="url(#liveMapGlow)" />
            ${gridLines}
            ${routes}
            ${labels}
            ${aircraft}
        </svg>
    `;
    canvas.appendChild(vector);
}

function getVectorBounds(points) {
    const valid = points.filter((point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lon));
    const fallback = { minLat: 35, maxLat: 43, minLon: -10, maxLon: 5 };
    if (!valid.length) return fallback;

    let minLat = Math.min(...valid.map((point) => point.lat));
    let maxLat = Math.max(...valid.map((point) => point.lat));
    let minLon = Math.min(...valid.map((point) => point.lon));
    let maxLon = Math.max(...valid.map((point) => point.lon));
    const latPad = Math.max((maxLat - minLat) * 0.28, 0.65);
    const lonPad = Math.max((maxLon - minLon) * 0.28, 0.65);

    minLat = Math.max(-85, minLat - latPad);
    maxLat = Math.min(85, maxLat + latPad);
    minLon = Math.max(-180, minLon - lonPad);
    maxLon = Math.min(180, maxLon + lonPad);

    if (minLat === maxLat) {
        minLat -= 0.65;
        maxLat += 0.65;
    }
    if (minLon === maxLon) {
        minLon -= 0.65;
        maxLon += 0.65;
    }

    return { minLat, maxLat, minLon, maxLon };
}

function projectVectorPoint(point, bounds) {
    const x = 60 + ((point.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 880;
    const y = 365 - ((point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 300;
    return {
        x: Number.isFinite(x) ? x : 500,
        y: Number.isFinite(y) ? y : 215
    };
}

function renderVectorGrid(bounds, project) {
    const latStep = Math.max(0.25, (bounds.maxLat - bounds.minLat) / 5);
    const lonStep = Math.max(0.25, (bounds.maxLon - bounds.minLon) / 5);
    const lines = [];

    for (let i = 0; i <= 5; i += 1) {
        const lat = bounds.minLat + latStep * i;
        const a = project({ lat, lon: bounds.minLon });
        const b = project({ lat, lon: bounds.maxLon });
        lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />`);
    }

    for (let i = 0; i <= 5; i += 1) {
        const lon = bounds.minLon + lonStep * i;
        const a = project({ lat: bounds.minLat, lon });
        const b = project({ lat: bounds.maxLat, lon });
        lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />`);
    }

    return `<g>${lines.join("")}</g>`;
}

function renderVectorRoute(flight, project) {
    if (!flight.route.length) return "";
    const routePoints = [...flight.route];
    if (flight.position) {
        routePoints.splice(1, 0, flight.position);
    }
    const points = routePoints.map((point) => {
        const projected = project(point);
        return `${projected.x},${projected.y}`;
    }).join(" ");

    return `
        <polyline points="${points}" fill="none" stroke="rgba(16,185,129,0.84)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="${points}" fill="none" stroke="rgba(255,255,255,0.24)" stroke-width="1.5" stroke-dasharray="8 10" stroke-linecap="round" />
    `;
}

function renderVectorAircraft(flight, project) {
    if (!flight.position) return "";
    const point = project(flight.position);
    const heading = Number(flight.heading || 0);
    return `
        <g transform="translate(${point.x} ${point.y}) rotate(${heading})" filter="url(#planeShadow)">
            <circle r="18" fill="rgba(255,196,0,0.22)" stroke="rgba(255,196,0,0.8)" stroke-width="2" />
            <path d="M 0 -18 L 10 12 L 0 7 L -10 12 Z" fill="#ffc400" stroke="#05080d" stroke-width="1.5" />
        </g>
        <g transform="translate(${point.x + 24} ${point.y - 28})">
            <rect x="0" y="0" width="150" height="44" rx="10" fill="rgba(4,7,12,0.82)" stroke="rgba(255,255,255,0.16)" />
            <text x="12" y="18" fill="#fff" font-size="14" font-weight="800">${escapeSvg(flight.callsign)}</text>
            <text x="12" y="34" fill="rgba(255,255,255,0.66)" font-size="11">${escapeSvg(formatValue(flight.phase, "ACTIVE"))} / ${escapeSvg(formatValue(flight.altitude))} ft</text>
        </g>
    `;
}

function renderVectorLabels(flight, project) {
    const labels = [];
    flight.route.forEach((point, index) => {
        const projected = project(point);
        const label = index === 0 ? flight.departure : flight.arrival;
        const color = index === 0 ? "#72f0a3" : "#ff6b6b";
        labels.push(`
            <g transform="translate(${projected.x} ${projected.y})">
                <circle r="6" fill="${color}" stroke="#05080d" stroke-width="2" />
                <text x="10" y="-9" fill="#fff" font-size="12" font-weight="800">${escapeSvg(formatValue(label))}</text>
            </g>
        `);
    });
    return labels.join("");
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

function escapeSvg(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
