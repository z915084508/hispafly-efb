let cdmAirportLastSearch = "";
let cdmCallsignLastSearch = "";

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
                    <button class="primary-btn" id="cdmCallsignBtn">SEARCH AIRCRAFT</button>
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
    const input = document.getElementById("cdmAirportInput");
    const result = document.getElementById("cdmAirportResult");
    const airport = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    input.value = airport;
    cdmAirportLastSearch = airport;

    if (airport.length !== 4) {
        result.innerHTML = `<p class="error">Enter a valid 4-letter airport ICAO.</p>`;
        return;
    }

    result.innerHTML = `<p class="empty">Loading CDM status for ${escapeHtml(airport)}...</p>`;
    try {
        const res = await fetch(`/api/cdm-airport?airport=${encodeURIComponent(airport)}`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.message || json.error || `CDM HTTP ${res.status}`);
        const flights = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
        result.innerHTML = renderCdmAirportData(airport, flights);
    } catch (err) {
        result.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
}

async function requestCdmPlaneStatus() {
    const input = document.getElementById("cdmCallsignInput");
    const result = document.getElementById("cdmAirportResult");
    const callsign = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    input.value = callsign;
    cdmCallsignLastSearch = callsign;

    if (!callsign) {
        result.innerHTML = `<p class="error">Enter a valid callsign.</p>`;
        return;
    }

    result.innerHTML = `<p class="empty">Loading CDM status for ${escapeHtml(callsign)}...</p>`;
    try {
        const res = await fetch(`/api/cdm-plane?callsign=${encodeURIComponent(callsign)}`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.message || json.error || `CDM HTTP ${res.status}`);
        result.innerHTML = renderCdmPlaneData(callsign, json);
    } catch (err) {
        result.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
}

function renderCdmAirportData(airport, flights) {
    if (!Array.isArray(flights) || flights.length === 0) {
        return `<p class="empty">No CDM aircraft returned for ${escapeHtml(airport)}.</p>`;
    }

    const sorted = [...flights].sort(compareCdmFlights);
    const activeCount = sorted.filter((flight) => String(flight.atfcmStatus || "").toUpperCase().includes("ACT")).length;
    const confirmedCount = sorted.filter((flight) => isCdmConfirmed(flight.cdmData?.confirmed)).length;

    return `
        <div class="cdm-summary">
            ${cdmStat("Airport", airport)}
            ${cdmStat("Aircraft", sorted.length)}
            ${cdmStat("Active", activeCount)}
            ${cdmStat("Confirmed", confirmedCount)}
        </div>
        <div class="cdm-list">
            ${sorted.map((flight, index) => renderCdmFlight(flight, index + 1)).join("")}
        </div>
    `;
}

function renderCdmPlaneData(callsign, payload) {
    const flights = normalizeCdmPlanePayload(payload);
    if (!flights.length) {
        return `<p class="empty">No CDM aircraft returned for ${escapeHtml(callsign)}.</p>`;
    }

    return `
        <div class="cdm-summary">
            ${cdmStat("Callsign", callsign)}
            ${cdmStat("Matches", flights.length)}
            ${cdmStat("Departure", flights[0]?.departure)}
            ${cdmStat("Arrival", flights[0]?.arrival)}
        </div>
        <div class="cdm-list">
            ${flights.map((flight, index) => renderCdmFlight(flight, index + 1)).join("")}
        </div>
    `;
}

function normalizeCdmPlanePayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (payload?.callsign || payload?.cdmData || payload?.atfcmStatus) return [payload];
    if (payload?.data && typeof payload.data === "object") return [payload.data];
    return [];
}

function renderCdmFlight(flight, sequence) {
    const cdm = flight.cdmData || {};
    const status = flight.atfcmStatus || "N/A";
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
        <article class="item cdm-flight">
            <div class="item-title">
                <span>#${sequence} ${escapeHtml(formatValue(flight.callsign, "UNKNOWN"))}</span>
                <span class="pill">${escapeHtml(formatValue(status))}</span>
            </div>
            <div class="meta">
                <span>DEP: ${escapeHtml(formatValue(flight.departure))}</span>
                <span>ARR: ${escapeHtml(formatValue(flight.arrival))}</span>
                <span>CID: ${escapeHtml(formatValue(flight.cid))}</span>
            </div>
            <div class="cdm-data-grid">
                ${cdmRows.map(([label, value]) => `
                    <div class="cdm-data-cell">
                        <span>${escapeHtml(label)}</span>
                        <strong>${escapeHtml(formatValue(value))}</strong>
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
    const hhmm = String(value).match(/(\d{2}):?(\d{2})/);
    if (hhmm) return Number(hhmm[1]) * 60 + Number(hhmm[2]);
    return Number.MAX_SAFE_INTEGER;
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
