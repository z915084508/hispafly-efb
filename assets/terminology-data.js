(function () {
    const sourceLinks = {
        "VATSIM Spain": "https://vatsimspain.es/",
        "VATSIM Spain Biblioteca": "https://biblioteca.vatsimspain.es/",
        "VATSIM": "https://vatsim.net/docs/policy/code-of-conduct/",
        "EUROCONTROL / SKYbrary": "https://skybrary.aero/",
        "ENAIRE / AIP Spain": "https://aip.enaire.es/"
    };

    const groups = [
        {
            category: "VATSIM Spain",
            sourceGroup: "VATSIM Spain",
            terms: "VATSPA,vACC Spain,VATSIM Spain,Biblioteca,Dashboard,EVA Escuela Virtual,Discord,Controller booking,Active controllers,Event briefing,CPT,Solo validation,Visiting controller,Spanish vACC,LECM,LECB,LECS,GCCC,Madrid Control,Barcelona Control,Canarias Control,Sevilla Control,Palma TACC,LEMD Madrid,LEBL Barcelona,LEPA Palma,LEMG Malaga,LEVC Valencia,LEAL Alicante,LEZL Sevilla,GCLP Gran Canaria,GCTS Tenerife Sur,GCXO Tenerife Norte,GCRR Lanzarote,GCFV Fuerteventura,LEBB Bilbao,LEST Santiago,LEXJ Santander,LESO San Sebastian,LEAS Asturias,LECO A Coruna,LEJR Jerez,LEIB Ibiza,LEMH Menorca,LEAM Almeria,LEGR Granada,LERS Reus,LEVT Vitoria,LEXJ Approach,LEMD Ground,LEBL Tower"
        },
        {
            category: "VATSIM Network",
            sourceGroup: "VATSIM",
            terms: "UNICOM,Top-down control,Contact me,Private message,Supervisor,Observer,Text only,Receive only,Full voice,Approved client,vPilot,xPilot,swift,Audio for VATSIM,AFV,Flight plan,CID,Callsign,Real name policy,Software approval,Network disconnect,Unattended connection,Pause on network,Time acceleration,Shared cockpit,Formation flight,Emergency on VATSIM,Guard 121.500,Operational frequency,Non-operational chat,Conduct,Code of Conduct,Code of Regulations,User agreement,New member orientation,Pilot rating,P0 Basic User,P1 Private Pilot,P2 Instrument Rating,ATC rating,S1 Delivery Ground,S2 Tower,S3 Approach,C1 Controller,Wallop,Staff connection,Network map,VATSIM Radar,SimBrief prefile,Controller ATIS,ATC coverage,Unstaffed airspace"
        },
        {
            category: "ATC Phraseology",
            sourceGroup: "VATSIM Spain Biblioteca",
            terms: "Clearance,IFR clearance,Readback,Readback correct,Say again,Standby,Unable,Wilco,Roger,Affirm,Negative,Monitor,Contact,Tune,Report,Advise,Confirm,Correction,Disregard,Hold position,Give way,Pushback approved,Startup approved,Taxi clearance,Taxi via,Hold short,Cross runway,Line up and wait,Cleared for takeoff,Takeoff clearance,Cancel takeoff clearance,Stop immediately,After departure,Climb via SID,Descend via STAR,Maintain altitude,Maintain flight level,Turn left heading,Turn right heading,Proceed direct,Resume own navigation,Expect vectors,Speed restriction,Reduce speed,Increase speed,No speed restriction,Report established,Cleared approach,Cleared ILS approach,Cleared visual approach"
        },
        {
            category: "IFR Operations",
            sourceGroup: "ENAIRE / AIP Spain",
            terms: "SID,STAR,Transition,Transition altitude,Transition level,Flight level,Altitude,Initial climb,Cruise level,Route,Airway,Waypoint,Direct to,Vectoring,Holding pattern,Hold entry,Published hold,Approach clearance,ILS,RNAV approach,RNP approach,VOR approach,NDB approach,Localizer,Glideslope,Final approach,Intermediate approach,Initial approach fix,Final approach fix,Missed approach,Go-around,Visual approach,Circling approach,Minimums,Decision altitude,Decision height,MDA,MAPt,Stabilised approach,Intercept localizer,Established,Cleared to land,Landing clearance,Vacate runway,Runway vacated,Backtrack,Intersection departure,Reduced runway separation,Low visibility procedures,LVP,Runway configuration"
        },
        {
            category: "Spain Airspace",
            sourceGroup: "ENAIRE / AIP Spain",
            terms: "FIR,UIR,TMA,CTR,ATZ,CTA,Control zone,Controlled airspace,Uncontrolled airspace,Restricted area,Danger area,Prohibited area,Temporary reserved area,Military area,Class A airspace,Class C airspace,Class D airspace,Class E airspace,Class G airspace,Upper airspace,Lower airspace,Sector,Subsector,Route sector,Terminal sector,Approach sector,Tower area,Apron,Stand,Gate,Ramp,Taxiway,Runway,Threshold,Stop bar,Holding point,Intermediate holding point,Hot spot,Apron management,Ground movement,Surface movement,ATIS,Clearance delivery,Ground control,Tower control,Approach control,Area control,Oceanic airspace,Canary Islands FIR"
        },
        {
            category: "EUROCONTROL / SKYbrary",
            sourceGroup: "EUROCONTROL / SKYbrary",
            terms: "ATFCM,CTOT,EOBT,TOBT,TSAT,Slot,Slot tolerance window,Regulation,Flow control,Network Manager,Ground delay,Ground stop,Calculated takeoff time,Estimated off-block time,Airport CDM,A-CDM,Departure sequence,Runway capacity,Arrival manager,AMAN,Departure manager,DMAN,Traffic complexity,Sector capacity,Level bust,Airspace infringement,Runway incursion,Runway excursion,Loss of separation,Separation minima,Wake turbulence,Wake vortex,TCAS,TCAS RA,Resolution advisory,Traffic advisory,CFIT,Controlled flight into terrain,Unstable approach,Approach ban,Go-around safety,Rejected takeoff,Runway occupancy time,Hot spot,Stop bar violation,Mode S,SSR,Primary radar,Secondary radar"
        },
        {
            category: "Weather",
            sourceGroup: "EUROCONTROL / SKYbrary",
            terms: "METAR,TAF,TAFOR,SPECI,CAVOK,QNH,QFE,Altimeter setting,Wind shear,Microburst,Turbulence,Severe turbulence,Moderate turbulence,Light turbulence,Ceiling,Visibility,RVR,Runway visual range,Cloud base,FEW,SCT,BKN,OVC,CB,TCU,Thunderstorm,TSRA,SHRA,DZ,FG,BR,HZ,SN,GR,RA,VCSH,VCTS,Temperature,Dew point,Icing,Freezing level,Freezing rain,Crosswind,Tailwind,Headwind,Gust,Variable wind,Wind calm,Low visibility,LLWS,Convective weather,Volcanic ash,SIGMET,AIRMET"
        },
        {
            category: "CPDLC / Hoppie",
            sourceGroup: "VATSIM Spain Biblioteca",
            terms: "CPDLC,Hoppie,Logon,Logon code,Telex,Free text,Pre-departure clearance,PDC,Oceanic clearance,Datalink,ACARS,Message uplink,Message downlink,Standby message,Unable message,Wilco message,Roger message,Request clearance,Request level,Request direct,Request weather,Request METAR,Request TAF,Atis request,Station logon,Current data authority,Next data authority,Transfer of communications,Voice fallback,Message latency,Clearance readback,CPDLC route clearance,Departure clearance,Climb request,Descent request,Speed request,Heading request,Offset request,Level change,At time,At position,When ready,Due to weather,Due to traffic,Due to performance,Unable due performance,Emergency message,Cancel request,End service"
        },
        {
            category: "Airport Operations",
            sourceGroup: "VATSIM Spain Biblioteca",
            terms: "Pushback,Startup,Engine start,Beacon on,Taxi out,Taxi in,Stand allocation,Parking stand,Remote stand,Jet bridge,Apron entry,Apron exit,Marshaller,Follow me,Ground handling,Deicing,Anti-icing,Runway holding point,Line-up,Rolling takeoff,Static takeoff,Rejected takeoff,Takeoff roll,Rotation,Initial climb,Noise abatement,Intersection takeoff,Backtrack runway,Runway crossing,Runway vacating,Rapid exit taxiway,High speed exit,Taxi route,Progressive taxi,Low visibility taxi,Stop bar crossing,Runway inspection,Runway change,Runway in use,Departure runway,Arrival runway,Final traffic,Base leg,Downwind,Circuit,Traffic pattern,Visual circuit,Straight-in approach,Short final,Long final"
        },
        {
            category: "Navigation",
            sourceGroup: "ENAIRE / AIP Spain",
            terms: "VOR,DME,NDB,ADF,ILS CAT I,ILS CAT II,ILS CAT III,RNAV,RNP,PBN,GNSS,GPS,INS,IRS,FMS,FMC,Magnetic heading,True heading,Track,Bearing,Radial,Course,Inbound course,Outbound course,Cross-track error,Distance to go,Top of descent,Top of climb,Step climb,Step descent,Minimum sector altitude,MSA,MEA,MORA,Grid MORA,Safe altitude,Obstacle clearance,Procedure turn,Base turn,Racetrack,Arc,DME arc,Final approach course,Missed approach point,Navigation database,AIRAC,Chart cycle,Waypoint overfly,Fly-by waypoint,Speed limit,Altitude constraint,Path terminator"
        }
    ];

    function parseTerm(raw) {
        const [term, fullName] = raw.split("|");
        return { term: term.trim(), fullName: (fullName || "").trim() };
    }

    function makeDefinition(term, category) {
        const lower = category.toLowerCase();
        if (category === "VATSIM Spain") return `${term} is a VATSIM Spain reference used when flying, planning, or communicating in Spanish virtual airspace.`;
        if (category === "VATSIM Network") return `${term} is a VATSIM network concept pilots should understand before connecting or operating online.`;
        if (category === "ATC Phraseology") return `${term} is a radio phrase or instruction used to keep pilot and controller communication short and unambiguous.`;
        if (category === "IFR Operations") return `${term} is an IFR procedure or clearance item commonly encountered during online instrument flights.`;
        if (category === "Spain Airspace") return `${term} describes an airspace, sector, or operating area relevant to Spanish flight operations.`;
        if (category === "EUROCONTROL / SKYbrary") return `${term} is an operational, safety, or flow-management concept used in European aviation context.`;
        if (category === "Weather") return `${term} is a weather term pilots use to interpret METAR, TAF, radar, and operational conditions.`;
        if (category === "CPDLC / Hoppie") return `${term} is a datalink or telex concept used for text-based operational messages.`;
        if (category === "Airport Operations") return `${term} is an airport movement or runway-operation term used from stand to airborne or after landing.`;
        return `${term} is a ${lower} term useful for VATSIM Spain pilot operations.`;
    }

    function makeSpanish(term, category) {
        if (category === "ATC Phraseology") return `Frase o instruccion que el piloto debe entender y colacionar correctamente cuando proceda.`;
        if (category === "Weather") return `Termino meteorologico usado para interpretar condiciones reales durante el vuelo online.`;
        if (category === "EUROCONTROL / SKYbrary") return `Concepto operacional o de seguridad frecuente en el entorno europeo.`;
        if (category === "VATSIM Spain") return `Referencia especifica para pilotos que vuelan en la comunidad y el espacio aereo virtual de Espana.`;
        return `Concepto util para operaciones de pilotos en VATSIM Spain.`;
    }

    function makeUse(term, category) {
        if (category === "VATSIM Spain") return `Use it to understand local Spain vACC procedures, controller names, airport briefings, or event instructions.`;
        if (category === "VATSIM Network") return `Use it to operate correctly on the VATSIM network and avoid disrupting active ATC or nearby traffic.`;
        if (category === "ATC Phraseology") return `Listen for it on frequency, act only when the clearance or instruction applies to your callsign, and read back safety-critical items.`;
        if (category === "IFR Operations") return `Check charts and your FMS before accepting or flying this item under Spanish or European ATC.`;
        if (category === "Spain Airspace") return `Use it to decide which controller to call and what airspace or airport area you are entering.`;
        if (category === "EUROCONTROL / SKYbrary") return `During events or busy traffic, this helps interpret flow, safety, and operational constraints.`;
        if (category === "Weather") return `Use it during preflight, approach planning, and when comparing simulator weather with current real-world conditions.`;
        if (category === "CPDLC / Hoppie") return `Use it when sending or receiving Hoppie/CPDLC style telex messages in supported online operations.`;
        if (category === "Airport Operations") return `Use it on delivery, ground, tower, and apron frequencies while moving around Spanish airports.`;
        return `Use it as quick reference before transmitting or accepting an instruction.`;
    }

    function makeExample(term, category) {
        if (category === "ATC Phraseology") return `"${term}, HSP123."`;
        if (category === "Weather") return `Check ${term} before departure and before approach briefing.`;
        if (category === "CPDLC / Hoppie") return `HSP123: ${term}.`;
        if (category === "Airport Operations") return `HSP123, ${term.toLowerCase()} as instructed.`;
        if (category === "VATSIM Spain") return `HSP123 operating with ${term} information available.`;
        return `Review ${term} before flying in busy VATSIM Spain airspace.`;
    }

    window.HPF_TERMINOLOGY_ENTRIES = groups.flatMap((group) => group.terms.split(",").map((raw) => {
        const parsed = parseTerm(raw);
        return {
            term: parsed.term,
            fullName: parsed.fullName,
            category: group.category,
            sourceGroup: group.sourceGroup,
            sourceUrl: sourceLinks[group.sourceGroup],
            definition: makeDefinition(parsed.term, group.category),
            spanish: makeSpanish(parsed.term, group.category),
            vatsimUse: makeUse(parsed.term, group.category),
            example: makeExample(parsed.term, group.category),
            related: [],
            tags: [group.category.toLowerCase(), group.sourceGroup.toLowerCase(), parsed.term.toLowerCase()]
        };
    })).slice(0, 500);
})();
