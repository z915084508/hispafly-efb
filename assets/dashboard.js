const API_ROOT = "https://vamsys.io/api/v3/pilot";
        let accessToken = localStorage.getItem("vamsys_token");
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

        if (!accessToken) {
            window.location.href = "index.html";
        }

        const authHeader = {
            "Authorization": `Bearer ${accessToken}`,
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
                subhead: "Charts and dictionary",
                icon: "assets/app-icons/dictionary.svg",
                apps: [
                    { view: "dictionary", label: "Dictionary", subhead: "Pilot terminology", icon: "assets/app-icons/dictionary.svg" }
                ]
            },
            { view: "telex", label: "TELEX", subhead: "Hoppie ACARS", icon: "assets/app-icons/telex.png" },
            { view: "cdmAirport", label: "CDM Airport", subhead: "Airport queue", icon: "assets/app-icons/cdm-airport.png" },
            { view: "liveMap", label: "Live Map", subhead: "VAMSYS live ops", icon: "assets/app-icons/live-map.png" }
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
            await setView("home");
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
                liveMap: ["Live Ops", "Live Flight Map", "Real-time VAMSYS active flight positions."]
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
            const url = new URL(`${API_ROOT}${path}`);
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
                throw new Error(`VAMSYS returned non-JSON for ${path} (HTTP ${res.status}): ${preview}`);
            }

            if (!res.ok) {
                const msg = json.message || json.error || JSON.stringify(json).slice(0, 180);
                throw new Error(`VAMSYS ${path} failed (HTTP ${res.status}): ${msg}`);
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

        function logout() {
            localStorage.removeItem("vamsys_token");
            sessionStorage.removeItem("pkce_v");
            sessionStorage.removeItem("pkce_s");
            sessionStorage.removeItem("oauth_redirect_uri");
            localStorage.removeItem("pkce_v");
            localStorage.removeItem("pkce_s");
            localStorage.removeItem("oauth_redirect_uri");
            window.location.href = "index.html";
        }

