(function () {
    const sourceLinks = {
        "VATSIM Spain Biblioteca": "https://biblioteca.vatsimspain.es/",
        "VATSIM": "https://vatsim.net/docs/policy/code-of-conduct/",
        "EUROCONTROL / SKYbrary": "https://skybrary.aero/",
        "ENAIRE / AIP Spain": "https://aip.enaire.es/"
    };

    const groups = [
        {
            category: "Flight Operations",
            sourceGroup: "VATSIM Spain Biblioteca",
            terms: "Preflight briefing,Departure briefing,Approach briefing,Descent planning,Fuel planning,Alternate airport,Destination alternate,Takeoff performance,Landing performance,Flex temperature,Derated takeoff,Cost index,Payload,Zero fuel weight,Block fuel,Taxi fuel,Trip fuel,Contingency fuel,Final reserve fuel,Extra fuel,Minimum fuel,Mayday fuel,Flight release,Operational flight plan,Route validation,Navlog,Step climb,Optimum flight level,Maximum flight level,Cruise speed,Managed speed,Selected speed,Speed intervention,Altitude intervention,Heading select,LNAV,VNAV,Vertical speed,Flight director,Autopilot,Autothrottle,Flight mode annunciator,Stabilised criteria,Landing checklist,Before takeoff checklist,After landing checklist,Taxi checklist,Runway briefing,Rejected takeoff briefing"
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
        if (category === "Flight Operations") return `${term} is a cockpit or dispatch concept used to prepare, manage, or monitor a flight.`;
        if (category === "VATSIM Network") return `${term} is a VATSIM network concept pilots should understand before connecting or operating online.`;
        if (category === "ATC Phraseology") return `${term} is a radio phrase or instruction used to keep pilot and controller communication short and unambiguous.`;
        if (category === "IFR Operations") return `${term} is an IFR procedure or clearance item commonly encountered during online instrument flights.`;
        if (category === "Spain Airspace") return `${term} describes an airspace, sector, or operating area relevant to Spanish flight operations.`;
        if (category === "EUROCONTROL / SKYbrary") return `${term} is an operational, safety, or flow-management concept used in European aviation context.`;
        if (category === "Weather") return `${term} is a weather term pilots use to interpret METAR, TAF, radar, and operational conditions.`;
        if (category === "CPDLC / Hoppie") return `${term} is a datalink or telex concept used for text-based operational messages.`;
        if (category === "Airport Operations") return `${term} is an airport movement or runway-operation term used from stand to airborne or after landing.`;
        if (category === "Navigation") return `${term} is a navigation term used for route tracking, instrument procedures, or aircraft guidance.`;
        return `${term} is a ${lower} term useful for VATSIM Spain pilot operations.`;
    }

    function makeDefinitionEs(term, category) {
        if (category === "Flight Operations") return `${term} es un concepto de cabina u operaciones usado para preparar, gestionar o supervisar un vuelo.`;
        if (category === "VATSIM Network") return `${term} es un concepto de la red VATSIM que el piloto debe conocer antes de conectarse u operar online.`;
        if (category === "ATC Phraseology") return `${term} es una frase o instruccion radiotelefonica usada para que la comunicacion sea breve y clara.`;
        if (category === "IFR Operations") return `${term} es un procedimiento o elemento de autorizacion IFR frecuente durante vuelos instrumentales online.`;
        if (category === "Spain Airspace") return `${term} describe un espacio aereo, sector o area operativa relevante para volar en Espana.`;
        if (category === "EUROCONTROL / SKYbrary") return `${term} es un concepto operacional, de seguridad o gestion de afluencia usado en el entorno europeo.`;
        if (category === "Weather") return `${term} es un termino meteorologico usado para interpretar METAR, TAF, radar y condiciones operativas.`;
        if (category === "CPDLC / Hoppie") return `${term} es un concepto de enlace de datos o telex usado para mensajes operacionales por texto.`;
        if (category === "Airport Operations") return `${term} es un termino de movimiento aeroportuario o pista usado desde el puesto hasta el despegue o tras el aterrizaje.`;
        if (category === "Navigation") return `${term} es un termino de navegacion usado para seguimiento de ruta, procedimientos instrumentales o guiado del avion.`;
        return `${term} es un termino util para operaciones de pilotos en VATSIM Spain.`;
    }

    function makeUse(term, category) {
        if (category === "Flight Operations") return `Use it during flight preparation, cockpit setup, checklist flow, or operational decision-making.`;
        if (category === "VATSIM Network") return `Use it to operate correctly on the VATSIM network and avoid disrupting active ATC or nearby traffic.`;
        if (category === "ATC Phraseology") return `Listen for it on frequency, act only when the clearance or instruction applies to your callsign, and read back safety-critical items.`;
        if (category === "IFR Operations") return `Check charts and your FMS before accepting or flying this item under Spanish or European ATC.`;
        if (category === "Spain Airspace") return `Use it to decide which controller to call and what airspace or airport area you are entering.`;
        if (category === "EUROCONTROL / SKYbrary") return `During events or busy traffic, this helps interpret flow, safety, and operational constraints.`;
        if (category === "Weather") return `Use it during preflight, approach planning, and when comparing simulator weather with current real-world conditions.`;
        if (category === "CPDLC / Hoppie") return `Use it when sending or receiving Hoppie/CPDLC style telex messages in supported online operations.`;
        if (category === "Airport Operations") return `Use it on delivery, ground, tower, and apron frequencies while moving around Spanish airports.`;
        if (category === "Navigation") return `Use it when setting up the FMS, flying a route, briefing an approach, or complying with ATC navigation instructions.`;
        return `Use it as quick reference before transmitting or accepting an instruction.`;
    }

    function makeUseEs(term, category) {
        if (category === "Flight Operations") return `Usalo durante la preparacion del vuelo, configuracion de cabina, listas de comprobacion o toma de decisiones operativas.`;
        if (category === "VATSIM Network") return `Usalo para operar correctamente en VATSIM y evitar interferir con ATC activo u otro trafico.`;
        if (category === "ATC Phraseology") return `Escuchalo en frecuencia, actua solo si la autorizacion o instruccion es para tu indicativo y colaciona los elementos criticos.`;
        if (category === "IFR Operations") return `Comprueba cartas y FMS antes de aceptar o volar este elemento bajo ATC en Espana o Europa.`;
        if (category === "Spain Airspace") return `Usalo para saber a que dependencia llamar y que espacio aereo o area aeroportuaria estas entrando.`;
        if (category === "EUROCONTROL / SKYbrary") return `En eventos o trafico denso, ayuda a entender restricciones de flujo, seguridad y operacion.`;
        if (category === "Weather") return `Usalo en la preparacion, briefing de aproximacion y comparacion de la meteorologia del simulador con condiciones reales.`;
        if (category === "CPDLC / Hoppie") return `Usalo al enviar o recibir mensajes tipo Hoppie/CPDLC en operaciones online compatibles.`;
        if (category === "Airport Operations") return `Usalo en frecuencias de delivery, ground, tower y apron durante movimientos en aeropuertos espanoles.`;
        if (category === "Navigation") return `Usalo al configurar el FMS, volar una ruta, preparar una aproximacion o cumplir instrucciones de navegacion de ATC.`;
        return `Usalo como referencia rapida antes de transmitir o aceptar una instruccion.`;
    }

    function makeExample(term, category) {
        if (category === "ATC Phraseology") return `"${term}, HSP123."`;
        if (category === "Weather") return `Check ${term} before departure and before approach briefing.`;
        if (category === "CPDLC / Hoppie") return `HSP123: ${term}.`;
        if (category === "Airport Operations") return `HSP123, ${term.toLowerCase()} as instructed.`;
        if (category === "Flight Operations") return `Review ${term} during the cockpit briefing.`;
        if (category === "Navigation") return `Verify ${term} against the chart and FMS before flying the procedure.`;
        return `Review ${term} before flying in busy VATSIM Spain airspace.`;
    }

    function makeExampleEs(term, category) {
        if (category === "ATC Phraseology") return `"${term}, HSP123."`;
        if (category === "Weather") return `Comprueba ${term} antes de la salida y antes del briefing de aproximacion.`;
        if (category === "CPDLC / Hoppie") return `HSP123: ${term}.`;
        if (category === "Airport Operations") return `HSP123, ${term.toLowerCase()} segun instruccion.`;
        if (category === "Flight Operations") return `Revisa ${term} durante el briefing de cabina.`;
        if (category === "Navigation") return `Verifica ${term} con la carta y el FMS antes de volar el procedimiento.`;
        return `Revisa ${term} antes de volar en espacio aereo ocupado de VATSIM Spain.`;
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
            definitionEs: makeDefinitionEs(parsed.term, group.category),
            vatsimUse: makeUse(parsed.term, group.category),
            vatsimUseEs: makeUseEs(parsed.term, group.category),
            example: makeExample(parsed.term, group.category),
            exampleEs: makeExampleEs(parsed.term, group.category),
            related: [],
            tags: [group.category.toLowerCase(), group.sourceGroup.toLowerCase(), parsed.term.toLowerCase()]
        };
    })).slice(0, 500);
})();
