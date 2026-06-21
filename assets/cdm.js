let cdmAirportLastSearch = "";
let cdmCallsignLastSearch = "";
let cdmAirportFlights = [];
let cdmAirportCode = "";
let cdmRefreshTimer = null;
let cdmLastUpdated = "";
let cdmExcludedAirborne = 0;
let cdmExcludedNotGround = 0;
const CDM_REFRESH_MS = 30000;

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
    const flightPlan = pilot.flight_plan || {};
    const fpDeparture = String(flightPlan.departure || "").toUpperCase();
    const fpArrival = String(flightPlan.arrival || "").toUpperCase();
    const isDepartureFromAirport = fpDeparture === airport && fpArrival && fpArrival !== airport;
    const isClearlyAirborne = (
        (Number.isFinite(groundspeed) && groundspeed >= 120) ||
        (Number.isFinite(groundspeed) && groundspeed >= 80 && Number.isFinite(altitude) && altitude >= 1500) ||
        (!isDepartureFromAirport && Number.isFinite(altitude) && altitude >= 2500)
    );
    const isGroundMovement = !Number.isFinite(groundspeed) || groundspeed < 80;

    if (isDepartureFromAirport && isGroundMovement && !isClearlyAirborne) {
        return {
            label: "On ground",
            detail: `${fpDeparture}-${fpArrival} ALT ${formatValue(pilot.altitude)} / GS ${formatValue(pilot.groundspeed)}`,
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
        label: "Not departure",
        detail: `FP ${formatValue(fpDeparture, "N/A")}-${formatValue(fpArrival, "N/A")} / GS ${formatValue(pilot.groundspeed)}`,
        airborne: false,
        onGroundAtAirport: false
    };
}

function renderCdmAirportData(airport, flights, callsignFilter = "") {
    if (!Array.isArray(flights) || flights.length === 0) {
        return `<p class="empty">No CDM aircraft returned for ${escapeHtml(airport)}.</p>`;
    }

    const sorted = [...flights].sort(compareCdmFlights);
    const filtered = callsignFilter
        ? sorted.filter((flight) => String(flight.callsign || "").toUpperCase().includes(callsignFilter))
        : sorted;
    const activeCount = sorted.filter((flight) => String(flight.atfcmStatus || "").toUpperCase().includes("ACT")).length;
    const confirmedCount = sorted.filter((flight) => isCdmConfirmed(flight.cdmData?.confirmed)).length;

    return `
        <div class="cdm-summary">
            ${cdmStat("Airport", airport)}
            ${cdmStat("Departure Queue", sorted.length)}
            ${cdmStat("Active", activeCount)}
            ${cdmStat("Removed", cdmExcludedAirborne + cdmExcludedNotGround)}
            ${cdmStat(callsignFilter ? "Matches" : "Confirmed", callsignFilter ? filtered.length : confirmedCount)}
        </div>
        <div class="cdm-refresh-row">
            <span>Auto refresh every ${Math.round(CDM_REFRESH_MS / 1000)}s | VATSIM departures only | removed ${cdmExcludedAirborne} airborne and ${cdmExcludedNotGround} not in ${escapeHtml(airport)} departure queue</span>
            <strong id="cdmRefreshStamp">Updated ${escapeHtml(formatCdmRefreshTime(cdmLastUpdated))}</strong>
        </div>
        ${callsignFilter ? `<p class="empty" style="margin-bottom:12px;">Showing callsigns matching ${escapeHtml(callsignFilter)} inside ${escapeHtml(airport)} queue.</p>` : ""}
        <div class="cdm-list">
            ${filtered.length
                ? filtered.map((flight) => renderCdmFlight(flight, sorted.indexOf(flight) + 1, callsignFilter)).join("")
                : `<p class="empty">No callsign matching ${escapeHtml(callsignFilter)} found in this airport queue.</p>`}
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
                <span>DEP: ${escapeHtml(formatValue(flight.departure))}</span>
                <span>ARR: ${escapeHtml(formatValue(flight.arrival))}</span>
                <span>VATSIM: ${escapeHtml(formatValue(flight.vatsimState?.label, "Unknown"))}</span>
            </div>
            <div class="cdm-data-grid">
                <div class="cdm-data-cell">
                    <span>Live State</span>
                    <strong>${escapeHtml(formatValue(flight.vatsimState?.detail, "No match"))}</strong>
                </div>
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
