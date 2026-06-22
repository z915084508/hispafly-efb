let cdmAirportLastSearch = "";
let cdmCallsignLastSearch = "";
let cdmAirportFlights = [];
let cdmAirportCode = "";
let cdmRefreshTimer = null;
let cdmLastUpdated = "";
let cdmExcludedAirborne = 0;
let cdmExcludedNotGround = 0;
const CDM_REFRESH_MS = 30000;
const CDM_AIRPORT_RADIUS_NM = 6;
const CDM_AIRPORT_COORDS = {
    LEPA: { lat: 39.5517, lon: 2.7388 },
    LEIB: { lat: 38.8729, lon: 1.3731 },
    LEMH: { lat: 39.8626, lon: 4.2186 },
    LEMD: { lat: 40.4722, lon: -3.5608 },
    LEBL: { lat: 41.2974, lon: 2.0833 },
    LEVC: { lat: 39.4893, lon: -0.4816 },
    LEAL: { lat: 38.2822, lon: -0.5582 },
    LEMG: { lat: 36.6749, lon: -4.4991 },
    LEZL: { lat: 37.4180, lon: -5.8931 },
    LEGE: { lat: 41.9010, lon: 2.7605 },
    LEAS: { lat: 43.5636, lon: -6.0346 },
    LEVX: { lat: 42.2318, lon: -8.6268 },
    LECO: { lat: 43.3021, lon: -8.3773 },
    LEST: { lat: 42.8963, lon: -8.4151 },
    LEGR: { lat: 37.1887, lon: -3.7774 },
    LEJR: { lat: 36.7446, lon: -6.0601 },
    LEBB: { lat: 43.3011, lon: -2.9106 },
    LEBA: { lat: 37.8419, lon: -4.8489 },
    LEBG: { lat: 42.3576, lon: -3.6208 }
};

function renderCdmAirport() {
    document.getElementById("mainPanel").innerHTML = `
        <div class="grid">
            <section class="card wide">
                <h2>CDM Airport Status</h2>
                <div class="cdm-search-grid">
                    <div class="field" style="margin:0;">
                        <label for="cdmAirportInput">Airport ICAO</label>
                        <input id="cdmAirportInput" autocomplete="off" maxlength="4" placeholder="LEPA" value="${escapeHtml(cdmAirportLastSearch)}">
                    </div>
                    <button class="primary-btn" id="cdmAirportBtn">SEARCH CDM</button>
                    <div class="field" style="margin:0;">
                        <label for="cdmCallsignInput">Callsign</label>
                        <input id="cdmCallsignInput" autocomplete="off" maxlength="12" placeholder="HPF123" value="${escapeHtml(cdmCallsignLastSearch)}">
                    </div>
                    <button class="primary-btn" id="cdmCallsignBtn">FIND CALLSIGN</button>
                </div>
            </section>
            <section class="card wide">
                <h2>Airport Queue</h2>
                <div id="cdmAirportResult">
                    <p class="empty">Enter an airport ICAO to view current CDM and ATFCM status.</p>
                </div>
            </section>
        </div>
    `;

    const input = document.getElementById("cdmAirportInput");
    const callsignInput = document.getElementById("cdmCallsignInput");
    document.getElementById("cdmAirportBtn").addEventListener("click", requestCdmAirportStatus);
    document.getElementById("cdmCallsignBtn").addEventListener("click", requestCdmPlaneStatus);
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") requestCdmAirportStatus();
    });
    callsignInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") requestCdmPlaneStatus();
    });
}

async function requestCdmAirportStatus() {
    return loadCdmAirportStatus(false);
}

async function loadCdmAirportStatus(silent = false) {
    const input = document.getElementById("cdmAirportInput");
    const result = document.getElementById("cdmAirportResult");
    if (!input || !result) return;
    const airport = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    input.value = airport;
    cdmAirportLastSearch = airport;

    if (airport.length !== 4) {
        stopCdmAutoRefresh();
        result.innerHTML = `<p class="error">Enter a valid 4-letter airport ICAO.</p>`;
        return;
    }

    if (!silent) result.innerHTML = `<p class="empty">Loading CDM status for ${escapeHtml(airport)}...</p>`;
    try {
        const [cdmResult, vatsimResult] = await Promise.allSettled([
            fetchCdmAirportFlights(airport),
            fetchVatsimPilots()
        ]);

        if (cdmResult.status === "rejected") throw cdmResult.reason;

        if (vatsimResult.status === "rejected") throw vatsimResult.reason;

        const vatsimPilots = vatsimResult.value;
        const { groundFlights, excludedAirborne, excludedNotGround } = filterCdmGroundQueue(cdmResult.value, vatsimPilots, airport);
        cdmAirportFlights = groundFlights;
        cdmExcludedAirborne = excludedAirborne;
        cdmExcludedNotGround = excludedNotGround;
        cdmAirportCode = airport;
        cdmLastUpdated = new Date().toISOString();
        result.innerHTML = renderCdmAirportData(airport, groundFlights, cdmCallsignLastSearch);
        startCdmAutoRefresh();
    } catch (err) {
        if (!silent) {
            result.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
        } else {
            appendCdmRefreshNote(err.message);
        }
    }
}

function requestCdmPlaneStatus() {
    const input = document.getElementById("cdmCallsignInput");
    const result = document.getElementById("cdmAirportResult");
    const callsign = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    input.value = callsign;
    cdmCallsignLastSearch = callsign;

    if (!callsign) {
        result.innerHTML = `<p class="error">Enter a valid callsign.</p>`;
        return;
    }

    if (!cdmAirportFlights.length) {
        result.innerHTML = `<p class="error">Search an airport ICAO first, then find a callsign inside that airport queue.</p>`;
        return;
    }

    result.innerHTML = renderCdmAirportData(cdmAirportCode || "AIRPORT", cdmAirportFlights, callsign);
}

async function fetchCdmAirportFlights(airport) {
    const res = await fetch(`/api/cdm-airport?airport=${encodeURIComponent(airport)}`);
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.message || json.error || `CDM HTTP ${res.status}`);
    return Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
}

async function fetchVatsimPilots() {
    const res = await fetch("/api/vatsim-data");
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.message || json.error || `VATSIM HTTP ${res.status}`);
    return Array.isArray(json?.pilots) ? json.pilots : [];
}

function filterCdmGroundQueue(cdmFlights, vatsimPilots, airport) {
    const vatsimByCallsign = new Map(
        vatsimPilots
            .filter((pilot) => pilot?.callsign)
            .map((pilot) => [String(pilot.callsign).toUpperCase(), pilot])
    );
    let excludedAirborne = 0;
    let excludedNotGround = 0;
    const groundFlights = [];

    cdmFlights.forEach((flight) => {
        const callsign = String(flight.callsign || "").toUpperCase();
        const vatsim = vatsimByCallsign.get(callsign);
        const state = classifyVatsimGroundState(vatsim, airport);
        if (state.airborne) {
            excludedAirborne += 1;
            return;
        }
        if (!state.onGroundAtAirport) {
            excludedNotGround += 1;
            return;
        }
        groundFlights.push({
            ...flight,
            vatsimState: state
        });
    });

    return { groundFlights, excludedAirborne, excludedNotGround };
}

function classifyVatsimGroundState(pilot, airport) {
    if (!pilot) {
        return {
            label: "Not online",
            detail: "No VATSIM match",
            airborne: false,
            onGroundAtAirport: false
        };
    }

    const altitude = Number(pilot.altitude);
    const groundspeed = Number(pilot.groundspeed);
    const pilotLat = Number(pilot.latitude);
    const pilotLon = Number(pilot.longitude);
    const airportCoords = CDM_AIRPORT_COORDS[airport];
    const distanceNm = airportCoords && Number.isFinite(pilotLat) && Number.isFinite(pilotLon)
        ? distanceNmBetween(airportCoords.lat, airportCoords.lon, pilotLat, pilotLon)
        : null;
    const flightPlan = pilot.flight_plan || {};
    const fpDeparture = String(flightPlan.departure || "").toUpperCase();
    const fpArrival = String(flightPlan.arrival || "").toUpperCase();
    const isDepartureFromAirport = fpDeparture === airport && fpArrival && fpArrival !== airport;
    const isAtAirportPosition = distanceNm !== null ? distanceNm <= CDM_AIRPORT_RADIUS_NM : false;
    const isClearlyAirborne = (
        (Number.isFinite(groundspeed) && groundspeed >= 120) ||
        (Number.isFinite(groundspeed) && groundspeed >= 80 && Number.isFinite(altitude) && altitude >= 1500) ||
        (!isDepartureFromAirport && Number.isFinite(altitude) && altitude >= 2500)
    );
    const isGroundMovement = !Number.isFinite(groundspeed) || groundspeed < 80;

    if (isDepartureFromAirport && isAtAirportPosition && isGroundMovement && !isClearlyAirborne) {
        return {
            label: "On ground",
            detail: `${fpDeparture}-${fpArrival} ${formatDistance(distanceNm)} from airport`,
            airborne: false,
            onGroundAtAirport: true
        };
    }

    if (isClearlyAirborne) {
        return {
            label: "Airborne",
            detail: `${formatValue(fpDeparture, airport)}-${formatValue(fpArrival)} ALT ${formatValue(pilot.altitude)} / GS ${formatValue(pilot.groundspeed)}`,
            airborne: true,
            onGroundAtAirport: false
        };
    }

    return {
        label: "Not in queue",
        detail: `FP ${formatValue(fpDeparture, "N/A")}-${formatValue(fpArrival, "N/A")} / ${distanceNm === null ? "no airport position check" : formatDistance(distanceNm)}`,
        airborne: false,
        onGroundAtAirport: false
    };
}

function renderCdmAirportData(airport, flights, callsignFilter = "") {
    const sorted = Array.isArray(flights) ? [...flights].sort(compareCdmFlights) : [];
    const filtered = callsignFilter
        ? sorted.filter((flight) => String(flight.callsign || "").toUpperCase().includes(callsignFilter))
        : sorted;
    const confirmedCount = sorted.filter((flight) => isCdmConfirmed(flight.cdmData?.confirmed)).length;

    return `
        <div class="cdm-summary">
            ${cdmStat("Airport", airport)}
            ${cdmStat("Queued Aircraft", sorted.length)}
            ${cdmStat("Confirmed", confirmedCount)}
        </div>
        <div class="cdm-refresh-row">
            <span>Auto refresh every ${Math.round(CDM_REFRESH_MS / 1000)}s | VATSIM callsign + airport position matched</span>
            <strong id="cdmRefreshStamp">Updated ${escapeHtml(formatCdmRefreshTime(cdmLastUpdated))}</strong>
        </div>
        ${callsignFilter ? `<p class="empty" style="margin-bottom:12px;">Showing callsigns matching ${escapeHtml(callsignFilter)} inside ${escapeHtml(airport)} queue.</p>` : ""}
        <div class="cdm-list">
            ${filtered.length
                ? filtered.map((flight) => renderCdmFlight(flight, sorted.indexOf(flight) + 1, callsignFilter)).join("")
                : `<p class="empty">${callsignFilter ? `No callsign matching ${escapeHtml(callsignFilter)} found in this airport queue.` : `No VATSIM ground departures matched at ${escapeHtml(airport)}.`}</p>`}
        </div>
    `;
}

function renderCdmFlight(flight, sequence, callsignFilter = "") {
    const cdm = flight.cdmData || {};
    const status = flight.atfcmStatus || "N/A";
    const isMatch = callsignFilter && String(flight.callsign || "").toUpperCase().includes(callsignFilter);
    const cdmRows = [
        ["TOBT", cdm.tobt],
        ["TSAT", cdm.tsat],
        ["TTOT", cdm.ttot],
        ["CTOT", cdm.ctot],
        ["Reason", cdm.reason],
        ["ASRT", cdm.asrt],
        ["Dep Info", cdm.depInfo],
        ["Requested ASRT", cdm.reqAsrt],
        ["Requested TOBT", cdm.reqTobt],
        ["Requested TOBT Type", cdm.reqTobtType],
        ["CDM Status", formatCdmConfirmation(cdm)]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");

    return `
        <article class="item cdm-flight ${isMatch ? "cdm-highlight" : ""}">
            <div class="item-title">
                <span>#${sequence} ${escapeHtml(formatValue(flight.callsign, "UNKNOWN"))}</span>
                <span class="pill">${escapeHtml(formatValue(status))}</span>
            </div>
            <div class="meta">
                <span>CALLSIGN: ${escapeHtml(formatValue(flight.callsign, "UNKNOWN"))}</span>
                <span>CDM DATA</span>
                <span>${escapeHtml(formatValue(flight.vatsimState?.detail, ""))}</span>
            </div>
            <div class="cdm-data-grid">
                ${cdmRows.map(([label, value]) => `
                    <div class="cdm-data-cell">
                        <span>${escapeHtml(label)}</span>
                        <strong>${escapeHtml(formatCdmCellValue(label, value))}</strong>
                    </div>
                `).join("")}
            </div>
        </article>
    `;
}

function compareCdmFlights(a, b) {
    const aTime = getCdmSortTime(a);
    const bTime = getCdmSortTime(b);
    if (aTime !== bTime) return aTime - bTime;
    return String(a.callsign || "").localeCompare(String(b.callsign || ""));
}

function getCdmSortTime(flight) {
    const cdm = flight.cdmData || {};
    const value = cdm.ttot || cdm.ctot || cdm.tsat || cdm.tobt || "";
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
    const hhmm = formatCdmTime(value).match(/^(\d{2})(\d{2})$/);
    if (hhmm) return Number(hhmm[1]) * 60 + Number(hhmm[2]);
    return Number.MAX_SAFE_INTEGER;
}

function distanceNmBetween(lat1, lon1, lat2, lon2) {
    const earthRadiusNm = 3440.065;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const rLat1 = toRadians(lat1);
    const rLat2 = toRadians(lat2);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
    return earthRadiusNm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
    return value * Math.PI / 180;
}

function formatDistance(value) {
    return Number.isFinite(value) ? `${value.toFixed(1)} NM` : "N/A";
}

function startCdmAutoRefresh() {
    stopCdmAutoRefresh();
    if (!cdmAirportLastSearch) return;
    cdmRefreshTimer = window.setInterval(() => {
        const input = document.getElementById("cdmAirportInput");
        if (!input) {
            stopCdmAutoRefresh();
            return;
        }
        loadCdmAirportStatus(true);
    }, CDM_REFRESH_MS);
}

function stopCdmAutoRefresh() {
    if (!cdmRefreshTimer) return;
    window.clearInterval(cdmRefreshTimer);
    cdmRefreshTimer = null;
}

function appendCdmRefreshNote(message) {
    const stamp = document.getElementById("cdmRefreshStamp");
    if (stamp) stamp.textContent = `Refresh failed: ${message}`;
}

function formatCdmRefreshTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "never";
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mm = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss} UTC`;
}

function formatCdmCellValue(label, value) {
    if (/TOBT|TSAT|TTOT|CTOT|ASRT/i.test(label)) {
        return formatCdmTime(value);
    }
    return formatValue(value);
}

function formatCdmTime(value) {
    const text = String(formatValue(value, "")).trim();
    if (!text) return "N/A";
    const compact = text.replace(/[^0-9]/g, "");
    if (/^\d{6}$/.test(compact)) return compact.slice(0, 4);
    if (/^\d{4}$/.test(compact)) return compact;
    const hhmm = text.match(/(\d{2}):?(\d{2})/);
    if (hhmm) return `${hhmm[1]}${hhmm[2]}`;
    return text;
}

function cdmStat(label, value) {
    return `
        <div class="cdm-stat">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatValue(value))}</strong>
        </div>
    `;
}

function isCdmConfirmed(value) {
    return value === true || String(value).toLowerCase() === "true";
}

function formatCdmConfirmation(cdm) {
    if (isCdmConfirmed(cdm?.confirmed)) return "CONFIRMED";
    const hasAnySlot = !!(cdm?.tsat || cdm?.ttot || cdm?.ctot || cdm?.tobt);
    if (hasAnySlot) return "UNCONFIRMED";
    return "PENDING";
}
