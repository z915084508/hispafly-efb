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
        const res = await fetch("/api/flight-map", {
            headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}
        });
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
        position: extractFlightPosition(flight)
    }));
}

function extractFlightPosition(flight) {
    const candidates = [
        flight.position,
        flight.currentPosition,
        flight.latestPosition,
        flight.last_position,
        flight.posrep,
        Array.isArray(flight.posreps) ? flight.posreps[flight.posreps.length - 1] : null
    ].filter(Boolean);

    for (const item of candidates) {
        const lat = item.latitude ?? item.lat;
        const lon = item.longitude ?? item.lng ?? item.lon;
        const parsedLat = Number(lat);
        const parsedLon = Number(lon);
        if (Number.isFinite(parsedLat) && Number.isFinite(parsedLon)) {
            return { lat: parsedLat, lon: parsedLon };
        }
    }

    const lat = flight.latitude ?? flight.lat;
    const lon = flight.longitude ?? flight.lng ?? flight.lon;
    const parsedLat = Number(lat);
    const parsedLon = Number(lon);
    return Number.isFinite(parsedLat) && Number.isFinite(parsedLon)
        ? { lat: parsedLat, lon: parsedLon }
        : null;
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
                <span>${flight.position ? `${flight.position.lat.toFixed(3)}, ${flight.position.lon.toFixed(3)}` : "No position"}</span>
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
