const API_ROOT = "/api/aoc-proxy";
        const API_SOURCE = "HISPAFLY_AOC";
        let currentView = "home";
        let pilotData = null;
        let profileData = null;
        let rankData = null;
        let statisticsData = null;
        let bookingsData = null;
        let pirepsData = null;
        let claimsData = null;
        let notamsData = null;
        let windyLocation = { label: "Madrid Area", lat: 40.4, lon: -3.7, zoom: 5 };
        let windySearchStatus = "Default radar area";
        let dictionaryQuery = "";
        let dictionaryCategory = "All";
        let selectedDictionaryTerm = null;
        let abbreviationEntries = null;
        let abbreviationLoadPromise = null;
        let checklistPhaseId = null;
        let checklistAircraftId = localStorage.getItem("hispafly_checklist_aircraft") || "b737-800";
        const AOC_API_BASE_URL = "/api/aoc-proxy";
        let performanceActiveFlight = null;
        let performanceHistory = null;
        let performanceTab = "flight";
        let takeoffResult = null;
        let landingResult = null;
        let performanceLoadError = "";
        let performanceLoadsheetData = null;
        let performanceLoadsheetError = "";
        const performanceWeatherCache = new Map();
        const performanceWeatherLoading = new Map();
        const authHeader = {
            "Accept": "application/json"
        };

        const dashboardApps = [
            { view: "notams", label: "NOTAM", subhead: "Operational notices", icon: "assets/app-icons/notams.png" },
            { view: "profile", label: "Pilot Profile", subhead: "Identity and rank", icon: "assets/app-icons/profile.png" },
            { view: "flightCenter", label: "Flight Center", subhead: "Bookings and OFP", icon: "assets/app-icons/flight-center.png" },
            {
                folder: "weather",
                label: "WEATHER",
                subhead: "WX and radar",
                icon: "assets/app-icons/weather.png",
                apps: [
                    { view: "weather", label: "WX Info", subhead: "METAR and TAFOR by ICAO", icon: "assets/app-icons/weather.png" },
                    { view: "windy", label: "WINDY", subhead: "Weather radar", icon: "assets/app-icons/windy-radar.svg" }
                ]
            },
            {
                folder: "tools",
                label: "TOOLS",
                subhead: "Checklist and dictionary",
                icon: "assets/app-icons/dictionary.svg",
                apps: [
                    { view: "checklist", label: "CHECKLIST", subhead: "Interactive flight flows", icon: "assets/app-icons/checklist.svg" },
                    { view: "performance", label: "PERFORMANCE", subhead: "Takeoff and landing", icon: "assets/app-icons/performance.svg" },
                    { view: "dictionary", label: "Dictionary", subhead: "Pilot terminology", icon: "assets/app-icons/dictionary.svg" }
                ]
            },
            { view: "telex", label: "TELEX", subhead: "Hoppie ACARS", icon: "assets/app-icons/telex.png" },
            { view: "cdmAirport", label: "CDM Airport", subhead: "Airport queue", icon: "assets/app-icons/cdm-airport.png" },
            { view: "liveMap", label: "Live Map", subhead: "HISPAFLY AOC live ops", icon: "assets/app-icons/live-map.png" }
        ];

        window.addEventListener("DOMContentLoaded", () => {
            updateUtcTime();
            setInterval(updateUtcTime, 30000);
            setupNavigation();
            loadInitialDashboard();
        });

        function updateUtcTime() {
            const now = new Date();
            const hours = String(now.getUTCHours()).padStart(2, "0");
            const minutes = String(now.getUTCMinutes()).padStart(2, "0");
            document.getElementById("utcTime").textContent = `${hours}:${minutes} UTC`;
        }

        function setupNavigation() {
            document.getElementById("homeBtn").addEventListener("click", () => setView("home"));
            document.getElementById("refreshBtn").addEventListener("click", () => refreshCurrentView(true));
            document.getElementById("logoutBtn").addEventListener("click", logout);
        }

        async function loadInitialDashboard() {
            try {
                await loadPilotProfile();
            } catch (err) {
                console.warn("Pilot profile unavailable", err);
            }
            await setView(window.HISPAFLY_INITIAL_VIEW || "home");
        }

        async function setView(view) {
            if (currentView === "cdmAirport" && view !== "cdmAirport" && typeof stopCdmAutoRefresh === "function") {
                stopCdmAutoRefresh();
            }
            if (currentView === "liveMap" && view !== "liveMap" && typeof stopLiveMapAutoRefresh === "function") {
                stopLiveMapAutoRefresh();
            }
            currentView = view;
            document.querySelector(".content").classList.toggle("is-home", view === "home");
            document.getElementById("homeBtn").hidden = view === "home";
            document.getElementById("refreshBtn").hidden = view === "home";
            updateHeader(view);
            await refreshCurrentView(false);
        }

        function updateHeader(view) {
            const copy = {
                home: ["HISPAFLY EFB", "Dashboard", "Select an EFB function."],
                notams: ["Operations", "NOTAM", "Operational notices and airline advisories."],
                profile: ["Pilot", "Pilot Profile", "Crew identity, network IDs, rank, and flight time."],
                pirepLogbook: ["Logbook", "PIREP Logbook", "Select a PIREP to open the full pilot report."],
                flightCenter: ["Flights", "Flight Center", "Current bookings and dispatch documents."],
                dictionary: ["Pilot Tools", "Terminology Dictionary", "Search VATSIM Spain, phraseology, and safety terms."],
                weather: ["Weather", "WX Info", "Request weather information by airport ICAO."],
                windy: ["Weather", "WINDY Radar", "Interactive weather radar and forecast layers."],
                telex: ["ACARS", "TELEX", "Hoppie ACARS style logon, inbox, and telex compose station."],
                cdmAirport: ["Airport CDM", "CDM Airport Status", "Airport departure queue and ATFCM status."],
                liveMap: ["Live Ops", "Live Flight Map", "Real-time HISPAFLY AOC flight positions."],
                checklist: ["Flight Deck", "CHECKLIST", "Interactive phase checklists with automatic local progress saving."],
                performance: ["Performance", "EFB Performance", "Official and manual takeoff or landing calculations."]
            }[view];
            document.getElementById("viewEyebrow").textContent = copy[0];
            document.getElementById("viewTitle").textContent = copy[1];
            document.getElementById("viewSubhead").textContent = copy[2];
        }

        async function refreshCurrentView(force) {
            const panel = document.getElementById("mainPanel");
            if (currentView === "home") {
                renderHome();
                return;
            }
            panel.innerHTML = `<p class="empty">Loading ${escapeHtml(currentView)}...</p>`;

            try {
                if (currentView === "notams") {
                    if (!notamsData || force) notamsData = await loadNotams();
                    renderNotams();
                } else if (currentView === "profile") {
                    if (!pilotData || force) await loadPilotProfile();
                    renderProfile();
                } else if (currentView === "pirepLogbook") {
                    if (!pirepsData || force) pirepsData = await loadPireps();
                    renderPirepLogbook();
                } else if (currentView === "flightCenter") {
                    if (!bookingsData || force) bookingsData = await loadBookings();
                    renderFlightCenter();
                } else if (currentView === "dictionary") {
                    await renderDictionary();
                } else if (currentView === "weather") {
                    renderWeather();
                } else if (currentView === "windy") {
                    renderWindy();
                } else if (currentView === "telex") {
                    if (!bookingsData || force) bookingsData = await loadBookings();
                    renderTelex();
                } else if (currentView === "cdmAirport") {
                    renderCdmAirport();
                } else if (currentView === "liveMap") {
                    renderLiveFlightMap();
                } else if (currentView === "checklist") {
                    renderChecklist();
                } else if (currentView === "performance") {
                    if (!performanceActiveFlight || force) {
                        try {
                            performanceActiveFlight = await loadPerformanceActiveFlight();
                            performanceLoadError = "";
                        } catch (err) {
                            performanceActiveFlight = { active: false, mode: "MANUAL" };
                            performanceLoadError = normalizePerformanceError(err);
                        }
                        seedPerformanceForms();
                    }
                    if (performanceTab === "history" && (!performanceHistory || force)) {
                        performanceHistory = await loadPerformanceHistory();
                    }
                    if (performanceTab === "loadsheet" && (!performanceLoadsheetData || force)) {
                        await loadPerformanceLoadsheet();
                    }
                    renderPerformance();
                }
            } catch (err) {
                panel.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
            }
        }

        function renderHome() {
            const name = buildName(pilotData || {}) || "HISPAFLY Pilot";
            const rank = getRank();
            const apps = dashboardApps.map(renderHomeApp).join("");

            document.getElementById("mainPanel").innerHTML = `
                <section class="home-screen">
                    <div class="home-identity">
                        <div>
                            <span class="home-kicker">Crew tablet</span>
                            <strong>${escapeHtml(name)}</strong>
                            <small>${escapeHtml(rank)}</small>
                        </div>
                        <div class="home-links">
                            <a href="privacy-policy.html">Privacy</a>
                            <a href="intellectual-property.html">IP Notice</a>
                        </div>
                    </div>
                    <div class="app-grid" aria-label="EFB functions">
                        ${apps}
                    </div>
                    <div id="appFolderHost"></div>
                </section>
            `;

            document.querySelectorAll("[data-home-view]").forEach((button) => {
                button.addEventListener("click", () => setView(button.dataset.homeView));
            });
            document.querySelectorAll("[data-home-folder]").forEach((button) => {
                button.addEventListener("click", () => openAppFolder(button.dataset.homeFolder));
            });
        }

        function renderHomeApp(app) {
            if (app.folder) {
                const miniIcons = app.apps.map((child) => `
                    <span><img src="${escapeHtml(child.icon)}" alt=""></span>
                `).join("");

                return `
                    <button class="app-tile" data-home-folder="${escapeHtml(app.folder)}">
                        <span class="app-icon folder-icon" aria-hidden="true">
                            ${miniIcons}
                        </span>
                        <span class="app-label">${escapeHtml(app.label)}</span>
                        <span class="app-subhead">${escapeHtml(app.subhead)}</span>
                    </button>
                `;
            }

            return `
                <button class="app-tile" data-home-view="${escapeHtml(app.view)}">
                    <span class="app-icon" aria-hidden="true">
                        <img src="${escapeHtml(app.icon)}" alt="">
                    </span>
                    <span class="app-label">${escapeHtml(app.label)}</span>
                    <span class="app-subhead">${escapeHtml(app.subhead)}</span>
                </button>
            `;
        }

        function openAppFolder(folderId) {
            const folder = dashboardApps.find((app) => app.folder === folderId);
            const host = document.getElementById("appFolderHost");
            if (!folder || !host) return;

            const items = folder.apps.map((app) => `
                <button class="folder-app-tile" data-folder-view="${escapeHtml(app.view)}">
                    <span class="app-icon" aria-hidden="true">
                        <img src="${escapeHtml(app.icon)}" alt="">
                    </span>
                    <span class="app-label">${escapeHtml(app.label)}</span>
                    <span class="app-subhead">${escapeHtml(app.subhead)}</span>
                </button>
            `).join("");

            host.innerHTML = `
                <div class="app-folder-overlay" data-close-folder>
                    <section class="app-folder-panel" aria-label="${escapeHtml(folder.label)} folder">
                        <div class="app-folder-head">
                            <strong>${escapeHtml(folder.label)}</strong>
                            <button class="icon-btn" type="button" data-close-folder aria-label="Close folder">×</button>
                        </div>
                        <div class="app-folder-grid">
                            ${items}
                        </div>
                    </section>
                </div>
            `;

            host.querySelectorAll("[data-folder-view]").forEach((button) => {
                button.addEventListener("click", () => setView(button.dataset.folderView));
            });
            host.querySelectorAll("[data-close-folder]").forEach((element) => {
                element.addEventListener("click", (event) => {
                    if (event.target === element || element.matches("button")) host.innerHTML = "";
                });
            });
        }

        function buildApiUrl(path, params = {}) {
            const url = new URL("/api/aoc-proxy", window.location.origin);
            url.searchParams.set("path", `/api/efb/pilot${path}`);
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    url.searchParams.set(key, value);
                }
            });
            return url.toString();
        }

        async function fetchPilotJson(path, params = {}, options = {}) {
            const url = buildApiUrl(path, params);
            const res = await fetch(url, {
                method: options.method || "GET",
                headers: {
                    ...authHeader,
                    ...(options.body ? { "Content-Type": "application/json" } : {})
                },
                body: options.body ? JSON.stringify(options.body) : undefined
            });
            const text = await res.text();

            if (res.status === 204) {
                return { data: null };
            }

            let json;
            try {
                json = text ? JSON.parse(text) : { data: null };
            } catch (err) {
                const preview = text.replace(/\s+/g, " ").slice(0, 180) || "empty response";
                throw new Error(`HISPAFLY AOC returned non-JSON for ${path} (HTTP ${res.status}): ${preview}`);
            }

            if (!res.ok) {
                const msg = json.message || json.error || JSON.stringify(json).slice(0, 180);
                if (res.status === 401) window.location.href = "index.html";
                throw new Error(`HISPAFLY AOC ${path} failed (HTTP ${res.status}): ${msg}`);
            }

            return json;
        }

        async function loadPilotProfile() {
            const [userResult, profileResult, rankResult, statisticsResult] = await Promise.allSettled([
                fetchPilotJson("/user"),
                fetchPilotJson("/profile"),
                fetchPilotJson("/rank"),
                fetchPilotJson("/statistics")
            ]);

            if (userResult.status === "fulfilled") {
                pilotData = userResult.value.data || {};
            } else {
                throw userResult.reason;
            }

            profileData = profileResult.status === "fulfilled" ? (profileResult.value.data || {}) : {};
            rankData = rankResult.status === "fulfilled" ? (rankResult.value.data || {}) : {};
            statisticsData = statisticsResult.status === "fulfilled" ? (statisticsResult.value.data || {}) : {};

            const fullName = buildName(pilotData);
            const pilotNameEl = document.getElementById("pilotName");
            const pilotRankEl = document.getElementById("pilotRank");
            if (pilotNameEl) pilotNameEl.textContent = fullName || "HISPAFLY Pilot";
            if (pilotRankEl) pilotRankEl.textContent = getRank();
            return pilotData;
        }

        async function loadBookings() {
            const json = await fetchPilotJson("/bookings", {
                sort: "-id",
                "page[size]": "10",
                "filter[status]": "current"
            });
            return json.data || [];
        }

        async function loadPireps() {
            const json = await fetchPilotJson("/pireps", {
                sort: "-id",
                "page[size]": "10"
            });
            return json.data || [];
        }

        async function loadClaims() {
            try {
                const json = await fetchPilotJson("/claims", {
                    sort: "-id",
                    "page[size]": "6"
                });
                return json.data || [];
            } catch (err) {
                return { error: err.message };
            }
        }

        async function loadNotams() {
            const json = await fetchPilotJson("/notams", {
                sort: "-id",
                "page[size]": "20"
            });
            return json.data || json || [];
        }

        function renderNotams() {
            const list = Array.isArray(notamsData?.data)
                ? notamsData.data
                : (Array.isArray(notamsData) ? notamsData : []);
            if (list.length === 0) {
                document.getElementById("mainPanel").innerHTML = `
                    <div class="card">
                        <h2>NOTAM</h2>
                        <p class="empty">No NOTAMs were returned.</p>
                    </div>
                `;
                return;
            }

            const html = list.map((notam) => {
                const title = notam.title || notam.subject || notam.name || `NOTAM #${formatValue(notam.id)}`;
                const status = notam.read || notam.read_at || notam.is_read ? "Read" : "Unread";
                const body = notam.body || notam.content || notam.message || notam.description || "No content preview";
                const preview = htmlToText(body).slice(0, 180) || "No content preview";
                return `
                    <button class="item item-button" data-notam-id="${escapeHtml(notam.id)}">
                        <div class="item-title">
                            <span>${escapeHtml(title)}</span>
                            <span class="pill">${escapeHtml(status)}</span>
                        </div>
                        <p>${escapeHtml(preview)}</p>
                        <div class="meta" style="margin-top:12px;">
                            <span>ID: ${escapeHtml(formatValue(notam.id))}</span>
                            <span>Issued: ${escapeHtml(formatDate(notam.created_at || notam.published_at || notam.start_at))}</span>
                            <span>Expires: ${escapeHtml(formatDate(notam.expires_at || notam.end_at))}</span>
                        </div>
                    </button>
                `;
            }).join("");

            document.getElementById("mainPanel").innerHTML = `
                <div class="grid">
                    <section class="card">
                        <h2>NOTAM List</h2>
                        <div class="list">${html}</div>
                    </section>
                    <section class="card">
                        <h2>NOTAM Detail</h2>
                        <div id="notamDetail">
                            <p class="empty">Select a NOTAM to view details.</p>
                        </div>
                    </section>
                </div>
            `;

            document.querySelectorAll("[data-notam-id]").forEach((button) => {
                button.addEventListener("click", () => showNotam(button.dataset.notamId));
            });
        }

        function showNotam(id) {
            const notam = findNotam(id);
            const box = document.getElementById("notamDetail");
            if (!notam) {
                box.innerHTML = `<p class="error">NOTAM not found.</p>`;
                return;
            }

            const title = notam.title || notam.subject || notam.name || `NOTAM #${formatValue(notam.id)}`;
            const body = notam.body || notam.content || notam.message || notam.description || "No content returned.";
            box.innerHTML = `
                <div class="data-list">
                    <div class="data-row"><span>Title</span><strong>${escapeHtml(title)}</strong></div>
                    <div class="data-row"><span>ID</span><strong>${escapeHtml(formatValue(notam.id))}</strong></div>
                    <div class="data-row"><span>Status</span><strong>${escapeHtml(notam.read || notam.read_at || notam.is_read ? "Read" : "Unread")}</strong></div>
                    <div class="data-row"><span>Issued</span><strong>${escapeHtml(formatDate(notam.created_at || notam.published_at || notam.start_at))}</strong></div>
                    <div class="data-row"><span>Expires</span><strong>${escapeHtml(formatDate(notam.expires_at || notam.end_at))}</strong></div>
                </div>
                <div class="notam-content">${sanitizeHtml(body)}</div>
                <button class="primary-btn" style="margin-top:14px;" id="markNotamReadBtn">MARK NOTAM AS READ</button>
            `;
            document.getElementById("markNotamReadBtn").addEventListener("click", () => markNotamRead(id));
        }

        function sanitizeHtml(input) {
            const template = document.createElement("template");
            template.innerHTML = String(input || "");
            const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "H1", "H2", "H3"]);

            template.content.querySelectorAll("*").forEach((node) => {
                if (!allowedTags.has(node.tagName)) {
                    const text = document.createTextNode(node.textContent || "");
                    node.replaceWith(text);
                    return;
                }
                [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
            });

            const html = template.innerHTML.trim();
            if (html) return html;
            return `<p>${escapeHtml(htmlToText(input) || "No content returned.")}</p>`;
        }

        function htmlToText(input) {
            const template = document.createElement("template");
            template.innerHTML = String(input || "");
            return (template.content.textContent || "")
                .replace(/\u00a0/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function findNotam(id) {
            const list = Array.isArray(notamsData?.data)
                ? notamsData.data
                : (Array.isArray(notamsData) ? notamsData : []);
            return list.find((item) => String(item.id) === String(id));
        }

        async function markNotamRead(id) {
            const box = document.getElementById("notamDetail");
            try {
                await fetchPilotJson(`/notams/${id}/read`, {}, { method: "POST", body: {} });
                notamsData = await loadNotams();
                renderNotams();
                const detail = document.getElementById("notamDetail");
                detail.innerHTML = `<p class="ok">NOTAM #${escapeHtml(id)} marked as read.</p>`;
            } catch (err) {
                box.innerHTML += `<p class="error" style="margin-top:12px;">${escapeHtml(err.message)}</p>`;
            }
        }

        function renderProfile() {
            const u = pilotData || {};
            const networks = u.networks || {};
            const rows = [
                ["Full Name", buildName(u)],
                ["Email", u.email],
                ["VATSIM ID", networks.vatsim_id || u.vatsim_id],
                ["IVAO ID", networks.ivao_id || u.ivao_id],
                ["Pilot ID", profileData?.id || u.pilot?.id || u.id || u.pilot_id],
                ["Total Flight Time", getFlightTime()],
                ["Current Rank", getRank()]
            ];

            document.getElementById("mainPanel").innerHTML = `
                <div class="grid">
                    <section class="card">
                        <h2>Pilot Profile</h2>
                        <div class="data-list">
                            ${rows.map(([label, value]) => `
                                <div class="data-row">
                                    <span>${escapeHtml(label)}</span>
                                    <strong>${escapeHtml(formatValue(value))}</strong>
                                </div>
                            `).join("")}
                        </div>
                    </section>
                    <section class="card">
                        <h2>TELEX Settings</h2>
                        <div class="field">
                            <label for="savedTelexCode">Hoppie LOGON Code</label>
                            <input id="savedTelexCode" type="password" autocomplete="off" placeholder="Saved locally in this browser">
                        </div>
                        <button class="primary-btn" id="saveTelexSettingsBtn">SAVE TELEX SETTINGS</button>
                        <button class="logout-btn" style="width:100%;margin-top:10px;" id="clearTelexSettingsBtn">CLEAR SETTINGS</button>
                        <p class="empty" style="margin-top:12px;">Stored locally on this browser. A secure backend vault can replace this later.</p>
                    </section>
                    <section class="card wide">
                        <h2>Profile Tools</h2>
                        <div class="action-grid">
                            <button class="action-card item-button" id="openPirepLogbookBtn">
                                <strong>PIREP Logbook</strong>
                                <p>Open submitted reports and inspect full pilot report details.</p>
                            </button>
                        </div>
                    </section>
                </div>
            `;
            loadTelexSettingsForm();
            document.getElementById("openPirepLogbookBtn").addEventListener("click", () => setView("pirepLogbook"));
        }

        function getTelexSettings() {
            try {
                return JSON.parse(localStorage.getItem("hpf_telex_settings") || "{}");
            } catch (err) {
                return {};
            }
        }

        function saveTelexSettings(settings) {
            localStorage.setItem("hpf_telex_settings", JSON.stringify(settings));
        }

        function getChecklistDefinition() {
            const fleet = window.HISPAFLY_CHECKLISTS || { id: "empty", aircraft: [] };
            const selected = fleet.aircraft?.find((aircraft) => aircraft.id === checklistAircraftId) || fleet.aircraft?.[0];
            if (!selected) return { id: "empty", phases: [] };
            checklistAircraftId = selected.id;
            return { ...selected, aircraftId: selected.id, id: `${fleet.id}-${selected.id}`, notice: fleet.notice };
        }

        function getChecklistStorageKey() {
            return `hispafly_checklist_progress_${getChecklistDefinition().id}`;
        }

        function loadChecklistProgress() {
            try {
                const saved = JSON.parse(localStorage.getItem(getChecklistStorageKey()) || "{}");
                return saved && typeof saved === "object" ? saved : {};
            } catch (_) {
                return {};
            }
        }

        function saveChecklistProgress(progress) {
            localStorage.setItem(getChecklistStorageKey(), JSON.stringify(progress));
        }

        function checklistItemKey(phaseId, index) {
            return `${phaseId}:${index}`;
        }

        function renderChecklist() {
            const definition = getChecklistDefinition();
            const fleet = window.HISPAFLY_CHECKLISTS?.aircraft || [];
            const phases = definition.phases || [];
            if (!phases.length) {
                document.getElementById("mainPanel").innerHTML = `<p class="error">Checklist data is unavailable.</p>`;
                return;
            }
            const progress = loadChecklistProgress();
            const firstIncomplete = phases.find((phase) => phase.items.some((_, index) => !progress[checklistItemKey(phase.id, index)]));
            if (!checklistPhaseId || !phases.some((phase) => phase.id === checklistPhaseId)) {
                checklistPhaseId = (firstIncomplete || phases[0]).id;
            }
            const active = phases.find((phase) => phase.id === checklistPhaseId) || phases[0];
            const total = phases.reduce((sum, phase) => sum + phase.items.length, 0);
            const complete = phases.reduce((sum, phase) => sum + phase.items.filter((_, index) => progress[checklistItemKey(phase.id, index)]).length, 0);
            const percent = total ? Math.round((complete / total) * 100) : 0;
            const activeComplete = active.items.filter((_, index) => progress[checklistItemKey(active.id, index)]).length;

            document.getElementById("mainPanel").innerHTML = `
                <section class="checklist-shell">
                    <header class="checklist-summary">
                        <div><span class="checklist-kicker">FLEET CHECKLIST</span><label class="checklist-aircraft-picker"><span>Aircraft</span><select id="checklistAircraftSelect">${fleet.map((aircraft) => `<option value="${escapeHtml(aircraft.id)}"${aircraft.id === definition.aircraftId ? " selected" : ""}>${escapeHtml(aircraft.title)}</option>`).join("")}</select></label><strong>${complete} / ${total} items complete</strong><small>${escapeHtml(definition.subtitle)} · ${escapeHtml(definition.manual)}${definition.source ? ` · ${escapeHtml(definition.source)}` : ""}</small></div>
                        <div class="checklist-progress" aria-label="${percent}% complete"><span style="width:${percent}%"></span><b>${percent}%</b></div>
                    </header>
                    <div class="checklist-notice">${escapeHtml(definition.notice)}</div>
                    <div class="checklist-workbench">
                        <nav class="checklist-phases" aria-label="Checklist phases">
                            ${phases.map((phase) => {
                                const done = phase.items.filter((_, index) => progress[checklistItemKey(phase.id, index)]).length;
                                const isComplete = done === phase.items.length;
                                return `<button type="button" class="checklist-phase${phase.id === active.id ? " active" : ""}${isComplete ? " complete" : ""}" data-checklist-phase="${escapeHtml(phase.id)}"><span>${escapeHtml(phase.name)}</span><small>${done}/${phase.items.length}</small></button>`;
                            }).join("")}
                        </nav>
                        <section class="checklist-card">
                            <div class="checklist-card-head"><div><span>PHASE ${phases.indexOf(active) + 1} OF ${phases.length}</span><h2>${escapeHtml(active.name)}</h2></div><strong>${activeComplete}/${active.items.length}</strong></div>
                            <div class="checklist-items">
                                ${active.items.map((item, index) => {
                                    const checked = Boolean(progress[checklistItemKey(active.id, index)]);
                                    return `<button type="button" class="checklist-item${checked ? " checked" : ""}" data-checklist-item="${index}" aria-pressed="${checked}"><span class="checklist-box">${checked ? "✓" : ""}</span><span class="checklist-challenge">${escapeHtml(item[0])}</span><span class="checklist-dots"></span><strong>${escapeHtml(item[1])}</strong></button>`;
                                }).join("")}
                            </div>
                            <footer class="checklist-actions"><button type="button" class="inline-btn" id="resetChecklistPhase">RESET PHASE</button><button type="button" class="inline-btn danger-btn" id="resetAllChecklists">RESET ALL</button><button type="button" class="primary-btn" id="nextChecklistPhase">${activeComplete === active.items.length ? "NEXT PHASE" : "NEXT INCOMPLETE"}</button></footer>
                        </section>
                    </div>
                </section>`;

            document.getElementById("checklistAircraftSelect").addEventListener("change", (event) => {
                checklistAircraftId = event.target.value;
                localStorage.setItem("hispafly_checklist_aircraft", checklistAircraftId);
                checklistPhaseId = null;
                renderChecklist();
            });

            document.querySelectorAll("[data-checklist-phase]").forEach((button) => button.addEventListener("click", () => {
                checklistPhaseId = button.dataset.checklistPhase;
                renderChecklist();
            }));
            document.querySelectorAll("[data-checklist-item]").forEach((button) => button.addEventListener("click", () => {
                const next = loadChecklistProgress();
                const key = checklistItemKey(active.id, Number(button.dataset.checklistItem));
                next[key] = !next[key];
                saveChecklistProgress(next);
                renderChecklist();
            }));
            document.getElementById("resetChecklistPhase").addEventListener("click", () => {
                const next = loadChecklistProgress();
                active.items.forEach((_, index) => delete next[checklistItemKey(active.id, index)]);
                saveChecklistProgress(next);
                renderChecklist();
            });
            document.getElementById("resetAllChecklists").addEventListener("click", () => {
                if (!window.confirm("Reset all checklist progress?")) return;
                localStorage.removeItem(getChecklistStorageKey());
                checklistPhaseId = phases[0].id;
                renderChecklist();
            });
            document.getElementById("nextChecklistPhase").addEventListener("click", () => {
                const latest = loadChecklistProgress();
                const missing = active.items.findIndex((_, index) => !latest[checklistItemKey(active.id, index)]);
                if (missing >= 0) {
                    document.querySelector(`[data-checklist-item="${missing}"]`)?.focus();
                    return;
                }
                checklistPhaseId = phases[(phases.indexOf(active) + 1) % phases.length].id;
                renderChecklist();
            });
        }

        function loadTelexSettingsForm() {
            const settings = getTelexSettings();
            document.getElementById("savedTelexCode").value = settings.logonCode || "";
            document.getElementById("saveTelexSettingsBtn").addEventListener("click", () => {
                saveTelexSettings({
                    logonCode: document.getElementById("savedTelexCode").value.trim()
                });
                document.getElementById("savedTelexCode").blur();
            });
            document.getElementById("clearTelexSettingsBtn").addEventListener("click", () => {
                localStorage.removeItem("hpf_telex_settings");
                document.getElementById("savedTelexCode").value = "";
            });
        }

        async function fetchPerformanceJson(path, options = {}) {
            let res;
            try {
                res = await fetch(`${AOC_API_BASE_URL}?path=${encodeURIComponent(`/api/efb/performance${path}`)}`, {
                    method: options.method || "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json",
                        ...(options.body ? { "Content-Type": "application/json" } : {})
                    },
                    body: options.body ? JSON.stringify(options.body) : undefined
                });
            } catch (err) {
                throw new Error(normalizePerformanceError(err));
            }
            const text = await res.text();
            let json;
            try {
                json = text ? JSON.parse(text) : {};
            } catch (_) {
                throw new Error(`AOC backend unavailable. Please try again later. (HTTP ${res.status})`);
            }
            if (!res.ok) {
                const code = json.code || json.error;
                if (res.status === 401) throw new Error("Please log in with your HISPAFLY AOC account.");
                if (code === "CONNECT_NAVIGRAPH_REQUIRED") throw new Error("Connect Navigraph / SimBrief in AOC before using performance calculations.");
                if (code === "NAVIGRAPH_RECONNECT_REQUIRED") throw new Error("Reconnect Navigraph / SimBrief in AOC before using performance calculations.");
                throw new Error(json.message || json.error || "AOC backend unavailable. Please try again later.");
            }
            return json;
        }

        function normalizePerformanceError(err) {
            const message = String(err?.message || err || "");
            if (/failed to fetch|networkerror|load failed/i.test(message)) {
                return "AOC backend unavailable. Please try again later.";
            }
            return message || "AOC backend unavailable. Please try again later.";
        }

        async function loadPerformanceActiveFlight() {
            return await fetchPerformanceJson("/active-flight");
        }

        async function loadPerformanceHistory() {
            const json = await fetchPerformanceJson("/history");
            return Array.isArray(json.data) ? json.data : (Array.isArray(json.history) ? json.history : (Array.isArray(json) ? json : []));
        }

        async function loadPerformanceLoadsheet() {
            const flight = performanceActiveFlight || {};
            performanceLoadsheetError = "";
            try {
                if (!flight.active || !flight.bookingId) {
                    performanceLoadsheetData = buildLoadsheetModel(null, flight);
                    performanceLoadsheetError = "No active SimBrief-linked booking. Manual loadsheet preview is available.";
                    return performanceLoadsheetData;
                }
                const json = await fetchPilotJson(`/bookings/${flight.bookingId}/simbrief`);
                performanceLoadsheetData = buildLoadsheetModel(json.data || json, flight);
                return performanceLoadsheetData;
            } catch (err) {
                performanceLoadsheetData = buildLoadsheetModel(null, flight);
                performanceLoadsheetError = normalizePerformanceError(err);
                return performanceLoadsheetData;
            }
        }

        function seedPerformanceForms() {
            takeoffResult = null;
            landingResult = null;
            performanceHistory = null;
            performanceLoadsheetData = null;
            performanceLoadsheetError = "";
        }

        function renderPerformance() {
            const active = performanceActiveFlight || { active: false, mode: "MANUAL" };
            const tabs = [
                ["flight", "Flight Data"],
                ["takeoff", "T.O PERF"],
                ["landing", "LDG PERF"],
                ["loadsheet", "Loadsheet"],
                ["history", "History"]
            ].map(([id, label]) => `<button type="button" class="performance-tab${performanceTab === id ? " active" : ""}" data-performance-tab="${id}">${label}</button>`).join("");

            document.getElementById("mainPanel").innerHTML = `
                <section class="performance-shell">
                    <div class="performance-banner">
                        <div>
                            <span class="performance-kicker">${escapeHtml(active.mode || "MANUAL")}</span>
                            <strong>${escapeHtml(active.active ? `${formatValue(active.flightNumber, "Flight")} ${formatValue(active.callsign, "")}`.trim() : "Manual calculation")}</strong>
                            <small>${escapeHtml(active.active ? `${formatValue(active.departureIcao)} to ${formatValue(active.arrivalIcao)}` : "Manual calculation - not linked to official dispatched flight.")}</small>
                        </div>
                        ${performanceStatusBadge(active.readyForDepartureStatus || (active.active ? "PENDING" : "MANUAL"))}
                    </div>
                    ${performanceLoadError ? `<div class="performance-alert">${escapeHtml(performanceLoadError)} Manual calculation remains available.</div>` : ""}
                    <nav class="performance-tabs" aria-label="Performance sections">${tabs}</nav>
                    <div class="performance-body">${renderPerformanceTab()}</div>
                </section>
            `;

            document.querySelectorAll("[data-performance-tab]").forEach((button) => {
                button.addEventListener("click", async () => {
                    performanceTab = button.dataset.performanceTab;
                    if (performanceTab === "history" && !performanceHistory) {
                        document.querySelector(".performance-body").innerHTML = `<p class="empty">Loading performance history...</p>`;
                        try {
                            performanceHistory = await loadPerformanceHistory();
                        } catch (err) {
                            document.querySelector(".performance-body").innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
                            return;
                        }
                    }
                    if (performanceTab === "loadsheet" && !performanceLoadsheetData) {
                        document.querySelector(".performance-body").innerHTML = renderLoadsheetLoading();
                        await loadPerformanceLoadsheet();
                    }
                    renderPerformance();
                });
            });
            bindPerformanceActions();
        }

        function renderPerformanceTab() {
            if (performanceTab === "takeoff") return renderTakeoffPerformance();
            if (performanceTab === "landing") return renderLandingPerformance();
            if (performanceTab === "loadsheet") return renderLoadsheetPerformance();
            if (performanceTab === "history") return renderPerformanceHistory();
            return renderPerformanceFlightData();
        }

        function renderPerformanceFlightData() {
            const flight = performanceActiveFlight || { active: false, mode: "MANUAL" };
            if (!flight.active) {
                return `
                    <section class="card wide">
                        <h2>Flight Data</h2>
                        <p class="empty">Manual calculation - not linked to official dispatched flight.</p>
                    </section>
                `;
            }
            const rows = [
                ["Flight number", flight.flightNumber],
                ["Callsign", flight.callsign],
                ["Route", `${formatValue(flight.departureIcao)} - ${formatValue(flight.arrivalIcao)}`],
                ["Aircraft type", flight.aircraftType],
                ["Registration", flight.aircraftRegistration],
                ["OFP status", flight.ofpStatus],
                ["Dispatch status", flight.dispatchStatus],
                ["AOC booking ID", flight.bookingId],
                ["Takeoff weight", formatWeight(flight.takeoffWeightKg)],
                ["Landing weight", formatWeight(flight.landingWeightKg)],
                ["Ready for Departure", flight.readyForDepartureStatus]
            ];
            return `
                <section class="performance-data card wide">
                    <h2>Flight Data</h2>
                    <div class="performance-data-grid">
                        ${rows.map(([label, value]) => `
                            <div class="performance-metric">
                                <span>${escapeHtml(label)}</span>
                                <strong>${escapeHtml(formatValue(value))}</strong>
                            </div>
                        `).join("")}
                    </div>
                </section>
            `;
        }

        function renderLoadsheetLoading() {
            return `
                <div class="performance-workbench flysmart-workbench loadsheet-workbench">
                    <section class="flysmart-side-panel">
                        <div class="flysmart-title">LOADSHEET</div>
                        <p class="performance-wx-note">Loading SimBrief OFP data...</p>
                    </section>
                    <section class="flysmart-main-panel">
                        <div class="flysmart-strip-title">RESULTS</div>
                        <div class="loadsheet-results"><p class="empty">Preparing loadsheet...</p></div>
                    </section>
                </div>
            `;
        }

        function renderLoadsheetPerformance() {
            const model = performanceLoadsheetData || buildLoadsheetModel(null, performanceActiveFlight || {});
            const configRows = [
                ["CONFIG", model.config],
                ["CREW", model.crew],
                ["CATERING", model.catering],
                ["MISC", model.misc],
                ["LIMITING WEIGHTS", model.limitingWeightLabel]
            ];
            const loadRows = [
                ["PAX", model.pax],
                ["CARGO kg", formatLoadsheetNumber(model.cargoKg, 0)],
                ["FOB kg", formatLoadsheetNumber(model.blockFuelKg, 0)],
                ["TRIP FUEL kg", formatLoadsheetNumber(model.tripFuelKg, 0)],
                ["TAXI FUEL kg", formatLoadsheetNumber(model.taxiFuelKg, 0)],
                ["DENSITY kg/l", "0.785 (STD)"]
            ];
            return `
                <div class="performance-workbench flysmart-workbench loadsheet-workbench">
                    <section class="flysmart-side-panel loadsheet-side-panel">
                        <div class="flysmart-title">LOADSHEET</div>
                        <div class="flysmart-inputs">
                            ${loadsheetGroup(configRows)}
                            ${loadsheetGroup(loadRows)}
                            ${performanceLoadsheetError ? `<p class="performance-wx-note">${escapeHtml(performanceLoadsheetError)}</p>` : `<p class="performance-wx-note">SimBrief OFP data loaded for ${escapeHtml(model.route)}.</p>`}
                        </div>
                        <button class="primary-btn flysmart-compute-btn" type="button" id="exportLoadsheetBtn">EXPORT LOADSHEET</button>
                    </section>
                    <section class="flysmart-main-panel">
                        <div class="flysmart-strip-title loadsheet-strip">
                            <span>RESULTS</span>
                            <span>${escapeHtml(model.flightLabel)}</span>
                        </div>
                        <div class="loadsheet-results">
                            <div class="loadsheet-underload">${escapeHtml(model.underloadLabel)}</div>
                            <div class="loadsheet-chart" aria-label="Loadsheet envelope chart">
                                ${renderLoadsheetEnvelope(model)}
                            </div>
                            ${renderLoadsheetTable(model)}
                            <div class="loadsheet-trim">T.O. THS FOR ${escapeHtml(formatLoadsheetNumber(model.tocgPercent, 1))} % (${escapeHtml(model.trimHint)})</div>
                            <p class="loadsheet-disclaimer">SIMBRIEF LOADSHEET - PLANNING DATA / NOT AN OFFICIAL W&B DOCUMENT.</p>
                        </div>
                    </section>
                </div>
            `;
        }

        function loadsheetGroup(rows) {
            return `
                <div class="flysmart-group loadsheet-group">
                    ${rows.map(([label, value]) => `
                        <div class="loadsheet-line">
                            <span>${escapeHtml(label)}</span>
                            <strong>${escapeHtml(formatValue(value))}</strong>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        function renderLoadsheetTable(model) {
            const rows = [
                ["DOW / DOCG", model.dowKg, model.docgPercent, ""],
                ["PAYLOAD", model.payloadKg, "", ""],
                ["ZFW / ZFWCG", model.zfwKg, model.zfwcgPercent, "zfw"],
                ["T.O. FUEL", model.takeoffFuelKg, "", ""],
                ["TOW / TOCG", model.towKg, model.tocgPercent, "tow"],
                ["TRIP FUEL", model.tripFuelKg, "", ""],
                ["LW / LCG", model.lwKg, model.lcgPercent, "lw"]
            ];
            return `
                <div class="loadsheet-table">
                    <div class="loadsheet-table-head"><span></span><strong>Weight T</strong><strong>CG %</strong></div>
                    ${rows.map(([label, weight, cg, tone]) => `
                        <div class="loadsheet-table-row ${tone ? `is-${tone}` : ""}">
                            <span>${escapeHtml(label)}</span>
                            <strong>${escapeHtml(formatTonnes(weight))}</strong>
                            <strong>${escapeHtml(cg === "" ? "" : formatLoadsheetNumber(cg, 1))}</strong>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        function renderLoadsheetEnvelope(model) {
            const zfwPoint = loadsheetPoint(model.zfwKg, model.zfwcgPercent);
            const towPoint = loadsheetPoint(model.towKg, model.tocgPercent);
            const lwPoint = loadsheetPoint(model.lwKg, model.lcgPercent);
            return `
                <svg viewBox="0 0 520 360" role="img" aria-label="Weight and balance envelope">
                    <defs>
                        <linearGradient id="loadsheetGridFade" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stop-color="#464646"/>
                            <stop offset="1" stop-color="#383838"/>
                        </linearGradient>
                    </defs>
                    <rect width="520" height="360" rx="8" fill="url(#loadsheetGridFade)"/>
                    ${[60,120,180,240,300].map((y) => `<line x1="36" y1="${y}" x2="496" y2="${y}" class="loadsheet-grid-line"/>`).join("")}
                    ${[78,128,178,228,278,328,378,428].map((x) => `<line x1="${x}" y1="36" x2="${x - 70}" y2="322" class="loadsheet-grid-line"/>`).join("")}
                    <polyline points="90,276 156,92 404,92 450,174 360,282 190,322" class="loadsheet-envelope mtow"/>
                    <polyline points="144,244 214,174 374,174 314,322 188,322" class="loadsheet-envelope mzfw"/>
                    <polyline points="${zfwPoint.x},${zfwPoint.y} ${towPoint.x},${towPoint.y} ${lwPoint.x},${lwPoint.y}" class="loadsheet-path"/>
                    <line x1="${towPoint.x}" y1="${towPoint.y}" x2="${lwPoint.x}" y2="${lwPoint.y}" class="loadsheet-dashed"/>
                    <circle cx="${zfwPoint.x}" cy="${zfwPoint.y}" r="8" class="loadsheet-point zfw"/>
                    <circle cx="${towPoint.x}" cy="${towPoint.y}" r="8" class="loadsheet-point tow"/>
                    <circle cx="${lwPoint.x}" cy="${lwPoint.y}" r="8" class="loadsheet-point lw"/>
                    <text x="232" y="90" class="loadsheet-chart-label mtow">MTOW = ${escapeHtml(formatLoadsheetNumber(model.maxTowKg, 0))} kg</text>
                    <text x="222" y="180" class="loadsheet-chart-label mzfw">MZFW = ${escapeHtml(formatLoadsheetNumber(model.maxZfwKg, 0))} kg</text>
                    <text x="42" y="334" class="loadsheet-axis">40</text>
                    <text x="474" y="334" class="loadsheet-axis">200</text>
                </svg>
            `;
        }

        function buildLoadsheetModel(raw, flight = {}) {
            const ofp = raw?.ofp_data || raw || {};
            const atc = ofp.atc || {};
            const general = ofp.general || {};
            const fuel = ofp.fuel || {};
            const weights = ofp.weights || {};
            const aircraft = atc.aircraft || general.aircraft || flight.aircraftType || "A20N";
            const route = [
                atc.orig || atc.fir_orig || general.origin || flight.departureIcao,
                atc.dest || atc.fir_dest || general.destination || flight.arrivalIcao
            ].filter(Boolean).join(" - ") || "N/A";

            const pax = firstNumber(
                weights.pax_count,
                weights.pax,
                ofp.params?.pax,
                ofp.params?.passengers,
                general.passengers,
                0
            );
            const cargoKg = firstWeightKg(
                weights.cargo,
                weights.cargo_weight,
                weights.est_cargo,
                ofp.params?.cargo,
                0
            );
            const payloadKg = firstWeightKg(
                weights.payload,
                weights.est_payload,
                pax ? pax * 84 + cargoKg : null,
                0
            );
            const dowKg = firstWeightKg(
                weights.dow,
                weights.oew,
                weights.operating_empty,
                Math.max(0, firstWeightKg(weights.est_zfw, flight.takeoffWeightKg) - payloadKg),
                0
            );
            const zfwKg = firstWeightKg(weights.est_zfw, weights.zfw, dowKg + payloadKg, 0);
            const blockFuelKg = firstWeightKg(fuel.plan_ramp, fuel.block, fuel.ramp, fuel.total, 0);
            const taxiFuelKg = firstWeightKg(fuel.taxi, fuel.taxi_out, 0);
            const tripFuelKg = firstWeightKg(fuel.trip, fuel.enroute_burn, fuel.burn, 0);
            const takeoffFuelKg = Math.max(0, firstWeightKg(fuel.takeoff, blockFuelKg - taxiFuelKg, 0));
            const towKg = firstWeightKg(weights.est_tow, weights.tow, flight.takeoffWeightKg, zfwKg + takeoffFuelKg, 0);
            const lwKg = firstWeightKg(weights.est_ldw, weights.est_lw, weights.ldw, flight.landingWeightKg, towKg - tripFuelKg, 0);
            const maxZfwKg = firstWeightKg(weights.max_zfw, weights.mzfw, 0) || inferLimit(aircraft, "mzfw");
            const maxTowKg = firstWeightKg(weights.max_tow, weights.mtow, 0) || inferLimit(aircraft, "mtow");
            const maxLwKg = firstWeightKg(weights.max_ldw, weights.max_lw, weights.mlw, 0) || inferLimit(aircraft, "mlw");
            const limits = [
                ["ZFW", maxZfwKg - zfwKg],
                ["TOW", maxTowKg - towKg],
                ["LW", maxLwKg - lwKg]
            ].filter(([, margin]) => Number.isFinite(margin));
            const limiting = limits.sort((a, b) => a[1] - b[1])[0] || ["LW", 0];
            const docgPercent = firstNumber(weights.dow_cg, weights.docg, 22.1);
            const zfwcgPercent = firstNumber(weights.zfwcg, weights.zfw_cg, estimateCgPercent(zfwKg, maxZfwKg, 31.5));
            const tocgPercent = firstNumber(weights.towcg, weights.tow_cg, estimateCgPercent(towKg, maxTowKg, zfwcgPercent - 1.2));
            const lcgPercent = firstNumber(weights.ldgcg, weights.lw_cg, weights.lcg, estimateCgPercent(lwKg, maxLwKg, zfwcgPercent + 0.2));
            const underloadKg = Math.max(0, Math.round(limiting[1] || 0));
            return {
                aircraft,
                route,
                flightLabel: atc.callsign || general.flight_number || flight.callsign || flight.flightNumber || "SIMBRIEF",
                config: inferCabinConfig(aircraft),
                crew: inferCrew(aircraft),
                catering: "STD FLIGHT (STD)",
                misc: "FLY AWAY KIT (STD)",
                limitingWeightLabel: `LIMITED BY ${limiting[0]}`,
                underloadLabel: `UNDERLOAD (kg): ${formatLoadsheetNumber(underloadKg, 0)} LIMITED BY ${limiting[0]}`,
                pax,
                cargoKg,
                payloadKg,
                dowKg,
                docgPercent,
                zfwKg,
                zfwcgPercent,
                blockFuelKg,
                taxiFuelKg,
                tripFuelKg,
                takeoffFuelKg,
                towKg,
                tocgPercent,
                lwKg,
                lcgPercent,
                maxZfwKg,
                maxTowKg,
                maxLwKg,
                trimHint: estimateTrimHint(tocgPercent)
            };
        }

        function firstWeightKg(...values) {
            for (const value of values) {
                const number = parseWeightKg(value);
                if (Number.isFinite(number) && number > 0) return number;
            }
            return 0;
        }

        function parseWeightKg(value) {
            if (value === undefined || value === null || value === "") return NaN;
            if (typeof value === "number") return value;
            const text = String(value).replace(/,/g, "").trim().toLowerCase();
            const number = Number.parseFloat(text);
            if (!Number.isFinite(number)) return NaN;
            if (/\blb|lbs|pounds\b/.test(text)) return number * 0.45359237;
            return number;
        }

        function firstNumber(...values) {
            for (const value of values) {
                if (value === undefined || value === null || value === "") continue;
                const number = Number(String(value).replace(/,/g, ""));
                if (Number.isFinite(number)) return number;
            }
            return 0;
        }

        function inferLimit(aircraft, type) {
            const code = String(aircraft || "").toUpperCase();
            const family = code.includes("A33") || code.includes("A339") || code.includes("A333") ? "A330" : code.includes("B78") ? "B787" : "A320";
            const limits = {
                A320: { mzfw: 62500, mtow: 79000, mlw: 67400 },
                A330: { mzfw: 173000, mtow: 235000, mlw: 182000 },
                B787: { mzfw: 181400, mtow: 254000, mlw: 192800 }
            };
            return limits[family][type];
        }

        function inferCabinConfig(aircraft) {
            const code = String(aircraft || "").toUpperCase();
            if (code.includes("A33")) return "27J/310Y (STD)";
            if (code.includes("B78")) return "30J/260Y (STD)";
            return "32J/150Y (STD)";
        }

        function inferCrew(aircraft) {
            const code = String(aircraft || "").toUpperCase();
            if (code.includes("A33") || code.includes("B78")) return "2 FDC + 8 CC (STD)";
            return "2 FDC + 4 CC (STD)";
        }

        function estimateCgPercent(weightKg, limitKg, fallback) {
            if (!Number.isFinite(weightKg) || !Number.isFinite(limitKg) || limitKg <= 0) return fallback;
            const ratio = Math.max(0, Math.min(1, weightKg / limitKg));
            return Math.round((21 + ratio * 12) * 10) / 10;
        }

        function estimateTrimHint(tocgPercent) {
            const number = Number(tocgPercent);
            if (!Number.isFinite(number)) return "STD";
            const trim = Math.max(-1.5, Math.min(4.0, (32 - number) * 0.75));
            const direction = trim >= 0 ? "UP" : "DN";
            return `${Math.abs(trim).toFixed(1)} ${direction}`;
        }

        function loadsheetPoint(weightKg, cgPercent) {
            const x = 46 + Math.max(0, Math.min(1, (Number(cgPercent) - 17) / 22)) * 430;
            const y = 322 - Math.max(0, Math.min(1, (Number(weightKg) - 40000) / 210000)) * 280;
            return { x: Math.round(x), y: Math.round(y) };
        }

        function formatLoadsheetNumber(value, digits = 0) {
            const number = Number(value);
            if (!Number.isFinite(number)) return "N/A";
            return number.toLocaleString(undefined, {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits
            });
        }

        function formatTonnes(value) {
            const number = Number(value);
            if (!Number.isFinite(number) || number <= 0) return "N/A";
            return (number / 1000).toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            });
        }

        function renderTakeoffPerformance() {
            const flight = performanceActiveFlight || {};
            const aircraft = flight.aircraftType || "A20N";
            const runway = flight.plannedDepartureRunway || "36L";
            const towKg = performanceLoadsheetData?.towKg || flight.takeoffWeightKg || "";
            return `
                <div class="performance-workbench flysmart-workbench">
                    <section class="flysmart-side-panel">
                        <div class="flysmart-title">TAKEOFF - ${escapeHtml(aircraft)}</div>
                        <div class="flysmart-inputs">
                            <div class="flysmart-group">
                                ${performanceInput("takeoffAirport", "Airport", flight.departureIcao || "", "LEMD")}
                                ${performanceInput("takeoffRunway", "RWY", runway, "36L")}
                                ${performanceInput("takeoffAircraft", "Aircraft", aircraft, "A20N")}
                                ${performanceInput("takeoffShorten", "INTX / TORA", "", "FULL LENGTH", "number")}
                            </div>
                            <div class="flysmart-group">
                                ${performanceInput("takeoffWind", "Wind deg/kt", "000/00", "000/00")}
                                ${performanceInput("takeoffTemperature", "OAT C", "15", "15", "number")}
                                ${performanceInput("takeoffQnh", "QNH hPa", "1013", "1013", "number")}
                                ${surfaceSelect("takeoffSurface")}
                                ${antiIceSelect()}
                            </div>
                            <div class="flysmart-group">
                                ${performanceInput("takeoffWeight", "TOW kg", towKg, "72450", "number")}
                                ${performanceInput("takeoffThrust", "T.O thrust", "", "FLEX / TOGA")}
                                ${flapSelect("takeoffFlaps", "takeoff")}
                                ${toggleField("takeoffFlex", "Flex enabled", true)}
                                ${toggleField("takeoffBleeds", "Bleeds", true)}
                                ${toggleField("takeoffClimbOpt", "Climb optimization", true)}
                            </div>
                            ${performanceModeNotice()}
                            ${performanceWeatherNotice("takeoff")}
                        </div>
                        <div class="flysmart-status-buttons">
                            <span>MEL 0</span><span>CDL 0</span><span>ECAM 0</span>
                        </div>
                        <div class="flysmart-action-row">
                            <button class="inline-btn" type="button">CLEAR</button>
                            <button class="primary-btn flysmart-compute-btn" id="calculateTakeoffBtn">COMPUTE</button>
                        </div>
                    </section>
                    <section class="flysmart-main-panel">
                        <div class="flysmart-landing-topbar flysmart-takeoff-topbar">
                            <span>TAKEOFF</span>
                            <span>${escapeHtml(flight.aircraftRegistration || "A-DEMO")}</span>
                            <span>${escapeHtml(aircraft)}</span>
                        </div>
                        <div class="flysmart-strip-title">${escapeHtml(runway)} - FULL LENGTH</div>
                        <div class="flysmart-output-grid">
                            <div id="takeoffResult" class="flysmart-result-panel">${renderTakeoffResult()}</div>
                            ${renderFlysmartProcedurePanel("takeoff")}
                            ${renderFlysmartRunwayPanel("takeoff", runway)}
                        </div>
                        <div class="flysmart-bottom-nav" aria-hidden="true">
                            <span>▣</span><span class="active">▱</span><span>▰</span><span>▤</span><span>✈</span><span>⚙</span>
                        </div>
                    </section>
                </div>
            `;
        }

        function renderLandingPerformance() {
            const flight = performanceActiveFlight || {};
            const aircraft = flight.aircraftType || "A20N";
            const registration = flight.aircraftRegistration || "A-DEMO";
            const runway = flight.plannedArrivalRunway || "12";
            const lwKg = performanceLoadsheetData?.lwKg || flight.landingWeightKg || "";
            return `
                <div class="performance-workbench flysmart-workbench flysmart-landing-workbench">
                    <section class="flysmart-side-panel flysmart-landing-side">
                        <div class="flysmart-mode-toggle"><span class="active">IN-FLIGHT</span><span>Dispatch</span></div>
                        <div class="flysmart-inputs">
                            <div class="flysmart-group">
                                ${performanceInput("landingAirport", "Airport", flight.arrivalIcao || "", "LEVC")}
                                ${performanceInput("landingRunway", "RWY", runway, "12")}
                            </div>
                            <div class="flysmart-group">
                                ${performanceInput("landingWind", "Wind deg/kt", "000/00", "000/00")}
                                ${performanceInput("landingTemperature", "OAT C", "15", "15", "number")}
                                ${performanceInput("landingQnh", "QNH hPa", "1013", "1013", "number")}
                                ${surfaceSelect("landingSurface")}
                                ${methodSelect("landingMethod", "Method", [["inflight", "Inflight"], ["dispatch", "Dispatch"]])}
                            </div>
                            <div class="flysmart-group">
                                ${performanceInput("landingWeight", "LDW kg", lwKg, "63800", "number")}
                                ${flapSelect("landingFlaps", "landing")}
                                ${methodSelect("landingAirCondition", "Air cond", [["on", "On (STD)"], ["off", "Off"]])}
                                ${methodSelect("landingApproachType", "Appr type", [["normal", "Normal (STD)"], ["autoland", "Autoland"], ["steep", "Steep"]])}
                                ${methodSelect("landingBrakeMode", "BRK mode", [["low", "Low"], ["medium", "Medium"], ["max", "Max manual"]])}
                                ${performanceInput("landingBrake", "Brake", "", "Optional")}
                                ${performanceInput("landingVref", "VREF add", "5", "5", "number")}
                                ${methodSelect("landingMargin", "Margin", [["factored", "Factored"], ["unfactored", "Unfactored"]])}
                                ${toggleField("landingReverser", "Reverser credit", true)}
                                ${performanceInput("landingShorten", "LDA", "", "FULL LENGTH", "number")}
                            </div>
                            ${performanceModeNotice()}
                            ${performanceWeatherNotice("landing")}
                        </div>
                        <div class="flysmart-status-buttons">
                            <span>MEL 0</span><span>CDL 0</span><span>ECAM 0</span>
                        </div>
                        <div class="flysmart-action-row">
                            <button class="inline-btn" type="button">CLEAR</button>
                            <button class="primary-btn flysmart-compute-btn" id="calculateLandingBtn">COMPUTE</button>
                        </div>
                    </section>
                    <section class="flysmart-main-panel">
                        <div class="flysmart-landing-topbar">
                            <span>LANDING</span>
                            <span>${escapeHtml(registration)}</span>
                            <span>${escapeHtml(aircraft)}</span>
                        </div>
                        <div class="flysmart-strip-title flysmart-landing-subbar">
                            <span>${escapeHtml(runway)}</span>
                            <span>${escapeHtml(flight.callsign || flight.flightNumber || "HISPAFLY")}</span>
                        </div>
                        <div class="flysmart-landing-stage">
                            <div id="landingResult" class="flysmart-result-panel flysmart-landing-result">${renderLandingResult()}</div>
                            ${renderFlysmartLandingMessage()}
                            ${renderFlysmartRunwayPanel("landing", runway)}
                        </div>
                        <div class="flysmart-bottom-nav" aria-hidden="true">
                            <span>▣</span><span>▱</span><span class="active">▰</span><span>▤</span><span>✈</span><span>⚙</span>
                        </div>
                    </section>
                </div>
            `;
        }

        function renderPerformanceHistory() {
            const list = performanceHistory || [];
            if (!list.length) {
                return `<section class="card wide"><h2>History</h2><p class="empty">No performance calculations returned.</p></section>`;
            }
            return `
                <section class="card wide">
                    <h2>History</h2>
                    <div class="performance-history">
                        ${list.map((item) => `
                            <article class="item">
                                <div class="item-title">
                                    <span>${escapeHtml(formatValue(item.type))} / ${escapeHtml(formatValue(item.mode))}</span>
                                    ${performanceStatusBadge(item.status)}
                                </div>
                                <div class="meta">
                                    <span>Airport: ${escapeHtml(formatValue(item.airportIcao || item.airport))}</span>
                                    <span>Runway: ${escapeHtml(formatValue(item.runway))}</span>
                                    <span>Weight: ${escapeHtml(formatWeight(item.weightKg))}</span>
                                    <span>Created: ${escapeHtml(formatDate(item.createdAt || item.created_at))}</span>
                                </div>
                            </article>
                        `).join("")}
                    </div>
                </section>
            `;
        }

        function bindPerformanceActions() {
            const takeoffBtn = document.getElementById("calculateTakeoffBtn");
            if (takeoffBtn) takeoffBtn.addEventListener("click", calculateTakeoffPerformance);
            const landingBtn = document.getElementById("calculateLandingBtn");
            if (landingBtn) landingBtn.addEventListener("click", calculateLandingPerformance);
            const readyBtn = document.getElementById("readyForDepartureBtn");
            if (readyBtn) readyBtn.addEventListener("click", markReadyForDeparture);
            const exportLoadsheetBtn = document.getElementById("exportLoadsheetBtn");
            if (exportLoadsheetBtn) exportLoadsheetBtn.addEventListener("click", exportLoadsheet);
            bindPerformanceWeatherAutofill("takeoff");
            bindPerformanceWeatherAutofill("landing");
        }

        function exportLoadsheet() {
            const model = performanceLoadsheetData || buildLoadsheetModel(null, performanceActiveFlight || {});
            const lines = [
                "HISPAFLY EFB LOADSHEET",
                "SIMBRIEF LOADSHEET - PLANNING DATA / NOT AN OFFICIAL W&B DOCUMENT",
                "",
                `Flight: ${model.flightLabel}`,
                `Route: ${model.route}`,
                `Aircraft: ${model.aircraft}`,
                `PAX: ${model.pax}`,
                `Cargo: ${formatLoadsheetNumber(model.cargoKg, 0)} kg`,
                `Payload: ${formatLoadsheetNumber(model.payloadKg, 0)} kg`,
                `ZFW / ZFWCG: ${formatLoadsheetNumber(model.zfwKg, 0)} kg / ${formatLoadsheetNumber(model.zfwcgPercent, 1)} %`,
                `TOW / TOCG: ${formatLoadsheetNumber(model.towKg, 0)} kg / ${formatLoadsheetNumber(model.tocgPercent, 1)} %`,
                `LW / LCG: ${formatLoadsheetNumber(model.lwKg, 0)} kg / ${formatLoadsheetNumber(model.lcgPercent, 1)} %`,
                `Block fuel: ${formatLoadsheetNumber(model.blockFuelKg, 0)} kg`,
                `Taxi fuel: ${formatLoadsheetNumber(model.taxiFuelKg, 0)} kg`,
                `Trip fuel: ${formatLoadsheetNumber(model.tripFuelKg, 0)} kg`,
                model.underloadLabel,
                `T.O. THS: ${formatLoadsheetNumber(model.tocgPercent, 1)} % (${model.trimHint})`
            ];
            const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `HISPAFLY_LOADSHEET_${String(model.flightLabel || "SIMBRIEF").replace(/[^A-Z0-9_-]/gi, "_")}.txt`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }

        async function calculateTakeoffPerformance() {
            await runPerformanceAction("takeoffResult", async () => {
                const result = await fetchPerformanceJson("/takeoff", { method: "POST", body: takeoffPayload() });
                takeoffResult = result.data || result;
                performanceHistory = null;
                return renderTakeoffResult();
            });
        }

        async function calculateLandingPerformance() {
            await runPerformanceAction("landingResult", async () => {
                const result = await fetchPerformanceJson("/landing", { method: "POST", body: landingPayload() });
                landingResult = result.data || result;
                performanceHistory = null;
                return renderLandingResult();
            });
        }

        async function markReadyForDeparture() {
            if (["WARNING", "NOT_SUPPORTED"].includes(String(takeoffResult?.status || "").toUpperCase())) {
                if (!window.confirm("Takeoff performance returned a warning. Mark Ready for Departure with warning?")) return;
            }
            await runPerformanceAction("takeoffResult", async () => {
                const result = await fetchPerformanceJson("/ready-for-departure", {
                    method: "POST",
                    body: {
                        flightDispatchId: performanceActiveFlight?.flightDispatchId
                    }
                });
                performanceActiveFlight = await loadPerformanceActiveFlight().catch(() => performanceActiveFlight);
                return `${renderTakeoffResult()}<p class="ok" style="margin-top:12px;">${escapeHtml(result.message || "Ready for Departure updated.")}</p>`;
            });
        }

        async function runPerformanceAction(targetId, action) {
            const target = document.getElementById(targetId);
            target.innerHTML = `<p class="empty">Sending performance request to AOC...</p>`;
            try {
                target.innerHTML = await action();
                bindPerformanceActions();
            } catch (err) {
                target.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
            }
        }

        function takeoffPayload() {
            const flight = performanceActiveFlight || {};
            return {
                mode: flight.active ? "OFFICIAL" : "MANUAL",
                flightDispatchId: flight.flightDispatchId || null,
                ofpBriefingId: flight.ofpBriefingId || null,
                airport: fieldValue("takeoffAirport").toUpperCase(),
                runway: fieldValue("takeoffRunway").toUpperCase(),
                aircraft: fieldValue("takeoffAircraft").toUpperCase(),
                aircraftRegistration: flight.aircraftRegistration || null,
                weightKg: numberField("takeoffWeight"),
                surfaceCondition: fieldValue("takeoffSurface") || "dry",
                wind: fieldValue("takeoffWind") || "000/00",
                temperature: numberField("takeoffTemperature"),
                qnh: numberField("takeoffQnh"),
                flapSetting: optionalField("takeoffFlaps"),
                thrustSetting: optionalField("takeoffThrust"),
                enableFlex: document.getElementById("takeoffFlex").checked,
                enableBleeds: document.getElementById("takeoffBleeds").checked,
                enableAntiIce: fieldValue("takeoffAntiIce") || "auto",
                enableClimbOptimization: document.getElementById("takeoffClimbOpt").checked,
                runwayShorten: optionalNumberField("takeoffShorten"),
                shortenUnits: "tora"
            };
        }

        function landingPayload() {
            const flight = performanceActiveFlight || {};
            return {
                mode: flight.active ? "OFFICIAL" : "MANUAL",
                flightDispatchId: flight.flightDispatchId || null,
                ofpBriefingId: flight.ofpBriefingId || null,
                airport: fieldValue("landingAirport").toUpperCase(),
                runway: fieldValue("landingRunway").toUpperCase(),
                aircraft: fieldValue("landingAircraft").toUpperCase(),
                aircraftRegistration: flight.aircraftRegistration || null,
                weightKg: numberField("landingWeight"),
                surfaceCondition: fieldValue("landingSurface") || "dry",
                wind: fieldValue("landingWind") || "000/00",
                temperature: numberField("landingTemperature"),
                qnh: numberField("landingQnh"),
                flapSetting: optionalField("landingFlaps"),
                brakeSetting: optionalField("landingBrake"),
                reverserCredit: document.getElementById("landingReverser").checked,
                vrefAdditive: numberField("landingVref"),
                calculationMethod: fieldValue("landingMethod") || "inflight",
                marginMethod: fieldValue("landingMargin") || "factored",
                runwayShorten: optionalNumberField("landingShorten"),
                shortenUnits: "lda"
            };
        }

        function renderTakeoffResult() {
            if (!takeoffResult) return renderFlysmartPendingResult("takeoff");
            const summary = takeoffResult.summary || {};
            const rows = [
                ["CONF", summary.flaps],
                ["THRUST", [summary.thrust, summary.flexTemp ? `FLEX ${summary.flexTemp} C` : ""].filter(Boolean).join(" / ")],
                ["V1", formatSpeed(summary.v1)],
                ["VR", formatSpeed(summary.vr)],
                ["V2", formatSpeed(summary.v2)],
                ["MTOW (PERF)", formatWeight(summary.maxWeightKg)],
                ["MARGIN", formatWeight(summary.marginKg)],
                ["Status", takeoffResult.status]
            ];
            return `
                <div class="flysmart-result-heading">${escapeHtml(formatValue(takeoffResult.airportIcao))} ${escapeHtml(formatValue(takeoffResult.runway, ""))}</div>
                ${performanceResultRows(rows)}
                ${renderPerformanceWarnings(takeoffResult.warnings)}
                ${renderReadyForDepartureButton()}
            `;
        }

        function renderLandingResult() {
            if (!landingResult) return renderFlysmartPendingResult("landing");
            const summary = landingResult.summary || {};
            const rows = [
                ["LDG CONF", summary.flaps],
                ["LW", formatTonnes(landingResult.weightKg)],
                ["VAPP", formatSpeed(summary.vapp || summary.vref || summary.vrefSpeed)],
                ["LD", formatMeters(summary.requiredDistanceM)],
                ["BRK ENERGY", summary.brakeEnergyPercent ? `${summary.brakeEnergyPercent} %` : "N/A"],
                ["EO GA GRADIENT", summary.goAroundGradientPercent ? `${summary.goAroundGradientPercent} %` : "N/A"],
                ["TIRE SPEED", formatSpeed(summary.tireSpeedKt || summary.tireSpeed)],
                ["MLW (PERF)", formatTonnes(summary.maxLandingWeightKg)]
            ];
            return `<div class="flysmart-result-heading">${escapeHtml(formatValue(landingResult.airportIcao))} ${escapeHtml(formatValue(landingResult.runway, ""))}</div>${performanceResultRows(rows)}${renderPerformanceWarnings(landingResult.warnings)}<p class="empty" style="margin-top:12px;">Landing performance is advisory for approach preparation.</p>`;
        }

        function renderFlysmartPendingResult(phase) {
            const rows = phase === "landing"
                ? [["LDG CONF", "--"], ["LW", "-- T"], ["VAPP", "-- kt"], ["LD", "-- m"], ["BRK ENERGY", "-- %"], ["EO GA GRADIENT", "-- %"], ["TIRE SPEED", "-- kt"], ["MLW (PERF)", "-- T"]]
                : [["CONF", "--"], ["THRUST", "--"], ["V1", "-- kt"], ["VR", "-- kt"], ["V2", "-- kt"], ["MTOW (PERF)", "--"], ["MARGIN", "--"], ["STATUS", "READY"]];
            return `
                <div class="flysmart-result-heading">${phase === "landing" ? "LANDING DATA" : "TAKEOFF DATA"}</div>
                ${performanceResultRows(rows)}
                <p class="flysmart-hint">${phase === "landing" ? "All fields must be completed to compute your landing performance data." : "Set takeoff data and compute."}</p>
            `;
        }

        function renderFlysmartLandingMessage() {
            if (!landingResult) {
                return `<div class="flysmart-landing-message muted">All fields must be completed to compute your landing performance data</div>`;
            }
            const status = String(landingResult.status || "").toUpperCase();
            const isBad = ["FAILED", "ERROR", "BLOCKED"].includes(status);
            return `
                <div class="flysmart-landing-message ${isBad ? "warning" : "ok"}">
                    ${isBad ? "<strong>WARNING<br>LDG REQUIREMENT NOT FULFILLED<br>NOT AUTHORIZED LANDING</strong>" : "<strong>LANDING COMPUTED</strong>"}
                    <span>${isBad ? "DO NOT USE FOR OPERATIONAL PURPOSE" : "CHECK REQUIRED DISTANCE AND CREW BRIEFING"}</span>
                </div>
            `;
        }

        function renderFlysmartProcedurePanel(phase) {
            const title = phase === "landing" ? "APPROACH REVIEW" : "EOSID / TAKEOFF REVIEW";
            const body = phase === "landing"
                ? "Check landing configuration, braking action, runway condition, reverser credit, and required margin before continuing approach."
                : "Review runway, intersection, acceleration altitude, engine-out procedure, and any local SID or obstacle restriction before departure.";
            return `
                <div class="flysmart-procedure-panel">
                    <h3>${title}</h3>
                    <p>${body}</p>
                    <strong>${phase === "landing" ? "REVERSERS AS SELECTED" : "CLIMB OPTIMIZATION AVAILABLE"}</strong>
                </div>
            `;
        }

        function renderFlysmartRunwayPanel(phase, runway) {
            const label = runway || (phase === "landing" ? "12" : "36L");
            const summary = phase === "landing" ? (landingResult?.summary || {}) : (takeoffResult?.summary || {});
            const availableDistance = summary.availableDistanceM || summary.ldaM || summary.toraM;
            const requiredDistance = summary.requiredDistanceM || summary.stopDistanceM || summary.asdM;
            const distanceLabel = availableDistance ? `${Math.round(Number(availableDistance)).toLocaleString()} m` : (phase === "landing" ? "2,000 m" : "FULL");
            return `
                <div class="flysmart-runway-panel ${phase === "landing" ? "landing" : ""}" aria-label="${phase === "landing" ? "Landing runway" : "Takeoff runway"} ${escapeHtml(label)}">
                    <div class="flysmart-runway-status">${phase === "landing" ? "LD" : "STOP"}<span>${requiredDistance ? `${Math.round(Number(requiredDistance)).toLocaleString()} m` : "Margin pending"}</span></div>
                    ${phase === "landing" ? `<div class="flysmart-wind-arrow"><span></span><strong>3</strong><em>2</em></div>` : ""}
                    <div class="flysmart-runway">
                        <span class="flysmart-runway-dash dash-a"></span>
                        <span class="flysmart-runway-dash dash-b"></span>
                        <span class="flysmart-runway-dash dash-c"></span>
                        <span class="flysmart-runway-threshold top"></span>
                        <span class="flysmart-runway-threshold bottom"></span>
                        <small>${escapeHtml(distanceLabel)}</small>
                        <strong>${escapeHtml(label)}</strong>
                    </div>
                    <div class="flysmart-runway-scale">250 m</div>
                    <div class="flysmart-runway-tag">${phase === "landing" ? "LDA" : "FULL"}</div>
                </div>
            `;
        }

        function renderReadyForDepartureButton() {
            const status = String(takeoffResult?.status || "").toUpperCase();
            if (!performanceActiveFlight?.active || String(takeoffResult?.mode || "").toUpperCase() !== "OFFICIAL") {
                return `<p class="empty" style="margin-top:12px;">Manual calculation cannot mark official Ready for Departure.</p>`;
            }
            if (["FAILED", "ERROR"].includes(status)) {
                return `<p class="error" style="margin-top:12px;">Ready for Departure is blocked by this takeoff result.</p>`;
            }
            if (["OK", "WARNING", "NOT_SUPPORTED"].includes(status)) {
                return `<button class="primary-btn" id="readyForDepartureBtn" style="margin-top:14px;">MARK READY FOR DEPARTURE</button>`;
            }
            return "";
        }

        function performanceResultRows(rows) {
            return `
                <div class="performance-result">
                    ${rows.map(([label, value]) => `
                        <div class="performance-result-row">
                            <span>${escapeHtml(label)}</span>
                            <strong>${label === "Status" ? performanceStatusBadge(value) : escapeHtml(formatValue(value))}</strong>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        function renderPerformanceWarnings(warnings) {
            if (!Array.isArray(warnings) || !warnings.length) return "";
            return `<div class="performance-warnings">${warnings.map((warning) => `<p>${escapeHtml(typeof warning === "string" ? warning : (warning.message || JSON.stringify(warning)))}</p>`).join("")}</div>`;
        }

        function performanceInput(id, label, value, placeholder, type = "text") {
            return `<div class="field"><label for="${id}">${escapeHtml(label)}</label><input id="${id}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></div>`;
        }

        function surfaceSelect(id) {
            return methodSelect(id, "Surface condition", [["dry", "Dry"], ["wet", "Wet"]]);
        }

        function antiIceSelect() {
            return methodSelect("takeoffAntiIce", "Anti-ice", [["auto", "Auto"], ["on", "On"], ["off", "Off"]]);
        }

        function flapSelect(id, phase) {
            const options = phase === "landing"
                ? [["", "Optional"], ["FULL", "FULL"], ["3", "CONF 3"], ["2", "CONF 2"], ["1", "CONF 1"]]
                : [["", "Optional"], ["1", "CONF 1"], ["1+F", "CONF 1+F"], ["2", "CONF 2"], ["3", "CONF 3"]];
            return methodSelect(id, "Flap setting", options);
        }

        function methodSelect(id, label, options) {
            return `<div class="field"><label for="${id}">${escapeHtml(label)}</label><select id="${id}">${options.map(([value, text]) => `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`).join("")}</select></div>`;
        }

        function toggleField(id, label, checked) {
            return `<label class="toggle-field"><input id="${id}" type="checkbox"${checked ? " checked" : ""}><span>${escapeHtml(label)}</span></label>`;
        }

        function performanceModeNotice() {
            if (performanceActiveFlight?.active) return "";
            return `<p class="performance-manual-note">Manual calculation - not linked to official dispatched flight.</p>`;
        }

        function performanceWeatherNotice(prefix) {
            return `<p class="performance-wx-note" id="${prefix}WeatherStatus">WX auto-fill: enter a valid airport ICAO to load latest METAR.</p>`;
        }

        function bindPerformanceWeatherAutofill(prefix) {
            const airportInput = document.getElementById(`${prefix}Airport`);
            if (!airportInput) return;

            const normalizeAndLoad = () => {
                const icao = airportInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
                airportInput.value = icao;
                autofillPerformanceWeather(prefix, icao);
            };

            airportInput.addEventListener("change", normalizeAndLoad);
            airportInput.addEventListener("blur", normalizeAndLoad);
            if (airportInput.value.trim().length === 4) {
                window.setTimeout(normalizeAndLoad, 0);
            }
        }

        async function autofillPerformanceWeather(prefix, icao) {
            const status = document.getElementById(`${prefix}WeatherStatus`);
            if (!status || !icao || icao.length !== 4) {
                if (status) status.textContent = "WX auto-fill: enter a valid airport ICAO to load latest METAR.";
                return;
            }

            status.textContent = `WX auto-fill: loading ${icao} METAR...`;
            try {
                const report = await loadPerformanceMetar(icao);
                const weather = parsePerformanceWeather(report);
                if (!weather) throw new Error("No decoded METAR returned.");

                setPerformanceField(`${prefix}Wind`, weather.wind);
                setPerformanceField(`${prefix}Temperature`, weather.temperature);
                setPerformanceField(`${prefix}Qnh`, weather.qnh);
                if (weather.surfaceCondition) setPerformanceField(`${prefix}Surface`, weather.surfaceCondition);

                const details = [
                    weather.wind ? `wind ${weather.wind}` : "",
                    weather.temperature !== "" ? `temp ${weather.temperature}C` : "",
                    weather.qnh ? `QNH ${weather.qnh}` : ""
                ].filter(Boolean).join(", ");
                status.textContent = `WX auto-fill: ${icao} METAR loaded${details ? ` (${details})` : ""}.`;
            } catch (err) {
                status.textContent = `WX auto-fill: ${err.message || "unable to load METAR."}`;
            }
        }

        async function loadPerformanceMetar(icao) {
            if (performanceWeatherCache.has(icao)) return performanceWeatherCache.get(icao);
            if (performanceWeatherLoading.has(icao)) return performanceWeatherLoading.get(icao);

            const promise = fetch(`/api/checkwx?icao=${encodeURIComponent(icao)}`)
                .then(async (res) => {
                    const json = await res.json();
                    if (!res.ok || json.error) throw new Error(json.message || json.error || `CheckWX HTTP ${res.status}`);
                    const report = getFirstWeatherReport(json?.metar || json);
                    if (!report || report.error) throw new Error(report?.message || "No METAR returned.");
                    performanceWeatherCache.set(icao, report);
                    return report;
                })
                .finally(() => performanceWeatherLoading.delete(icao));

            performanceWeatherLoading.set(icao, promise);
            return promise;
        }

        function parsePerformanceWeather(report) {
            if (!report || report.error) return null;
            const wind = report.wind ? formatPerformanceWind(report.wind) : "";
            const temperature = report.temperature?.celsius ?? report.temperature?.value ?? report.temperature ?? "";
            const qnh = report.barometer?.hpa ?? report.barometer?.mb ?? (report.barometer?.hg ? Number(report.barometer.hg) * 33.8639 : "");
            const raw = String(report.raw_text || report.raw || "").toUpperCase();
            const surfaceCondition = /\b(SN|RA|DZ|SH|TS|GR|GS|FZRA|FZDZ|PL)\b/.test(raw) ? "wet" : "dry";
            return {
                wind,
                temperature: roundPerformanceNumber(temperature),
                qnh: roundPerformanceNumber(qnh),
                surfaceCondition
            };
        }

        function formatPerformanceWind(wind) {
            const rawDirection = wind.degrees ?? wind.direction ?? wind.dir;
            const directionNumber = Number(rawDirection);
            const direction = rawDirection === undefined || rawDirection === null || String(rawDirection).toUpperCase() === "VRB" || !Number.isFinite(directionNumber)
                ? "VRB"
                : String(Math.round(directionNumber)).padStart(3, "0");
            const speedNumber = Number(wind.speed_kts ?? wind.speed ?? 0);
            const speed = String(Math.round(Number.isFinite(speedNumber) ? speedNumber : 0)).padStart(2, "0");
            const gust = wind.gust_kts || wind.gust;
            const gustNumber = Number(gust);
            return `${direction}/${speed}${Number.isFinite(gustNumber) ? `G${Math.round(gustNumber)}` : ""}`;
        }

        function roundPerformanceNumber(value) {
            if (value === "" || value === null || value === undefined) return "";
            const number = Number(value);
            return Number.isFinite(number) ? String(Math.round(number)) : "";
        }

        function setPerformanceField(id, value) {
            if (value === "" || value === null || value === undefined) return;
            const field = document.getElementById(id);
            if (!field) return;
            field.value = value;
        }

        function performanceStatusBadge(status) {
            const value = String(formatValue(status, "N/A")).toUpperCase();
            return `<span class="status-badge status-${escapeHtml(value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${escapeHtml(value)}</span>`;
        }

        function fieldValue(id) {
            return document.getElementById(id)?.value.trim() || "";
        }

        function optionalField(id) {
            return fieldValue(id) || null;
        }

        function numberField(id) {
            const value = Number(fieldValue(id));
            if (!Number.isFinite(value)) throw new Error(`${document.querySelector(`label[for="${id}"]`)?.textContent || id} is required.`);
            return value;
        }

        function optionalNumberField(id) {
            const raw = fieldValue(id);
            if (!raw) return null;
            const value = Number(raw);
            if (!Number.isFinite(value)) throw new Error(`${document.querySelector(`label[for="${id}"]`)?.textContent || id} must be a number.`);
            return value;
        }

        function formatWeight(value) {
            if (value === undefined || value === null || value === "") return "N/A";
            const number = Number(value);
            return Number.isFinite(number) ? `${number.toLocaleString()} kg` : value;
        }

        function formatMeters(value) {
            if (value === undefined || value === null || value === "") return "N/A";
            const number = Number(value);
            return Number.isFinite(number) ? `${number.toLocaleString()} m` : value;
        }

        function formatSpeed(value) {
            if (value === undefined || value === null || value === "") return "N/A";
            const number = Number(value);
            return Number.isFinite(number) ? `${number.toLocaleString()} kt` : value;
        }

        function renderPirepLogbook() {
            document.getElementById("mainPanel").innerHTML = `
                <div class="grid">
                    <section class="card">
                        <h2>PIREP LOGBOOK</h2>
                        <div class="list">
                            ${renderPirepButtons(pirepsData || [])}
                        </div>
                    </section>
                    <section class="card">
                        <h2>SHOW PILOT PIREP</h2>
                        <div id="pirepDetail">
                            <p class="empty">Select a PIREP from the logbook.</p>
                        </div>
                    </section>
                </div>
            `;
            document.querySelectorAll("[data-pirep-id]").forEach((button) => {
                button.addEventListener("click", () => showPilotPirep(button.dataset.pirepId));
            });
        }

        function renderFlightCenter() {
            document.getElementById("mainPanel").innerHTML = `
                <div class="grid">
                    <section class="card">
                        <h2>Show Pilot Booking</h2>
                        <div class="list">
                            ${renderBookingButtons(bookingsData || [], "show")}
                        </div>
                    </section>
                    <section class="card">
                        <h2>Booking Detail</h2>
                        <div id="bookingDetail">
                            <p class="empty">Select a booking to show full details. SimBrief OFP access is available at the bottom of each booking detail.</p>
                        </div>
                    </section>
                </div>
            `;
            bindBookingButtons();
        }

        function renderShowBooking() {
            document.getElementById("mainPanel").innerHTML = `
                <div class="grid">
                    <section class="card">
                        <h2>Show Pilot Booking</h2>
                        <div class="list">
                            ${renderBookingButtons(bookingsData || [], "show")}
                        </div>
                    </section>
                    <section class="card">
                        <h2>Booking Detail</h2>
                        <div id="bookingDetail">
                            <p class="empty">Select a booking to show full details.</p>
                        </div>
                    </section>
                </div>
            `;
            bindBookingButtons();
        }

        function renderSimbriefOfp() {
            document.getElementById("mainPanel").innerHTML = `
                <div class="grid">
                    <section class="card">
                        <h2>SimBrief OFP</h2>
                        <div class="list">
                            ${renderBookingButtons(bookingsData || [], "simbrief")}
                        </div>
                    </section>
                    <section class="card">
                        <h2>OFP Data</h2>
                        <div id="simbriefDetail">
                            <p class="empty">Select a booking to open the full OFP page.</p>
                        </div>
                    </section>
                </div>
            `;
            bindBookingButtons();
        }

        async function renderDictionary() {
            const panel = document.getElementById("mainPanel");
            if (!abbreviationEntries) {
                panel.innerHTML = `<p class="empty">Loading dictionary database...</p>`;
                try {
                    await loadAbbreviationEntries();
                } catch (err) {
                    panel.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
                    return;
                }
            }

            const entries = getDictionaryEntries();
            const categories = ["All", ...new Set(entries.map((entry) => entry.category))];
            const filtered = filterDictionaryEntries(entries);
            const selected = selectedDictionaryTerm
                ? filtered.find((entry) => entry.id === selectedDictionaryTerm) || filtered[0]
                : filtered[0];
            selectedDictionaryTerm = selected?.id || null;

            document.getElementById("mainPanel").innerHTML = `
                <section class="dictionary-layout">
                    <div class="dictionary-searchbar">
                        <div class="field" style="margin:0;">
                            <label for="dictionarySearchInput">Search terminology</label>
                            <input id="dictionarySearchInput" autocomplete="off" value="${escapeHtml(dictionaryQuery)}" placeholder="CTOT, UNICOM, LEMD, wake turbulence">
                        </div>
                        <div class="dictionary-count">
                            <strong>${escapeHtml(filtered.length)}</strong>
                            <span>of ${escapeHtml(entries.length)} terms</span>
                        </div>
                    </div>
                    <div class="dictionary-categories" aria-label="Dictionary categories">
                        ${categories.map((category) => `
                            <button class="dictionary-chip ${category === dictionaryCategory ? "active" : ""}" data-dictionary-category="${escapeHtml(category)}">
                                ${escapeHtml(category)}
                            </button>
                        `).join("")}
                    </div>
                    <div class="dictionary-workbench">
                        <aside class="dictionary-list" id="dictionaryList">
                            ${renderDictionaryList(filtered)}
                        </aside>
                        <section class="dictionary-detail" id="dictionaryDetail">
                            ${renderDictionaryDetail(selected)}
                        </section>
                    </div>
                </section>
            `;

            const input = document.getElementById("dictionarySearchInput");
            input.addEventListener("input", () => {
                dictionaryQuery = input.value;
                selectedDictionaryTerm = null;
                renderDictionary();
                const nextInput = document.getElementById("dictionarySearchInput");
                nextInput.focus();
                nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
            });

            document.querySelectorAll("[data-dictionary-category]").forEach((button) => {
                button.addEventListener("click", () => {
                    dictionaryCategory = button.dataset.dictionaryCategory;
                    selectedDictionaryTerm = null;
                    renderDictionary();
                });
            });

            document.querySelectorAll("[data-dictionary-term]").forEach((button) => {
                button.addEventListener("click", () => {
                    selectedDictionaryTerm = button.dataset.dictionaryTerm;
                    renderDictionary();
                });
            });
        }

        function getDictionaryEntries() {
            const terminology = Array.isArray(window.HPF_TERMINOLOGY_ENTRIES) ? window.HPF_TERMINOLOGY_ENTRIES : [];
            const abbreviations = Array.isArray(abbreviationEntries) ? abbreviationEntries : [];
            return [...terminology, ...abbreviations].map((entry, index) => ({
                ...entry,
                id: entry.id || `term-${index}-${entry.category}-${entry.term}`
            }));
        }

        async function loadAbbreviationEntries() {
            if (abbreviationEntries) return abbreviationEntries;
            if (!abbreviationLoadPromise) {
                abbreviationLoadPromise = fetch("assets/aviation-abbreviations-data.json")
                    .then((response) => {
                        if (!response.ok) throw new Error(`Dictionary database failed to load (HTTP ${response.status}).`);
                        return response.json();
                    })
                    .then((entries) => {
                        abbreviationEntries = Array.isArray(entries) ? entries : [];
                        return abbreviationEntries;
                    });
            }
            return abbreviationLoadPromise;
        }

        function filterDictionaryEntries(entries) {
            const query = dictionaryQuery.trim().toLowerCase();
            return entries.filter((entry) => {
                const categoryMatch = dictionaryCategory === "All" || entry.category === dictionaryCategory;
                if (!categoryMatch) return false;
                if (!query) return true;
                const haystack = [
                    entry.term,
                    entry.fullName,
                    entry.category,
                    entry.sourceGroup,
                    entry.definition,
                    entry.definitionEs,
                    entry.vatsimUse,
                    entry.vatsimUseEs,
                    entry.example,
                    entry.exampleEs,
                    ...(entry.tags || [])
                ].join(" ").toLowerCase();
                return haystack.includes(query);
            });
        }

        function renderDictionaryList(entries) {
            if (!entries.length) {
                return `<p class="empty">No terminology matches this search.</p>`;
            }

            const limit = 320;
            const visibleEntries = entries.slice(0, limit);
            const notice = entries.length > limit
                ? `<p class="empty dictionary-limit">Showing first ${limit} matches. Refine the search to narrow ${entries.length} results.</p>`
                : "";

            return `${notice}${visibleEntries.map((entry) => `
                <button class="dictionary-item ${entry.id === selectedDictionaryTerm ? "active" : ""}" data-dictionary-term="${escapeHtml(entry.id)}">
                    <span>${escapeHtml(entry.category)}</span>
                    <strong>${escapeHtml(entry.term)}</strong>
                    <small>${escapeHtml(entry.fullName || entry.sourceGroup)}</small>
                </button>
            `).join("")}`;
        }

        function renderDictionaryDetail(entry) {
            if (!entry) {
                return `<div class="dictionary-empty"><strong>No term selected</strong><span>Search or choose a category to begin.</span></div>`;
            }

            const related = Array.isArray(entry.related) && entry.related.length
                ? entry.related.map((item) => `<span>${escapeHtml(item)}</span>`).join("")
                : `<span>${escapeHtml(entry.category)}</span><span>${escapeHtml(entry.sourceGroup)}</span>`;

            return `
                <div class="dictionary-detail-head">
                    <span>${escapeHtml(entry.category)}</span>
                    <h2>${escapeHtml(entry.term)}</h2>
                    ${entry.fullName ? `<p>${escapeHtml(entry.fullName)}</p>` : ""}
                </div>
                <div class="dictionary-block">
                    <h3>Definition / Definicion</h3>
                    <p>${escapeHtml(entry.definition)}</p>
                    <p class="dictionary-es">${escapeHtml(entry.definitionEs || "")}</p>
                </div>
                <div class="dictionary-block">
                    <h3>Use on VATSIM Spain / Uso en VATSIM Spain</h3>
                    <p>${escapeHtml(entry.vatsimUse)}</p>
                    <p class="dictionary-es">${escapeHtml(entry.vatsimUseEs || "")}</p>
                </div>
                <div class="dictionary-block">
                    <h3>Example / Ejemplo</h3>
                    <p class="dictionary-example">${escapeHtml(entry.example)}</p>
                    <p class="dictionary-example dictionary-es">${escapeHtml(entry.exampleEs || "")}</p>
                </div>
                <div class="dictionary-block">
                    <h3>Source</h3>
                    <p>${escapeHtml(entry.sourceGroup)}</p>
                    ${entry.sourceUrl ? `<a class="inline-link" href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source reference</a>` : ""}
                </div>
                <div class="dictionary-related">
                    ${related}
                </div>
            `;
        }

        function renderWeather() {
            document.getElementById("mainPanel").innerHTML = `
                <div class="grid">
                    <section class="card wide">
                        <h2>Request Weather Information</h2>
                        <div class="weather-form">
                            <div class="field" style="margin:0;">
                                <label for="wxIcaoInput">Airport ICAO</label>
                                <input id="wxIcaoInput" autocomplete="off" maxlength="4" placeholder="LEMD">
                            </div>
                            <button class="primary-btn" id="wxRequestBtn">REQUEST WX</button>
                        </div>
                    </section>
                    <section class="card wide">
                        <h2>Weather Reports</h2>
                        <div id="wxResult">
                            <p class="empty">Enter an ICAO code to request the latest METAR and TAFOR.</p>
                        </div>
                    </section>
                </div>
            `;

            const input = document.getElementById("wxIcaoInput");
            const button = document.getElementById("wxRequestBtn");
            button.addEventListener("click", requestWeather);
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter") requestWeather();
            });
        }

        function renderWindy() {
            const windyUrl = getWindyRadarUrl(windyLocation);
            document.getElementById("mainPanel").innerHTML = `
                <section class="windy-layout">
                    <div class="windy-toolbar">
                        <div>
                            <h2>WINDY Weather Radar</h2>
                            <div class="meta windy-meta">
                                <span>${escapeHtml(windyLocation.label)}</span>
                                <span>Overlay: Radar</span>
                                <span>Wind: kt</span>
                            </div>
                        </div>
                        <a class="inline-btn" href="${escapeHtml(windyUrl)}" target="_blank" rel="noopener noreferrer">OPEN WINDY</a>
                    </div>
                    <div class="windy-search">
                        <div class="field" style="margin:0;">
                            <label for="windySearchInput">City or airport</label>
                            <input id="windySearchInput" autocomplete="off" placeholder="LEMD or Madrid">
                        </div>
                        <button class="primary-btn" id="windySearchBtn">LOCATE</button>
                        <p id="windySearchStatus" class="empty">${escapeHtml(windySearchStatus)}</p>
                    </div>
                    <div class="windy-frame">
                        <iframe
                            title="WINDY weather radar"
                            src="${escapeHtml(windyUrl)}"
                            loading="lazy"
                            referrerpolicy="no-referrer-when-downgrade"
                            allowfullscreen>
                        </iframe>
                    </div>
                </section>
            `;

            const input = document.getElementById("windySearchInput");
            const button = document.getElementById("windySearchBtn");
            button.addEventListener("click", locateWindyPlace);
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter") locateWindyPlace();
            });
        }

        async function locateWindyPlace() {
            const input = document.getElementById("windySearchInput");
            const status = document.getElementById("windySearchStatus");
            const query = input.value.trim();
            if (!query) {
                status.textContent = "Enter an airport ICAO/IATA code or city name.";
                return;
            }

            const airport = findAirportForWindy(query);
            if (airport) {
                windyLocation = {
                    label: `${airport.icao} ${airport.name || "Airport"}`,
                    lat: airport.lat,
                    lon: airport.lon,
                    zoom: 8
                };
                windySearchStatus = `Located ${windyLocation.label}`;
                renderWindy();
                return;
            }

            status.textContent = `Searching ${query}...`;
            try {
                const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
                const json = await response.json();
                const place = Array.isArray(json.results) ? json.results[0] : null;
                if (!response.ok || !place) throw new Error("No city match found.");

                const country = place.country_code || place.country || "";
                windyLocation = {
                    label: [place.name, country].filter(Boolean).join(", "),
                    lat: place.latitude,
                    lon: place.longitude,
                    zoom: place.population && place.population > 500000 ? 7 : 8
                };
                windySearchStatus = `Located ${windyLocation.label}`;
                renderWindy();
            } catch (err) {
                status.textContent = err.message || "Unable to locate that city or airport.";
            }
        }

        function findAirportForWindy(query) {
            const normalized = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            const airports = window.HPF_AIRPORT_COORDS || {};
            if (airports[normalized]) return airports[normalized];
            return Object.values(airports).find((airport) => airport.iata === normalized) || null;
        }

        function getWindyRadarUrl(location = windyLocation) {
            const params = new URLSearchParams({
                lat: String(location.lat),
                lon: String(location.lon),
                detailLat: String(location.lat),
                detailLon: String(location.lon),
                width: "650",
                height: "450",
                zoom: String(location.zoom || 5),
                level: "surface",
                overlay: "radar",
                product: "radar",
                marker: "true",
                calendar: "now",
                type: "map",
                location: "coordinates",
                metricWind: "kt",
                metricTemp: "C",
                radarRange: "-1"
            });

            return `https://embed.windy.com/embed2.html?${params.toString()}`;
        }

        async function requestWeather() {
            const input = document.getElementById("wxIcaoInput");
            const result = document.getElementById("wxResult");
            const icao = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            input.value = icao;
            if (!icao || icao.length < 3) {
                result.innerHTML = `<p class="error">Enter a valid airport ICAO code.</p>`;
                return;
            }

            result.innerHTML = `<p class="empty">Requesting METAR and TAFOR for ${escapeHtml(icao)}...</p>`;
            try {
                const res = await fetch(`/api/checkwx?icao=${encodeURIComponent(icao)}`);
                const json = await res.json();
                if (!res.ok || json.error) throw new Error(json.message || json.error || `CheckWX HTTP ${res.status}`);
                result.innerHTML = renderWeatherData(json);
            } catch (err) {
                result.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
            }
        }

        function renderWeatherData(payload) {
            const metarPayload = payload?.metar || payload;
            const tafPayload = payload?.taf || null;
            const report = getFirstWeatherReport(metarPayload);
            const tafReport = getFirstWeatherReport(tafPayload);
            if (!report && !tafReport) return `<p class="empty">No weather reports returned.</p>`;
            const metarHtml = report && !report.error
                ? renderMetarReport(report)
                : renderRawWeatherReport("METAR", report, "No METAR returned.");
            const tafHtml = renderRawWeatherReport("TAFOR", tafReport, "No TAFOR returned.");

            return `${metarHtml}${tafHtml}`;
        }

        function getFirstWeatherReport(payload) {
            if (!payload) return null;
            if (payload.error) return payload;
            return Array.isArray(payload.data) ? payload.data[0] : payload.data || payload;
        }

        function renderRawWeatherReport(title, report, emptyMessage) {
            const station = report?.icao || report?.station?.icao || title;
            const rawText = report?.raw_text || report?.raw || report?.text || report?.message;

            return `
                <div class="weather-report">
                    <h3>${escapeHtml(formatValue(station, title))} <span class="wx-badge">${escapeHtml(title)}</span></h3>
                    <p class="empty">${escapeHtml(formatValue(rawText, emptyMessage))}</p>
                </div>
            `;
        }

        function renderMetarReport(report) {
            const wind = report.wind
                ? `${formatValue(report.wind.degrees, "VRB")} / ${formatValue(report.wind.speed_kts)} kt${report.wind.gust_kts ? ` G${report.wind.gust_kts}` : ""}`
                : "N/A";
            const clouds = Array.isArray(report.clouds) && report.clouds.length
                ? report.clouds.map((cloud) => `${formatValue(cloud.code || cloud.text)} ${formatValue(cloud.base_feet_agl, "")}`.trim()).join(", ")
                : "N/A";
            const rows = [
                ["Station", report.icao || report.station?.icao],
                ["Observed", report.observed || report.observed_time],
                ["Category", report.flight_category],
                ["Wind", wind],
                ["Visibility", report.visibility?.meters ? `${report.visibility.meters} m` : report.visibility?.miles ? `${report.visibility.miles} SM` : report.visibility],
                ["Clouds", clouds],
                ["Temperature", report.temperature?.celsius !== undefined ? `${report.temperature.celsius} C` : report.temperature],
                ["Dewpoint", report.dewpoint?.celsius !== undefined ? `${report.dewpoint.celsius} C` : report.dewpoint],
                ["Altimeter", report.barometer?.hpa ? `${report.barometer.hpa} hPa` : report.barometer?.hg ? `${report.barometer.hg} inHg` : report.barometer]
            ];

            return `
                <div class="weather-report">
                    <h3>${escapeHtml(formatValue(report.icao || "METAR"))} <span class="wx-badge">${escapeHtml(formatValue(report.flight_category, "WX"))}</span></h3>
                    <p class="empty" style="margin-bottom:12px;">${escapeHtml(formatValue(report.raw_text || report.raw || "No raw METAR text returned."))}</p>
                    <div class="data-list">
                        ${rows.map(([label, value]) => `
                            <div class="data-row">
                                <span>${escapeHtml(label)}</span>
                                <strong>${escapeHtml(formatValue(value))}</strong>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
        }

        function renderPirepButtons(list) {
            if (!Array.isArray(list) || list.length === 0) {
                return `<p class="empty">No submitted PIREPs.</p>`;
            }

            return list.map((pirep) => `
                <button class="item item-button" data-pirep-id="${escapeHtml(pirep.id)}">
                    <div class="item-title">
                        <span>${escapeHtml(`${formatValue(pirep.flight_number, "Flight")} ${formatValue(pirep.callsign, "")}`.trim())}</span>
                        <span class="pill">${escapeHtml(formatValue(pirep.status, "PIREP"))}</span>
                    </div>
                    <div class="meta">
                        <span>From: ${escapeHtml(formatAirport(pirep, "departure"))}</span>
                        <span>To: ${escapeHtml(formatAirport(pirep, "arrival"))}</span>
                        <span>ID: ${escapeHtml(formatValue(pirep.id))}</span>
                    </div>
                </button>
            `).join("");
        }

        function renderBookingButtons(list, action) {
            if (!Array.isArray(list) || list.length === 0) {
                return `<p class="empty">No active bookings.</p>`;
            }

            return list.map((booking) => `
                <button class="item item-button" data-booking-id="${escapeHtml(booking.id)}" data-booking-action="${action}">
                    <div class="item-title">
                        <span>${escapeHtml(`${formatValue(booking.flight_number, "Flight")} ${formatValue(booking.callsign, "")}`.trim())}</span>
                        <span class="pill">${escapeHtml(formatValue(booking.type, "Booking"))}</span>
                    </div>
                    <div class="meta">
                        <span>From: ${escapeHtml(formatAirport(booking, "departure"))}</span>
                        <span>To: ${escapeHtml(formatAirport(booking, "arrival"))}</span>
                        <span>ID: ${escapeHtml(formatValue(booking.id))}</span>
                    </div>
                </button>
            `).join("");
        }

        function bindBookingButtons() {
            document.querySelectorAll("[data-booking-id]").forEach((button) => {
                button.addEventListener("click", () => {
                    if (button.dataset.bookingAction === "simbrief") {
                        showSimbriefOfp(button.dataset.bookingId);
                    } else {
                        showPilotBooking(button.dataset.bookingId);
                    }
                });
            });
        }

        async function showPilotPirep(id) {
            const box = document.getElementById("pirepDetail");
            box.innerHTML = `<p class="empty">Loading PIREP ${escapeHtml(id)}...</p>`;
            try {
                const detailResult = await fetchPilotJson(`/pireps/${id}`);

                const detail = detailResult.data || detailResult || {};
                box.innerHTML = `
                    ${renderObjectDetails(detail)}
                    <div class="detail-actions">
                        <button class="primary-btn" id="openFlightTrackBtn">OPEN FLIGHT TRACK</button>
                    </div>
                `;
                document.getElementById("openFlightTrackBtn").addEventListener("click", () => showDashboardFlightTrack(id));
            } catch (err) {
                box.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
            }
        }

        function showDashboardFlightTrack(id) {
            document.getElementById("mainPanel").innerHTML = `
                <section class="card wide" style="height:100%;min-height:640px;">
                    <div class="item-title">
                        <h2 style="margin:0;">Flight Track</h2>
                        <button class="logout-btn" style="width:auto;padding:0 18px;" id="backToPirepsBtn">BACK TO LOGBOOK</button>
                    </div>
                    <iframe class="pdf-frame" style="min-height:560px;background:#07111f;" src="flight-status.html?pirep=${encodeURIComponent(id)}&embedded=1" title="Flight Track"></iframe>
                </section>
            `;
            document.getElementById("backToPirepsBtn").addEventListener("click", renderPirepLogbook);
        }

        async function showPilotBooking(id) {
            const box = document.getElementById("bookingDetail");
            if (!box) return;
            box.innerHTML = `<p class="empty">Loading booking ${escapeHtml(id)}...</p>`;
            try {
                const json = await fetchPilotJson(`/bookings/${id}`);
                box.innerHTML = `
                    ${renderObjectDetails(json.data || {})}
                    <div class="detail-actions">
                        <a class="primary-link" href="ofp.html?booking=${encodeURIComponent(id)}">OPEN SIMBRIEF LIDO OFP</a>
                    </div>
                `;
            } catch (err) {
                box.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
            }
        }

        async function showSimbriefOfp(id) {
            window.location.href = `ofp.html?booking=${encodeURIComponent(id)}`;
        }

        function unwrapList(payload) {
            if (Array.isArray(payload)) return payload;
            if (Array.isArray(payload?.data)) return payload.data;
            if (Array.isArray(payload?.data?.data)) return payload.data.data;
            if (Array.isArray(payload?.positions)) return payload.positions;
            if (Array.isArray(payload?.data?.positions)) return payload.data.positions;
            if (Array.isArray(payload?.profile)) return payload.profile;
            if (Array.isArray(payload?.data?.profile)) return payload.data.profile;
            return [];
        }

        function renderPirepTrack(positions, profile, id) {
            const points = extractTrackPoints(positions);
            const fallback = points.length >= 2 ? points : extractProfilePoints(profile);
            if (fallback.length < 2) {
                return `
                    <div class="track-card">
                        <h3>Flight Track</h3>
                        <p class="empty">No usable track/profile points returned for PIREP #${escapeHtml(id)}.</p>
                    </div>
                `;
            }

            const svg = buildTrackSvg(fallback, points.length >= 2);
            return `
                <div class="track-card">
                    <h3>${points.length >= 2 ? "Flight Track" : "Flight Profile"}</h3>
                    ${svg}
                </div>
            `;
        }

        function extractTrackPoints(list) {
            return list
                .map((point) => ({
                    x: Number(point.longitude ?? point.lng ?? point.lon),
                    y: Number(point.latitude ?? point.lat)
                }))
                .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
        }

        function extractProfilePoints(list) {
            return list
                .map((point, index) => ({
                    x: Number(point.distance ?? point.elapsed_time ?? point.time ?? index),
                    y: Number(point.altitude ?? point.alt ?? point.flight_level ?? point.fl)
                }))
                .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
        }

        function buildTrackSvg(points, isGeoTrack) {
            const width = 1000;
            const height = 260;
            const pad = 28;
            const xs = points.map((point) => point.x);
            const ys = points.map((point) => point.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const scale = (value, min, max, start, end) => {
                if (max === min) return (start + end) / 2;
                return start + ((value - min) / (max - min)) * (end - start);
            };
            const polyline = points.map((point) => {
                const x = scale(point.x, minX, maxX, pad, width - pad);
                const y = scale(point.y, minY, maxY, height - pad, pad);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ");
            const first = polyline.split(" ")[0];
            const last = polyline.split(" ").at(-1);
            const [startX, startY] = first.split(",");
            const [endX, endY] = last.split(",");

            return `
                <svg class="track-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${isGeoTrack ? "Flight track" : "Flight profile"}">
                    <polyline points="${polyline}" fill="none" stroke="#ffc400" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></polyline>
                    <circle cx="${startX}" cy="${startY}" r="8" fill="#ff6b6b"></circle>
                    <circle cx="${endX}" cy="${endY}" r="8" fill="#72f0a3"></circle>
                    <text x="${Math.min(Number(startX) + 10, width - 80)}" y="${Math.max(Number(startY) - 10, 18)}" fill="#fff" font-size="14" font-weight="700">DEP</text>
                    <text x="${Math.min(Number(endX) + 10, width - 80)}" y="${Math.max(Number(endY) - 10, 18)}" fill="#fff" font-size="14" font-weight="700">ARR</text>
                </svg>
            `;
        }

        function renderObjectDetails(data) {
            const rows = buildReadableRows(data || {});
            if (rows.length === 0) return `<p class="empty">No detail returned.</p>`;

            return `
                <div class="data-list">
                    ${rows.map(([key, value]) => `
                        <div class="data-row">
                            <span>${escapeHtml(key)}</span>
                            <strong>${escapeHtml(formatDetailValue(value))}</strong>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        function buildReadableRows(data) {
            const preferred = [
                ["Flight", `${formatValue(data.flight_number, "Flight")} ${formatValue(data.callsign, "")}`.trim()],
                ["Departure", formatAirport(data, "departure")],
                ["Arrival", formatAirport(data, "arrival")],
                ["Status", data.status || data.type],
                ["Network", data.network],
                ["Departure Time", data.departure_time],
                ["Arrival Time", data.arrival_time],
                ["Aircraft", formatAircraft(data)],
                ["Route", formatRoute(data)],
                ["Altitude", data.altitude],
                ["Distance", data.distance],
                ["Flight Time", data.flight_time],
                ["Landing Rate", data.landing_rate],
                ["Fuel Used", data.fuel_used],
                ["PIREP ID", data.pirep_id || data.id],
                ["Booking ID", data.booking_id]
            ].filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== "N/A");

            const used = new Set(["flight_number", "callsign", "departure_id", "arrival_id", "departure_time", "arrival_time", "status", "type", "network", "user_route", "altitude", "distance", "flight_time", "landing_rate", "fuel_used", "pirep_id", "booking_id", "id", "aircraft_id"]);
            const extras = Object.entries(data)
                .filter(([key, value]) => !used.has(key) && value !== null && value !== undefined && typeof value !== "object")
                .map(([key, value]) => [formatLabel(key), formatExtraDetailValue(key, value)]);

            return [...preferred, ...extras];
        }

        function formatExtraDetailValue(key, value) {
            const airportKey = /(^|_)airport_id$/.test(key) || ["departure_id", "arrival_id", "origin_id", "destination_id"].includes(key);
            if (airportKey) {
                return lookupAirport(value)?.icao || value;
            }
            return value;
        }

        function renderLidoOfp(raw) {
            const ofp = raw.ofp_data || raw;
            const atc = ofp.atc || {};
            const general = ofp.general || {};
            const fuel = ofp.fuel || {};
            const times = ofp.times || {};
            const weights = ofp.weights || {};
            const navlog = ofp.navlog || {};
            const route = atc.route || ofp.route || navlog.route || atc.route_ifps || "N/A";
            const callsign = atc.callsign || general.icao_airline || general.flight_number || "N/A";
            const origin = atc.fir_orig || atc.orig || general.origin || ofp.origin || "N/A";
            const dest = atc.fir_dest || atc.dest || general.destination || ofp.destination || "N/A";
            const altn = atc.altn || general.alternate || ofp.alternate || "N/A";

            return `
                <div class="ofp-viewer">
                    <div class="ofp-sheet">
                        <div class="ofp-title">
                            <div>
                                <h2>HISPAFLY OFP</h2>
                                <p>OPERATIONAL FLIGHT PLAN / LIDO STYLE VIEW</p>
                            </div>
                            <strong>${escapeHtml(callsign)}</strong>
                        </div>
                        <div class="ofp-grid">
                            ${ofpBox("ORIGIN", origin)}
                            ${ofpBox("DEST", dest)}
                            ${ofpBox("ALTN", altn)}
                            ${ofpBox("AIRCRAFT", atc.aircraft || general.aircraft || "N/A")}
                            ${ofpBox("ETOPS", atc.fir_etops?.join(", ") || "N/A")}
                            ${ofpBox("FUEL", fuel.plan_ramp || fuel.trip || fuel.block || "N/A")}
                            ${ofpBox("EET", times.est_time_enroute || times.sched_time_enroute || "N/A")}
                            ${ofpBox("ZFW", weights.est_zfw || weights.max_zfw || "N/A")}
                        </div>
                        <div class="ofp-section">
                            <h3>ATC FLIGHT PLAN</h3>
                            <div class="ofp-pre">${escapeHtml(atc.section18 || atc.raw || "N/A")}</div>
                        </div>
                        <div class="ofp-section">
                            <h3>ROUTE</h3>
                            <div class="ofp-pre">${escapeHtml(route)}</div>
                        </div>
                        <div class="ofp-section">
                            <h3>RAW OFP DATA</h3>
                            <div class="ofp-pre">${escapeHtml(JSON.stringify(ofp, null, 2))}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        function renderSimbriefPanel(bookingId, data, errorMessage = "") {
            return `
                <div class="ofp-viewer">
                    <div class="ofp-toolbar">
                        <div class="field" style="margin:0;">
                            <label for="dispatchIdInput">SimBrief dispatch_id / request_id / static_id</label>
                            <input id="dispatchIdInput" autocomplete="off" placeholder="Paste SimBrief dispatch ID">
                        </div>
                        <button class="inline-btn" id="attachSimbriefBtn">ATTACH OFP</button>
                    </div>
                    <div id="ofpRenderTarget">
                        ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : renderOfpContent(data)}
                    </div>
                </div>
            `;
        }

        function renderOfpContent(data) {
            const pdfUrl = data?.pdf_url || data?.ofp_data?.pdf_url;
            if (pdfUrl) {
                return `<iframe class="pdf-frame" src="${escapeHtml(pdfUrl)}" title="SimBrief OFP PDF"></iframe>`;
            }
            if (!data) {
                return `<p class="empty">No OFP is currently attached to this booking.</p>`;
            }
            return renderLidoOfp(data);
        }

        async function attachSimbriefOfp(bookingId) {
            const target = document.getElementById("ofpRenderTarget");
            const dispatchId = document.getElementById("dispatchIdInput").value.trim();
            if (!dispatchId) {
                target.innerHTML = `<p class="error">dispatch_id is required.</p>`;
                return;
            }

            target.innerHTML = `<p class="empty">Attaching SimBrief OFP...</p>`;
            try {
                const json = await fetchPilotJson(`/bookings/${bookingId}/simbrief`, {}, {
                    method: "PUT",
                    body: { dispatch_id: dispatchId }
                });
                target.innerHTML = renderOfpContent(json.data || json);
            } catch (err) {
                target.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
            }
        }

        function ofpBox(label, value) {
            return `<div class="ofp-box"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatValue(value))}</strong></div>`;
        }

        function formatDetailValue(value) {
            if (typeof value === "object" && value !== null) {
                return JSON.stringify(value);
            }
            return formatValue(value);
        }

        function formatAirport(data, side) {
            const objectKeys = [
                side,
                `${side}_airport`,
                `${side}Airport`,
                `${side}_apt`
            ];
            for (const key of objectKeys) {
                const obj = data?.[key];
                const code = obj?.icao || obj?.icao_code || obj?.iata || obj?.identifier || obj?.code;
                if (code) return code;
            }
            const direct = data?.[`${side}_icao`] || data?.[`${side}_icao_code`] || data?.[`${side}_iata`] || data?.[`${side}_code`];
            if (direct) return direct;
            const id = data?.[`${side}_id`];
            const airport = lookupAirport(id);
            if (airport) {
                return airport.icao || airport.iata || `Airport #${airport.id}`;
            }
            return id ? `Airport #${id}` : "N/A";
        }

        function formatAircraft(data) {
            const aircraft = data.aircraft || data.fleet || {};
            const direct = aircraft.registration || aircraft.reg || aircraft.name || aircraft.icao || aircraft.type;
            if (direct) return direct;
            const ref = lookupAircraft(data.aircraft_id);
            if (ref) {
                return [ref.registration, ref.name].filter(Boolean).join(" - ") || `Aircraft #${ref.id}`;
            }
            return data.aircraft_id ? `Aircraft #${data.aircraft_id}` : "N/A";
        }

        function formatRoute(data) {
            const route = lookupRoute(data.route_id);
            if (route) {
                const routeLine = route.routing ? ` | ${route.routing}` : "";
                return `${route.departure} - ${route.arrival}${routeLine}`;
            }
            return data.user_route || (data.route_id ? `Route #${data.route_id}` : "N/A");
        }

        function lookupAirport(id) {
            if (id === undefined || id === null || id === "") return null;
            return window.HPF_REFERENCE_DATA?.airports?.[String(id)] || null;
        }

        function lookupAircraft(id) {
            if (id === undefined || id === null || id === "") return null;
            return window.HPF_REFERENCE_DATA?.aircraft?.[String(id)] || null;
        }

        function lookupRoute(id) {
            if (id === undefined || id === null || id === "") return null;
            return window.HPF_REFERENCE_DATA?.routes?.[String(id)] || null;
        }

        function formatLabel(key) {
            return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
        }

        function renderBookedFlight() {
            const bookingItems = renderFlightList(bookingsData || [], "No active bookings.");
            const pirepItems = renderFlightList(pirepsData || [], "No submitted PIREPs.", true);
            const claimsItems = Array.isArray(claimsData)
                ? renderFlightList(claimsData, "No claims returned.")
                : `<p class="error">${escapeHtml(claimsData?.error || "Claims unavailable.")}</p>`;

            document.getElementById("mainPanel").innerHTML = `
                <div class="grid">
                    <section class="card">
                        <h2>Read Bookings</h2>
                        <div class="list">${bookingItems}</div>
                    </section>
                    <section class="card">
                        <h2>PIREP Logbook</h2>
                        <div class="list">${pirepItems}</div>
                    </section>
                    <section class="card wide">
                        <h2>Claims, Comments, and Logbook</h2>
                        <div class="list">${claimsItems}</div>
                    </section>
                </div>
            `;
        }

        function renderDispatch() {
            document.getElementById("mainPanel").innerHTML = `
                <div class="action-grid">
                    <div class="action-card">
                        <strong>Create Booking</strong>
                        <div class="field">
                            <label for="bookingRouteId">Route ID</label>
                            <input id="bookingRouteId" inputmode="numeric" placeholder="Route ID">
                        </div>
                        <div class="field">
                            <label for="bookingAircraftId">Aircraft ID</label>
                            <input id="bookingAircraftId" inputmode="numeric" placeholder="Aircraft ID">
                        </div>
                        <div class="field">
                            <label for="bookingDepartureTime">Departure Time UTC</label>
                            <input id="bookingDepartureTime" type="datetime-local">
                        </div>
                        <div class="field">
                            <label for="bookingNetwork">Network</label>
                            <select id="bookingNetwork">
                                <option value="offline">Offline</option>
                                <option value="vatsim">VATSIM</option>
                                <option value="ivao">IVAO</option>
                                <option value="poscon">POSCON</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <button class="primary-btn" id="createBookingBtn">CREATE BOOKING</button>
                    </div>
                    <div class="action-card">
                        <strong>Dispatch Flight</strong>
                        <div class="field">
                            <label for="dispatchBookingId">Booking ID</label>
                            <input id="dispatchBookingId" inputmode="numeric" placeholder="Booking ID">
                        </div>
                        <button class="primary-btn" id="loadSimbriefBtn">LOAD SIMBRIEF</button>
                        <p style="margin-top:12px;">Loads operational briefing data for an existing booking.</p>
                    </div>
                    <div class="action-card">
                        <strong>File PIREP</strong>
                        <div class="field">
                            <label for="pirepBookingId">Booking ID</label>
                            <input id="pirepBookingId" inputmode="numeric" placeholder="Booking ID">
                        </div>
                        <div class="field">
                            <label for="pirepDepartureTime">Actual Departure UTC</label>
                            <input id="pirepDepartureTime" type="datetime-local">
                        </div>
                        <div class="field">
                            <label for="pirepArrivalTime">Actual Arrival UTC</label>
                            <input id="pirepArrivalTime" type="datetime-local">
                        </div>
                        <div class="field">
                            <label for="pirepPoints">Points</label>
                            <input id="pirepPoints" inputmode="numeric" value="0">
                        </div>
                        <button class="primary-btn" id="filePirepBtn">FILE PIREP</button>
                    </div>
                    <div class="action-card">
                        <strong>PIREP Comments</strong>
                        <div class="field">
                            <label for="commentPirepId">PIREP ID</label>
                            <input id="commentPirepId" inputmode="numeric" placeholder="PIREP ID">
                        </div>
                        <div class="field">
                            <label for="commentContent">Comment</label>
                            <textarea id="commentContent" maxlength="1000" placeholder="Write comment"></textarea>
                        </div>
                        <button class="primary-btn" id="sendCommentBtn">SEND COMMENT</button>
                    </div>
                    <div class="card wide">
                        <h2>Dispatch Result</h2>
                        <div class="message-log" id="dispatchResult">READY</div>
                    </div>
                </div>
            `;

            document.getElementById("createBookingBtn").addEventListener("click", createBooking);
            document.getElementById("loadSimbriefBtn").addEventListener("click", loadSimbrief);
            document.getElementById("filePirepBtn").addEventListener("click", filePirep);
            document.getElementById("sendCommentBtn").addEventListener("click", sendPirepComment);
        }

        async function createBooking() {
            await runDispatchAction(async () => {
                const body = {
                    route_id: requiredInt("bookingRouteId", "Route ID"),
                    aircraft_id: requiredInt("bookingAircraftId", "Aircraft ID"),
                    departure_time: requiredDate("bookingDepartureTime", "Departure time"),
                    network: document.getElementById("bookingNetwork").value
                };
                const json = await fetchPilotJson("/bookings", {}, { method: "POST", body });
                bookingsData = null;
                return json;
            });
        }

        async function loadSimbrief() {
            await runDispatchAction(async () => {
                const id = requiredInt("dispatchBookingId", "Booking ID");
                return await fetchPilotJson(`/bookings/${id}/simbrief`);
            });
        }

        async function filePirep() {
            await runDispatchAction(async () => {
                const id = requiredInt("pirepBookingId", "Booking ID");
                const body = {
                    departure_time: requiredDate("pirepDepartureTime", "Actual departure"),
                    arrival_time: requiredDate("pirepArrivalTime", "Actual arrival"),
                    points: requiredInt("pirepPoints", "Points"),
                    redirect_url: null
                };
                const json = await fetchPilotJson(`/bookings/${id}/pirep`, {}, { method: "POST", body });
                bookingsData = null;
                pirepsData = null;
                return json;
            });
        }

        async function sendPirepComment() {
            await runDispatchAction(async () => {
                const id = requiredInt("commentPirepId", "PIREP ID");
                const content = document.getElementById("commentContent").value.trim();
                if (!content) throw new Error("Comment is required.");
                return await fetchPilotJson(`/pireps/${id}/comments`, {}, { method: "POST", body: { content } });
            });
        }

        async function runDispatchAction(action) {
            const resultBox = document.getElementById("dispatchResult");
            resultBox.textContent = "SENDING REQUEST...";
            try {
                const result = await action();
                resultBox.textContent = JSON.stringify(result.data ?? result, null, 2);
            } catch (err) {
                resultBox.innerHTML = `<span class="error">${escapeHtml(err.message)}</span>`;
            }
        }

        function requiredInt(id, label) {
            const value = Number.parseInt(document.getElementById(id).value, 10);
            if (!Number.isFinite(value)) throw new Error(`${label} is required.`);
            return value;
        }

        function requiredDate(id, label) {
            const value = document.getElementById(id).value;
            if (!value) throw new Error(`${label} is required.`);
            return new Date(value).toISOString();
        }
        function renderFlightList(list, emptyMessage, isPirep = false) {
            if (!Array.isArray(list) || list.length === 0) {
                return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
            }

            return list.map((flight) => {
                const title = `${formatValue(flight.flight_number, "Flight")} ${formatValue(flight.callsign, "")}`.trim();
                const status = flight.status || flight.type || (isPirep ? "PIREP" : "Booking");
                return `
                    <article class="item">
                        <div class="item-title">
                            <span>${escapeHtml(title)}</span>
                            <span class="pill">${escapeHtml(status)}</span>
                        </div>
                        <div class="meta">
                            <span>From: ${escapeHtml(formatValue(flight.departure_icao || flight.departure_id))}</span>
                            <span>To: ${escapeHtml(formatValue(flight.arrival_icao || flight.arrival_id))}</span>
                            <span>Network: ${escapeHtml(formatValue(flight.network))}</span>
                            <span>Dep: ${escapeHtml(formatDate(flight.departure_time))}</span>
                            <span>Arr: ${escapeHtml(formatDate(flight.arrival_time))}</span>
                            <span>ID: ${escapeHtml(formatValue(flight.id))}</span>
                        </div>
                    </article>
                `;
            }).join("");
        }

        function buildName(user) {
            return `${formatValue(user.first_name, "")} ${formatValue(user.last_name, "")}`.trim() || user.name || "";
        }

        function getRank() {
            return rankData?.name || profileData?.rank?.name || pilotData?.rank?.name || pilotData?.rank_name || "N/A";
        }

        function getFlightTime() {
            const value = statisticsData?.flight_time_all_time?.formatted
                || statisticsData?.flight_time_all_time?.seconds
                || profileData?.flight_time
                || pilotData?.stats?.flight_time
                || pilotData?.total_flight_time;
            if (!value && value !== 0) return "N/A";
            if (typeof value === "number") {
                const totalMinutes = Math.floor(value / 60);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                return `${hours}h ${minutes}m`;
            }
            return value;
        }

        function formatValue(value, fallback = "N/A") {
            return value === undefined || value === null || value === "" ? fallback : value;
        }

        function formatDate(value) {
            if (!value) return "N/A";
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
        }

        function escapeHtml(value) {
            return String(formatValue(value, ""))
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        async function logout() {
            try { await fetch("/api/aoc-proxy?path=/api/auth/local/logout", { method: "POST" }); } catch (_) {}
            localStorage.removeItem("legacy_pilot_token");
            window.location.href = "index.html";
        }

