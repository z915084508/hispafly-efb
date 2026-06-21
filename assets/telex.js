const telexState = {
    connected: false,
    currentAtcUnit: "",
    pendingLogon: "",
    page: "menu",
    messageCounter: Number(localStorage.getItem("hpf_telex_counter") || "1"),
    messages: []
};

function renderTelex() {
    const context = buildTelexContext();
    document.getElementById("mainPanel").innerHTML = `
        <div class="telex">
            <section class="card telex-connection">
                <div class="item-title">
                    <h2 style="margin:0;">Connection</h2>
                    <span class="telex-status" id="telexStatus">${telexState.connected ? "CONNECTED" : "LOGGED OFF"}</span>
                </div>
                <div class="field">
                    <label for="telexCallsign">Callsign</label>
                    <input id="telexCallsign" autocomplete="off" placeholder="HPF123" value="${escapeHtml(context.callsign)}">
                </div>
                <div class="field">
                    <label for="telexCode">Hoppie LOGON Code</label>
                    <input id="telexCode" type="password" autocomplete="off" placeholder="Saved in Pilot Profile" value="${escapeHtml(context.logonCode)}">
                </div>
                <button class="primary-btn" id="telexConnectBtn">${telexState.connected ? "DISCONNECT" : "CONNECT"}</button>
                <div class="data-list" style="margin-top:14px;">
                    <div class="data-row"><span>DEP</span><strong id="fpDep">${escapeHtml(context.dep)}</strong></div>
                    <div class="data-row"><span>ARR</span><strong id="fpArr">${escapeHtml(context.arr)}</strong></div>
                    <div class="data-row"><span>FL</span><strong id="fpLevel">${escapeHtml(context.level)}</strong></div>
                    <div class="data-row"><span>ATSU</span><strong id="currentAtcUnit">${escapeHtml(telexState.currentAtcUnit || "----")}</strong></div>
                </div>
                <div class="message-log" id="telexLog" style="margin-top:14px;min-height:120px;">HISPAFLY TELEX READY
${telexState.connected ? "HOPPIE PATH AVAILABLE" : "CONNECT REQUIRED"}</div>
            </section>
            <div id="telexWorkbench">
                ${telexState.connected ? renderTelexWorkbenchMarkup(context) : ""}
            </div>
        </div>
    `;

    document.getElementById("telexConnectBtn").addEventListener("click", connectTelex);
    if (telexState.connected) bindTelexWorkbench();
}

function renderTelexWorkbenchMarkup(context) {
    return `
        <div class="telex-workbench">
            <section class="card wide">
                <div class="item-title">
                    <h2 style="margin:0;">Message Center</h2>
                    <button class="logout-btn" style="width:auto;padding:0 16px;" id="telexPollBtn">CHECK INBOX</button>
                </div>
                <div id="telexMessages" class="telex-message-list">
                    ${renderTelexMessages()}
                </div>
            </section>
            ${renderTelexPageMarkup(context)}
        </div>
    `;
}

function renderTelexPageMarkup(context) {
    if (telexState.page === "atcLogon") return renderAtcLogonPage();
    if (telexState.page === "dcl") return renderDclPage(context);
    if (telexState.page === "cpdlc") return renderCpdlcPage();
    return renderTelexMenuPage();
}

function renderTelexMenuPage() {
    const cards = [
        ["atcLogon", "ATC LOGON", "Connect or log off a CPDLC ATSU."],
        ["dcl", "Pre Departure Clearance", "Request your pre-departure clearance."],
        ["cpdlc", "CPDLC Notification", "Send climb, descent, direct, speed, and reply messages."]
    ];

    return `
        <section class="card wide">
            <h2>TELEX Functions</h2>
            <div class="telex-menu-grid">
                ${cards.map(([page, title, copy]) => `
                    <button class="item item-button telex-entry" data-telex-page="${page}">
                        <div class="item-title">
                            <span>${escapeHtml(title)}</span>
                            <span class="pill">OPEN</span>
                        </div>
                        <p>${escapeHtml(copy)}</p>
                    </button>
                `).join("")}
            </div>
        </section>
    `;
}

function renderTelexPageHeader(title) {
    return `
        <div class="item-title">
            <h2 style="margin:0;">${escapeHtml(title)}</h2>
            <button class="logout-btn" style="width:auto;padding:0 16px;" id="backTelexMenuBtn">BACK TO TELEX MENU</button>
        </div>
    `;
}

function renderAtcLogonPage() {
    return `
        <section class="card wide">
            ${renderTelexPageHeader("ATC LOGON")}
            <div class="field">
                <label for="atsuInput">ATSU</label>
                <input id="atsuInput" autocomplete="off" maxlength="8" placeholder="LECM" value="${escapeHtml(telexState.currentAtcUnit || "")}">
            </div>
            <button class="primary-btn" id="sendAtcLogonBtn">${telexState.currentAtcUnit ? "LOGOFF ATSU" : "REQUEST LOGON"}</button>
            <p class="empty" style="margin-top:10px;">Used for CPDLC connection management with an online ATSU.</p>
        </section>
    `;
}

function renderDclPage(context) {
    return `
        <section class="card wide">
            ${renderTelexPageHeader("Pre Departure Clearance")}
            <div class="field">
                <label for="dclTo">Station</label>
                <input id="dclTo" autocomplete="off" placeholder="Departure station" value="${escapeHtml(context.dep !== "N/A" ? context.dep : "SERVER")}">
            </div>
            <div class="grid" style="gap:10px;">
                <div class="field">
                    <label for="dclAircraftType">A/C Type</label>
                    <input id="dclAircraftType" autocomplete="off" maxlength="8" placeholder="A21N">
                </div>
                <div class="field">
                    <label for="dclStand">Stand</label>
                    <input id="dclStand" autocomplete="off" placeholder="A12">
                </div>
                <div class="field">
                    <label for="dclAtis">ATIS</label>
                    <input id="dclAtis" autocomplete="off" maxlength="1" placeholder="A">
                </div>
            </div>
            <div class="field">
                <label for="dclRemarks">Remarks</label>
                <input id="dclRemarks" autocomplete="off" maxlength="90" placeholder="Optional">
            </div>
            <button class="primary-btn" id="sendDclBtn">REQUEST DCL</button>
            <button class="logout-btn" style="width:100%;margin-top:10px;" id="loadVatsimPlanBtn">LOAD VATSIM FLIGHT PLAN</button>
        </section>
    `;
}

function renderCpdlcPage() {
    return `
        <section class="card wide">
            ${renderTelexPageHeader("CPDLC Notification")}
            <div class="field">
                <label for="requestTo">ATSU</label>
                <input id="requestTo" autocomplete="off" placeholder="Current ATSU" value="${escapeHtml(telexState.currentAtcUnit || "")}">
            </div>
            <div class="field">
                <label for="requestType">Request</label>
                <select id="requestType">
                    <option value="LEVEL">LEVEL</option>
                    <option value="DIRECT">DIRECT</option>
                    <option value="SPEED">SPEED</option>
                    <option value="WHEN">WHEN CAN WE?</option>
                    <option value="WILCO">WILCO</option>
                    <option value="UNABLE">UNABLE</option>
                    <option value="STANDBY">STANDBY</option>
                </select>
            </div>
            <div class="field">
                <label for="requestValue">Value</label>
                <input id="requestValue" autocomplete="off" placeholder="FL380 / FIX / 280K / HIGHER LEVEL">
            </div>
            <div class="field">
                <label for="requestReason">Reason</label>
                <select id="requestReason">
                    <option value="">None</option>
                    <option value="DUE TO WX">Due to WX</option>
                    <option value="DUE TO A/C PERFORMANCE">Due to A/C performance</option>
                </select>
            </div>
            <button class="primary-btn" id="sendCpdlcRequestBtn">SEND CPDLC</button>
            <button class="logout-btn" style="width:100%;margin-top:10px;" id="loadVatsimPlanBtn">LOAD VATSIM FLIGHT PLAN</button>
        </section>
    `;
}

function bindTelexWorkbench() {
    document.getElementById("telexPollBtn")?.addEventListener("click", () => hoppieRequest("poll"));
    document.querySelectorAll("[data-telex-page]").forEach((button) => {
        button.addEventListener("click", () => {
            telexState.page = button.dataset.telexPage;
            refreshTelexWorkbench();
        });
    });
    document.getElementById("backTelexMenuBtn")?.addEventListener("click", () => {
        telexState.page = "menu";
        refreshTelexWorkbench();
    });
    document.getElementById("sendAtcLogonBtn")?.addEventListener("click", sendAtcLogonToggle);
    document.getElementById("sendDclBtn")?.addEventListener("click", sendDclRequest);
    document.getElementById("sendCpdlcRequestBtn")?.addEventListener("click", sendCpdlcRequest);
    document.getElementById("loadVatsimPlanBtn")?.addEventListener("click", loadVatsimFlightPlan);
    bindReplyButtons();
}

async function connectTelex() {
    if (telexState.connected) {
        disconnectTelex();
        return;
    }
    await hoppieRequest("logon");
}

function disconnectTelex() {
    telexState.connected = false;
    telexState.currentAtcUnit = "";
    telexState.pendingLogon = "";
    telexState.page = "menu";
    renderTelex();
}

async function sendAtcLogonToggle() {
    const input = document.getElementById("atsuInput");
    const atsu = input.value.trim().toUpperCase();
    if (!atsu) {
        appendTelexLog("ATSU REQUIRED");
        return;
    }

    if (telexState.currentAtcUnit) {
        const packet = buildCpdlcPacket("LOGOFF", false);
        telexState.currentAtcUnit = "";
        await hoppieRequest("send", { to: atsu, type: "CPDLC", packet, display: "LOGOFF" });
    } else {
        const packet = buildCpdlcPacket("REQUEST LOGON", true);
        telexState.pendingLogon = atsu;
        await hoppieRequest("send", { to: atsu, type: "CPDLC", packet, display: "REQUEST LOGON" });
    }
    refreshTelexWorkbench();
}

async function sendDclRequest() {
    const context = buildTelexContext();
    const callsign = getTelexCallsign();
    const dep = document.getElementById("fpDep").textContent.trim();
    const arr = document.getElementById("fpArr").textContent.trim();
    const aircraftType = document.getElementById("dclAircraftType").value.trim().toUpperCase();
    const stand = document.getElementById("dclStand").value.trim().toUpperCase();
    const atis = document.getElementById("dclAtis").value.trim().toUpperCase();
    const remarks = document.getElementById("dclRemarks").value.trim().toUpperCase();

    if (!aircraftType || !stand || !atis) {
        appendTelexLog("A/C TYPE, STAND AND ATIS ARE REQUIRED FOR DCL");
        return;
    }

    const packet = `REQUEST PREDEP CLEARANCE ${callsign} ${aircraftType} ${dep} TO ${arr} AT ${dep} STAND ${stand} ATIS ${atis}${remarks ? ` ${remarks}` : ""}`;
    await hoppieRequest("send", {
        to: document.getElementById("dclTo").value.trim().toUpperCase() || context.dep || "SERVER",
        type: "TELEX",
        packet,
        display: packet
    });
}

async function sendCpdlcRequest() {
    const to = document.getElementById("requestTo").value.trim().toUpperCase() || telexState.currentAtcUnit;
    if (!to) {
        appendTelexLog("ATSU REQUIRED");
        return;
    }

    const message = buildCpdlcRequestText();
    if (!message) {
        appendTelexLog("REQUEST VALUE REQUIRED");
        return;
    }

    const packet = buildCpdlcPacket(message, true);
    await hoppieRequest("send", { to, type: "CPDLC", packet, display: message });
}

async function sendCpdlcReply(messageId, recipient, reply) {
    const responseId = nextTelexMessageId();
    const packet = `/data2/${responseId}/${messageId}/N/${reply}`;
    await hoppieRequest("send", {
        to: recipient,
        type: "CPDLC",
        packet,
        display: reply,
        skipCounter: true
    });
}

async function sendFreeTextReply(recipient, text) {
    const clean = String(text || "").trim().toUpperCase();
    if (!recipient || !clean) return;
    await hoppieRequest("send", {
        to: recipient,
        type: "TELEX",
        packet: clean,
        display: clean
    });
}

function buildCpdlcRequestText() {
    const type = document.getElementById("requestType").value;
    const value = document.getElementById("requestValue").value.trim().toUpperCase();
    const reason = document.getElementById("requestReason").value;

    if (["WILCO", "UNABLE", "STANDBY"].includes(type)) return type;
    if (!value) return "";

    let text = "";
    if (type === "LEVEL") text = `REQUEST ${normalizeFlightLevel(value)}`;
    if (type === "DIRECT") text = `REQUEST DIRECT TO ${value}`;
    if (type === "SPEED") text = `REQUEST ${value}`;
    if (type === "WHEN") text = `WHEN CAN WE EXPECT ${value}`;
    return `${text}${reason ? ` ${reason}` : ""}`.trim();
}

function buildCpdlcPacket(message, responseRequired) {
    const id = nextTelexMessageId();
    return `/data2/${id}//${responseRequired ? "Y" : "N"}/${message}`;
}

function nextTelexMessageId() {
    const id = telexState.messageCounter;
    telexState.messageCounter += 1;
    localStorage.setItem("hpf_telex_counter", String(telexState.messageCounter));
    return id;
}

async function hoppieRequest(action, overrides = {}) {
    const callsign = getTelexCallsign();
    const logon = document.getElementById("telexCode").value.trim();
    const to = overrides.to || "SERVER";
    const packet = overrides.packet || "";
    const status = document.getElementById("telexStatus");

    if (!callsign || !logon) {
        status.textContent = "MISSING DATA";
        appendTelexLog("CALLSIGN AND LOGON CODE ARE REQUIRED");
        return;
    }

    status.textContent = action === "poll" ? "POLLING" : "SENDING";
    appendTelexLog(`${action.toUpperCase()} ${callsign}${action === "send" ? ` TO ${to}` : ""}`);

    try {
        const res = await fetch("/api/hoppie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action,
                logon,
                from: callsign,
                to,
                packet,
                type: overrides.type || (action === "send" ? "TELEX" : undefined)
            })
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.message || json.error || `HTTP ${res.status}`);

        telexState.connected = true;
        updateTelexConnectionUi();
        status.textContent = action === "poll" ? "INBOX CHECKED" : "CONNECTED";
        if (action === "send") {
            addTelexMessage({ direction: "OUT", to, type: overrides.type || json.type || "TELEX", packet: overrides.display || packet });
        }
        appendTelexLog(`HOPPIE RAW: ${json.raw || "OK"}`);
        handleHoppieMessages(json.messages || []);
        refreshTelexWorkbench();
    } catch (err) {
        status.textContent = "ERROR";
        appendTelexLog(`HOPPIE ERROR: ${err.message}`);
    }
}

function updateTelexConnectionUi() {
    const button = document.getElementById("telexConnectBtn");
    const status = document.getElementById("telexStatus");
    if (button) button.textContent = telexState.connected ? "DISCONNECT" : "CONNECT";
    if (status) status.textContent = telexState.connected ? "CONNECTED" : "LOGGED OFF";
}

function handleHoppieMessages(messages) {
    messages.forEach((message) => {
        const parsed = parseCpdlcPacket(message.packet || "");
        if (parsed?.text?.startsWith("LOGON ACCEPTED") && telexState.pendingLogon) {
            telexState.currentAtcUnit = telexState.pendingLogon;
            telexState.pendingLogon = "";
        }
        if (parsed?.text?.includes("LOGOFF")) {
            telexState.currentAtcUnit = "";
            telexState.pendingLogon = "";
        }
        addTelexMessage({
            direction: "IN",
            from: message.from || "UNKNOWN",
            type: message.type || "TELEX",
            packet: message.packet || message.raw || "",
            cpdlc: parsed
        });
    });
}

function addTelexMessage(message) {
    telexState.messages.unshift({
        ...message,
        timestamp: new Date().toISOString()
    });
    telexState.messages = telexState.messages.slice(0, 40);
}

function renderTelexMessages() {
    if (!telexState.messages.length) {
        return `<p class="empty">No messages yet. Use CHECK INBOX to poll Hoppie.</p>`;
    }

    return telexState.messages.map((message, index) => {
        const cpdlc = message.cpdlc || parseCpdlcPacket(message.packet || "");
        const displayText = formatAcarsMessage(message, cpdlc);
        const peer = message.direction === "OUT" ? message.to : message.from;
        return `
            <article class="item telex-message">
                <div class="item-title">
                    <span>${escapeHtml(message.direction)} ${escapeHtml((message.type || "TELEX").toUpperCase())} ${escapeHtml(peer || "")}</span>
                    <span class="pill">${escapeHtml(formatTelexTime(message.timestamp))}</span>
                </div>
                <p>${escapeHtml(displayText)}</p>
                ${renderMessageManagement(index, message, cpdlc)}
            </article>
        `;
    }).join("");
}

function renderMessageManagement(index, message, cpdlc) {
    if (message.direction !== "IN") return "";
    const requiresCpdlcResponse = !!(cpdlc?.messageId && getAllowedReplies(cpdlc, message).length && !message.acknowledged);
    return `
        <div class="telex-management">
            <div class="telex-management-title">Message Management</div>
            <div class="telex-replies">
                <button class="template-btn" data-message-delete="${index}" ${requiresCpdlcResponse ? "disabled" : ""}>DELETE</button>
                <button class="template-btn" data-free-text-index="${index}">FREE TEXT</button>
            </div>
            ${cpdlc?.messageId ? renderReplyButtons(index, message, cpdlc) : ""}
        </div>
    `;
}

function renderReplyButtons(index, message, cpdlc) {
    const replies = getAllowedReplies(cpdlc, message);
    if (!replies.length) return "";
    return `
        <div class="telex-management-title">Reply Options</div>
        <div class="telex-replies">
            ${replies.map((reply) => `
                <button class="template-btn" data-reply-index="${index}" data-reply="${escapeHtml(reply)}">${escapeHtml(reply)}</button>
            `).join("")}
        </div>
    `;
}

function bindReplyButtons() {
    document.querySelectorAll("[data-reply-index]").forEach((button) => {
        button.addEventListener("click", () => {
            const message = telexState.messages[Number(button.dataset.replyIndex)];
            const cpdlc = message?.cpdlc || parseCpdlcPacket(message?.packet || "");
            if (!message || !cpdlc?.messageId) return;
            const reply = normalizeReplyCommand(button.dataset.reply);
            message.acknowledged = true;
            sendCpdlcReply(cpdlc.messageId, message.from, reply).then(refreshTelexWorkbench);
        });
    });
    document.querySelectorAll("[data-free-text-index]").forEach((button) => {
        button.addEventListener("click", () => {
            const message = telexState.messages[Number(button.dataset.freeTextIndex)];
            if (!message?.from) return;
            const text = window.prompt("Free text reply", "");
            if (!text) return;
            sendFreeTextReply(message.from, text).then(refreshTelexWorkbench);
        });
    });
    document.querySelectorAll("[data-message-delete]").forEach((button) => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.messageDelete);
            telexState.messages.splice(index, 1);
            refreshTelexWorkbench();
        });
    });
}

function refreshTelexWorkbench() {
    const current = document.getElementById("currentAtcUnit");
    if (current) current.textContent = telexState.currentAtcUnit || "----";
    const target = document.getElementById("telexWorkbench");
    if (target && telexState.connected) {
        target.innerHTML = renderTelexWorkbenchMarkup(buildTelexContext());
        bindTelexWorkbench();
    }
}

function parseCpdlcPacket(packet) {
    const match = String(packet || "").match(/^\/data2\/(\d+)\/(\d*)\/([A-Z]*)\/(.+)$/i);
    if (!match) return null;
    return {
        messageId: match[1],
        responseId: match[2] || "",
        responses: (match[3] || "").toUpperCase(),
        text: decodeHoppieText(match[4])
    };
}

function formatAcarsMessage(message, cpdlc) {
    const peer = message.direction === "OUT" ? message.to : message.from;
    const lines = [
        `${(message.type || "TELEX").toUpperCase()} ${message.direction === "OUT" ? "TO" : "FROM"} ${peer || "UNKNOWN"}`,
        `TIME ${formatTelexTime(message.timestamp)}`
    ];

    if (cpdlc?.messageId) {
        lines.push(`MSG ID ${cpdlc.messageId}`);
        if (cpdlc.responseId) lines.push(`RESP TO ${cpdlc.responseId}`);
        lines.push(`RESPONSE ${formatResponseCode(cpdlc.responses)}`);
        lines.push("");
        lines.push(cpdlc.text || "N/A");
        return lines.join("\n");
    }

    lines.push("");
    lines.push(decodeHoppieText(message.packet || message.raw || "N/A"));
    return lines.join("\n");
}

function decodeHoppieText(value) {
    return String(value || "")
        .replace(/\{[^}]*\}/g, "")
        .replace(/@@/g, " N/A ")
        .replace(/@/g, "\n")
        .replace(/_/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s+/g, "\n")
        .replace(/\s+\n/g, "\n")
        .trim();
}

function formatResponseCode(code) {
    const map = {
        WU: "WILCO / UNABLE",
        AN: "AFFIRM / NEGATIVE",
        R: "ROGER",
        Y: "RESPONSE REQUIRED",
        N: "NO RESPONSE REQUIRED"
    };
    return map[code] || code || "N/A";
}

function getAllowedReplies(cpdlc, message = {}) {
    const code = typeof cpdlc === "string" ? cpdlc : cpdlc?.responses;
    const text = `${cpdlc?.text || ""} ${message.packet || ""}`.toUpperCase();
    const replies = [];
    if (code === "WU") replies.push("WILCO", "UNABLE", "STANDBY");
    if (code === "AN") replies.push("AFFIRMATIVE", "NEGATIVE", "STANDBY");
    if (code === "R") replies.push("ROGER", "UNABLE", "STANDBY");
    if (code === "Y") replies.push("ROGER", "STANDBY");
    if (/PREDEP|PDC|CLEARANCE|CLRD|CLEARED|RCD/.test(text)) replies.push("ACCEPT", "REJECT");
    if (!replies.length && cpdlc?.messageId) replies.push("ROGER", "STANDBY");
    return [...new Set(replies)];
}

function normalizeReplyCommand(reply) {
    if (reply === "ACCEPT") return "WILCO";
    if (reply === "REJECT") return "UNABLE";
    return reply;
}

function appendTelexLog(line) {
    const log = document.getElementById("telexLog");
    if (!log) return;
    log.textContent += `\n${line}`;
    log.scrollTop = log.scrollHeight;
}

function buildTelexContext() {
    const settings = getTelexSettings();
    const booking = Array.isArray(bookingsData) && bookingsData.length ? bookingsData[0] : null;
    const networks = pilotData?.networks || {};
    return {
        logonCode: settings.logonCode || "",
        callsign: booking?.callsign || "",
        vatsimId: networks.vatsim_id || pilotData?.vatsim_id || "",
        dep: booking ? shortAirport(booking, "departure") : "N/A",
        arr: booking ? shortAirport(booking, "arrival") : "N/A",
        level: booking?.altitude ? `FL${Math.round(Number(booking.altitude) / 100)}` : "N/A",
        route: booking?.user_route || ""
    };
}

async function loadVatsimFlightPlan() {
    const networks = pilotData?.networks || {};
    const vatsimId = networks.vatsim_id || pilotData?.vatsim_id;
    if (!vatsimId) {
        appendTelexLog("VATSIM ID NOT AVAILABLE IN PILOT PROFILE");
        return;
    }

    appendTelexLog(`LOADING VATSIM FLIGHT PLAN FOR ${vatsimId}...`);
    try {
        const res = await fetch(`https://api.vatsim.net/v2/members/${encodeURIComponent(vatsimId)}/flightplans`);
        if (!res.ok) throw new Error(`VATSIM HTTP ${res.status}`);
        const json = await res.json();
        const plan = Array.isArray(json) ? json[0] : (json.data?.[0] || json.results?.[0] || json.flightplans?.[0] || json);
        applyVatsimFlightPlan(plan || {});
        appendTelexLog("VATSIM FLIGHT PLAN LOADED");
    } catch (err) {
        appendTelexLog(`VATSIM FLIGHT PLAN ERROR: ${err.message}`);
    }
}

function applyVatsimFlightPlan(plan) {
    const dep = plan.departure || plan.departure_airport || plan.dep || plan.departure_icao || "N/A";
    const arr = plan.arrival || plan.arrival_airport || plan.arr || plan.arrival_icao || "N/A";
    const route = plan.route || plan.flight_route || plan.filed_route || "";
    const altitude = plan.altitude || plan.cruise_tas || plan.flight_level || "N/A";
    document.getElementById("fpDep").textContent = dep;
    document.getElementById("fpArr").textContent = arr;
    document.getElementById("fpLevel").textContent = formatFlightLevel(altitude);
    const routeBox = document.getElementById("telexRoute");
    if (routeBox) routeBox.value = route;
}

function formatFlightLevel(value) {
    const text = String(value || "N/A").toUpperCase();
    if (text.startsWith("FL")) return text;
    const num = Number.parseInt(text, 10);
    return Number.isFinite(num) ? `FL${Math.round(num / 100)}` : text;
}

function normalizeFlightLevel(value) {
    const text = String(value || "").toUpperCase().replace(/\s+/g, "");
    if (text.startsWith("FL")) return text;
    const num = Number.parseInt(text, 10);
    return Number.isFinite(num) ? `FL${num}` : text;
}

function shortAirport(data, side) {
    const route = lookupRoute(data.route_id);
    if (route) return side === "departure" ? route.departure : route.arrival;
    const airport = lookupAirport(data?.[`${side}_id`]);
    return airport?.icao || data?.[`${side}_icao`] || data?.[`${side}_id`] || "N/A";
}

function getTelexCallsign() {
    return document.getElementById("telexCallsign").value.trim().toUpperCase();
}

function formatTelexTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "UTC";
    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}Z`;
}
