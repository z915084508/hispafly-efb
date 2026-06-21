function renderTelex() {
            const context = buildTelexContext();
            document.getElementById("mainPanel").innerHTML = `
                <div class="telex">
                    <section class="card telex-connection">
                        <div class="item-title">
                            <h2 style="margin:0;">Connection</h2>
                            <span class="telex-status" id="telexStatus">LOGGED OFF</span>
                        </div>
                        <div class="field">
                            <label for="telexCallsign">Callsign</label>
                            <input id="telexCallsign" autocomplete="off" placeholder="HPF123" value="${escapeHtml(context.callsign)}">
                        </div>
                        <div class="field">
                            <label for="telexCode">Hoppie Logon Code</label>
                            <input id="telexCode" type="password" autocomplete="off" placeholder="Saved in Pilot Profile" value="${escapeHtml(context.logonCode)}">
                        </div>
                        <button class="primary-btn" id="telexLogonBtn">LOGON</button>
                        <div class="data-list" style="margin-top:14px;">
                            <div class="data-row"><span>DEP</span><strong id="fpDep">${escapeHtml(context.dep)}</strong></div>
                            <div class="data-row"><span>ARR</span><strong id="fpArr">${escapeHtml(context.arr)}</strong></div>
                            <div class="data-row"><span>FL</span><strong id="fpLevel">${escapeHtml(context.level)}</strong></div>
                        </div>
                        <div class="message-log" id="telexLog" style="margin-top:14px;min-height:140px;">HISPAFLY TELEX READY
LOGON REQUIRED</div>
                    </section>
                    <div id="telexWorkbench"></div>
                </div>
            `;

            document.getElementById("telexLogonBtn").addEventListener("click", () => {
                hoppieRequest("logon");
            });
        }

        function renderTelexWorkbench(context) {
            document.getElementById("telexWorkbench").innerHTML = `
                <div class="telex-workbench">
                    <section class="card">
                        <h2>Pre Departure Clearance</h2>
                        <div class="field">
                            <label for="dclTo">Station</label>
                            <input id="dclTo" autocomplete="off" placeholder="ATC station or SERVER" value="SERVER">
                        </div>
                        <div class="field">
                            <label for="telexRoute">Flight Plan Route</label>
                            <textarea id="telexRoute" placeholder="VATSIM route">${escapeHtml(context.route)}</textarea>
                        </div>
                        <button class="logout-btn" style="width:100%;margin-bottom:10px;" id="loadVatsimPlanBtn">LOAD VATSIM FLIGHT PLAN</button>
                        <button class="primary-btn" id="sendDclBtn">REQUEST DCL</button>
                    </section>
                    <section class="card">
                        <h2>Notification</h2>
                        <div class="field">
                            <label for="notifyTo">Station</label>
                            <input id="notifyTo" autocomplete="off" placeholder="ATC station or callsign">
                        </div>
                        <div class="field">
                            <label for="notifyType">Action</label>
                            <select id="notifyType">
                                <option value="REQUEST CLIMB">REQUEST CLIMB</option>
                                <option value="REQUEST DESCENT">REQUEST DESCENT</option>
                                <option value="REQUEST DIRECT">REQUEST DIRECT</option>
                                <option value="WILCO">WILCO</option>
                                <option value="UNABLE">UNABLE</option>
                                <option value="STANDBY">STANDBY</option>
                            </select>
                        </div>
                        <div class="field">
                            <label for="notifyValue">Value</label>
                            <input id="notifyValue" autocomplete="off" placeholder="FL380 / FIX / message text">
                        </div>
                        <button class="primary-btn" id="sendNotificationBtn">SEND NOTIFICATION</button>
                        <button class="logout-btn" style="width:100%;margin-top:10px;" id="telexPollBtn">CHECK INBOX</button>
                    </section>
                </div>
            `;
            document.getElementById("sendDclBtn").addEventListener("click", sendDclRequest);
            document.getElementById("sendNotificationBtn").addEventListener("click", sendNotification);
            document.getElementById("telexPollBtn").addEventListener("click", () => hoppieRequest("poll"));
            document.getElementById("loadVatsimPlanBtn").addEventListener("click", loadVatsimFlightPlan);
        }

        async function sendDclRequest() {
            const callsign = document.getElementById("telexCallsign").value.trim().toUpperCase();
            const route = document.getElementById("telexRoute").value.trim();
            const packet = `REQUEST DCL ${callsign} ${document.getElementById("fpDep").textContent}-${document.getElementById("fpArr").textContent} ${route ? `ROUTE ${route}` : ""}`.trim();
            await hoppieRequest("send", {
                to: document.getElementById("dclTo").value.trim().toUpperCase() || "SERVER",
                packet,
                type: "telex"
            });
        }

        async function sendNotification() {
            const action = document.getElementById("notifyType").value;
            const value = document.getElementById("notifyValue").value.trim().toUpperCase();
            await hoppieRequest("send", {
                to: document.getElementById("notifyTo").value.trim().toUpperCase() || "SERVER",
                packet: `${action}${value ? ` ${value}` : ""}`,
                type: "cpdlc"
            });
        }

        async function hoppieRequest(action, overrides = {}) {
            const callsign = document.getElementById("telexCallsign").value.trim().toUpperCase();
            const logon = document.getElementById("telexCode").value.trim();
            const to = overrides.to || "SERVER";
            const packet = overrides.packet || "";
            const log = document.getElementById("telexLog");
            const status = document.getElementById("telexStatus");

            if (!callsign || !logon) {
                status.textContent = "MISSING DATA";
                log.textContent += "\n\nCALLSIGN AND LOGON CODE ARE REQUIRED";
                return;
            }

            status.textContent = action === "poll" ? "POLLING" : "SENDING";
            log.textContent += `\n\n${action.toUpperCase()} ${callsign}${action === "send" ? ` TO ${to}` : ""}`;

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
                        type: overrides.type || (action === "send" ? "telex" : undefined)
                    })
                });
                const json = await res.json();
                if (!res.ok || json.error) throw new Error(json.message || json.error || `HTTP ${res.status}`);
                status.textContent = json.raw?.trim()?.toUpperCase() === "OK" || json.ok ? "CONNECTED" : "RECEIVED";
                log.textContent += `\nHOPPIE RAW: ${json.raw || "OK"}`;
                if (action === "logon") {
                    const context = buildTelexContext();
                    context.callsign = callsign;
                    renderTelexWorkbench(context);
                }
                if (Array.isArray(json.messages) && json.messages.length) {
                    json.messages.forEach((message) => {
                        log.textContent += `\nIN ${message.from || "UNKNOWN"} ${message.type || ""}\n${message.packet || message.raw}`;
                    });
                }
            } catch (err) {
                status.textContent = "ERROR";
                log.textContent += `\nHOPPIE ERROR: ${err.message}`;
            }
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
            const log = document.getElementById("telexLog");
            if (!vatsimId) {
                log.textContent += "\n\nVATSIM ID NOT AVAILABLE IN PILOT PROFILE";
                return;
            }

            log.textContent += `\n\nLOADING VATSIM FLIGHT PLAN FOR ${vatsimId}...`;
            try {
                const res = await fetch(`https://api.vatsim.net/v2/members/${encodeURIComponent(vatsimId)}/flightplans`);
                if (!res.ok) throw new Error(`VATSIM HTTP ${res.status}`);
                const json = await res.json();
                const plan = Array.isArray(json) ? json[0] : (json.data?.[0] || json.results?.[0] || json.flightplans?.[0] || json);
                applyVatsimFlightPlan(plan || {});
                log.textContent += "\nVATSIM FLIGHT PLAN LOADED";
            } catch (err) {
                log.textContent += `\nVATSIM FLIGHT PLAN ERROR: ${err.message}`;
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

        function shortAirport(data, side) {
            const route = lookupRoute(data.route_id);
            if (route) return side === "departure" ? route.departure : route.arrival;
            const airport = lookupAirport(data?.[`${side}_id`]);
            return airport?.icao || data?.[`${side}_icao`] || data?.[`${side}_id`] || "N/A";
        }
