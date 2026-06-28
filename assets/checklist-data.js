window.HISPAFLY_CHECKLISTS = {
    id: "hispafly-fleet-v2",
    notice: "SIMULATOR USE ONLY — Training baseline; not a controlled FCOM/QRH copy. Aircraft configuration and operator-approved procedures always take precedence.",
    aircraft: [
        {
            id: "b737-800",
            title: "BOEING 737-800",
            subtitle: "737 NG normal-procedures training baseline",
            manual: "Boeing 737 NG FCOM / QRH framework",
            phases: [
                { id: "preflight", name: "Preflight", items: [["Battery switch", "ON"], ["Standby power", "AUTO"], ["Emergency exit lights", "ARMED"], ["IRS mode selectors", "NAV"], ["Flight instruments", "CHECKED"], ["Takeoff data", "SET"]] },
                { id: "before-start", name: "Before Start", items: [["Flight deck door", "CLOSED / LOCKED"], ["Passenger signs", "ON"], ["Windows", "LOCKED"], ["MCP", "SET"], ["Takeoff briefing", "COMPLETE"], ["Doors", "CLOSED"]] },
                { id: "before-taxi", name: "Before Taxi", items: [["Generators", "ON"], ["Probe heat", "ON"], ["Anti-ice", "AS REQUIRED"], ["Isolation valve", "AUTO"], ["Engine start switches", "CONT"], ["Recall", "CHECKED"]] },
                { id: "before-takeoff", name: "Before Takeoff", items: [["Flaps", "SET"], ["Stabilizer trim", "SET"], ["Flight controls", "CHECKED"], ["Cabin", "SECURE"], ["Transponder", "TA / RA"], ["Takeoff configuration", "CHECKED"]] },
                { id: "after-takeoff", name: "After Takeoff", items: [["Engine bleeds", "ON"], ["Packs", "AUTO"], ["Landing gear", "UP / OFF"], ["Flaps", "UP"], ["Exterior lights", "SET"]] },
                { id: "descent", name: "Descent", items: [["Pressurization", "LAND ALT SET"], ["Recall", "CHECKED"], ["Autobrake", "SET"], ["Landing data", "VREF / MINIMUMS SET"], ["Approach briefing", "COMPLETE"]] },
                { id: "approach", name: "Approach", items: [["Altimeters", "SET"], ["Approach aids", "SET / IDENTIFIED"], ["Minimums", "SET"], ["Seat belt signs", "ON"]] },
                { id: "landing", name: "Landing", items: [["Engine start switches", "CONT"], ["Speedbrake", "ARMED"], ["Landing gear", "DOWN"], ["Flaps", "LANDING"], ["Cabin", "SECURE"]] },
                { id: "after-landing", name: "After Landing", items: [["Flaps", "UP"], ["Speedbrake", "DOWN"], ["Probe heat", "OFF"], ["Landing lights", "OFF"], ["APU", "AS REQUIRED"], ["Transponder", "SET"]] },
                { id: "shutdown", name: "Shutdown", items: [["Parking brake", "SET / CHOCKS"], ["Fuel control switches", "CUTOFF"], ["Passenger signs", "OFF"], ["Fuel pumps", "OFF"], ["Probe heat", "OFF"], ["Anti-collision light", "OFF"]] },
                { id: "secure", name: "Secure", items: [["IRS mode selectors", "OFF"], ["Emergency exit lights", "OFF"], ["Air conditioning packs", "OFF"], ["Battery switch", "OFF"]] }
            ]
        },
        {
            id: "a320-family",
            title: "AIRBUS A320 FAMILY",
            subtitle: "A318/A319/A320/A321 normal procedures",
            manual: "Airbus FCOM PRO-NOR",
            source: "CQH R7 · Revision 30 MAY 2012 · configuration-dependent items simplified",
            phases: [
                { id: "cockpit-prep", name: "Cockpit Preparation", items: [["Aircraft power", "ESTABLISHED"], ["ADIRS", "NAV"], ["Emergency equipment", "CHECKED"], ["Oxygen", "CHECKED"], ["FMGS", "INITIALIZED"], ["Takeoff data", "INSERTED"]] },
                { id: "before-start", name: "Before Pushback / Start", items: [["Loadsheet", "CHECKED"], ["Takeoff data", "PREPARED / CHECKED"], ["Seats, belts and pedals", "ADJUSTED"], ["MCDU", "TAKEOFF CONFIGURATION"], ["Cockpit preparation", "COMPLETE"], ["Windows and doors", "CLOSED"], ["Beacon", "ON"]] },
                { id: "after-start", name: "After Start", items: [["ENG MODE selector", "NORM"], ["APU BLEED", "OFF"], ["Engine anti-ice", "AS REQUIRED"], ["ECAM status", "CHECKED"], ["Pitch trim", "SET"], ["Rudder trim", "ZERO"], ["Flight controls", "CHECKED"], ["Flaps", "SET"]] },
                { id: "before-takeoff", name: "Before Takeoff", items: [["Takeoff / line-up clearance", "OBTAINED"], ["TCAS", "TA / TA-RA"], ["Approach path", "CLEAR OF TRAFFIC"], ["Packs 1 and 2", "AS REQUIRED"], ["Exterior lights", "SET"], ["Takeoff runway", "CONFIRMED"]] },
                { id: "after-takeoff", name: "After Takeoff", items: [["APU BLEED", "AS REQUIRED"], ["APU MASTER", "AS REQUIRED"], ["ENG MODE selector", "AS REQUIRED"], ["TCAS", "TA / RA"], ["Anti-ice", "AS REQUIRED"], ["After takeoff / climb checklist", "COMPLETE"]] },
                { id: "descent-prep", name: "Descent Preparation", items: [["Landing elevation", "CHECKED"], ["Weather and landing information", "OBTAINED"], ["Landing performance", "CONFIRMED"], ["ARRIVAL page", "COMPLETE / CHECKED"], ["Flight plan A page", "CHECKED"], ["Descent winds", "CHECKED"], ["PERF CRUISE page", "CHECKED"], ["Approach briefing", "COMPLETE"]] },
                { id: "approach", name: "Approach", items: [["Seat belt signs", "ON"], ["Barometric reference", "SET"], ["Landing data", "CONFIRMED"], ["ECAM status", "CHECKED"]] },
                { id: "landing", name: "Landing", items: [["Cabin", "SECURE"], ["Autothrust", "SPEED / OFF AS REQUIRED"], ["Landing gear", "DOWN"], ["Flaps", "LANDING"], ["Ground spoilers", "ARMED"], ["Autobrake", "SET"]] },
                { id: "after-landing", name: "After Landing", items: [["Landing lights", "RETRACTED"], ["Strobe selector", "AUTO"], ["Other exterior lights", "AS REQUIRED"], ["Ground spoilers", "DISARMED"], ["Radar", "OFF / STBY"], ["Predictive windshear", "OFF"], ["ENG MODE selector", "NORM"], ["Flaps", "RETRACTED"], ["TCAS", "STANDBY"]] },
                { id: "parking", name: "Parking", items: [["Parking brake accumulator", "CHECKED"], ["Parking brake", "ON"], ["Anti-ice", "OFF"], ["APU BLEED", "ON"], ["Engine master 1 and 2", "OFF"], ["Ground contact", "ESTABLISHED"], ["Chocks", "IN PLACE"]] },
                { id: "securing", name: "Securing Aircraft", items: [["Parking brake", "CHECK ON"], ["Crew oxygen supply", "OFF"], ["ADIRS 1, 2 and 3", "OFF"], ["Exterior lights", "OFF"], ["Electrical supply", "OFF AFTER ADIRS DELAY"]] }
            ]
        },
        {
            id: "crj-700-900",
            title: "CRJ 700 / 900",
            subtitle: "CRJ Series normal-procedures training baseline",
            manual: "MHI RJ Aviation CRJ FCOM / QRH framework",
            phases: [
                { id: "safety-check", name: "Safety Check", items: [["Landing gear lever", "DOWN"], ["Flap lever", "AGREES WITH POSITION"], ["Radar", "OFF"], ["Battery master", "ON"], ["Fire detection", "CHECKED"]] },
                { id: "originating", name: "Originating / Receiving", items: [["Electrical power", "ESTABLISHED"], ["IRS", "ALIGNED"], ["Hydraulic pumps", "OFF / AUTO"], ["Fuel quantity", "CHECKED"], ["FMS", "INITIALIZED"], ["Takeoff data", "SET"]] },
                { id: "before-start", name: "Before Start", items: [["Passenger signs", "ON"], ["Doors", "CLOSED"], ["Beacon", "ON"], ["Parking brake", "SET"], ["Thrust levers", "SHUTOFF"], ["Start clearance", "OBTAINED"]] },
                { id: "after-start", name: "After Start", items: [["Generators", "ON"], ["Bleeds", "CONFIGURED"], ["Anti-ice", "AS REQUIRED"], ["Hydraulic pumps", "ON / AUTO"], ["Flaps", "SET"], ["Flight controls", "CHECKED"]] },
                { id: "before-takeoff", name: "Before Takeoff", items: [["Takeoff data", "CONFIRMED"], ["Trim", "SET"], ["Flight instruments", "CHECKED"], ["Cabin", "SECURE"], ["Transponder", "TA / RA"], ["Takeoff configuration", "CHECKED"]] },
                { id: "after-takeoff", name: "After Takeoff", items: [["Landing gear", "UP"], ["Flaps", "UP"], ["Thrust reversers", "STOWED"], ["Bleeds", "CHECKED"], ["Exterior lights", "SET"]] },
                { id: "descent", name: "Descent", items: [["Pressurization", "SET"], ["Landing data", "COMPUTED"], ["Approach briefing", "COMPLETE"], ["Minimums", "SET"], ["Passenger signs", "ON"]] },
                { id: "approach", name: "Approach", items: [["Altimeters", "SET"], ["Approach aids", "SET"], ["Landing data", "CONFIRMED"], ["Hydraulic pressure", "CHECKED"]] },
                { id: "before-landing", name: "Before Landing", items: [["Landing gear", "DOWN"], ["Flaps", "LANDING"], ["Spoilers", "ARMED"], ["Cabin", "SECURE"], ["Landing lights", "ON"]] },
                { id: "after-landing", name: "After Landing", items: [["Flaps", "UP"], ["Spoilers", "RETRACTED"], ["Anti-ice", "AS REQUIRED"], ["APU", "AS REQUIRED"], ["Radar", "OFF"], ["Transponder", "SET"]] },
                { id: "shutdown", name: "Shutdown", items: [["Parking brake", "SET / CHOCKS"], ["Thrust levers", "SHUTOFF"], ["Beacon", "OFF"], ["Fuel pumps", "OFF"], ["Hydraulic pumps", "OFF"], ["Passenger signs", "OFF"]] },
                { id: "securing", name: "Securing", items: [["IRS", "OFF"], ["Emergency lights", "OFF"], ["APU", "OFF"], ["Battery master", "OFF"]] }
            ]
        },
        {
            id: "atr72-600",
            title: "ATR 72-600",
            subtitle: "ATR -600 normal-procedures training baseline",
            manual: "ATR 42/72-600 FCOM / electronic checklist framework",
            phases: [
                { id: "preliminary", name: "Preliminary Cockpit Prep", items: [["Landing gear handle", "DOWN"], ["Power levers", "GROUND IDLE"], ["Condition levers", "FUEL SHUTOFF"], ["Flaps", "AGREES WITH INDICATOR"], ["Battery", "ON"]] },
                { id: "cockpit-prep", name: "Cockpit Preparation", items: [["Electrical power", "ESTABLISHED"], ["Emergency equipment", "CHECKED"], ["Fuel quantity", "CHECKED"], ["FMS", "INITIALIZED"], ["Takeoff data", "SET"], ["Briefing", "COMPLETE"]] },
                { id: "before-start", name: "Before Engine Start", items: [["Doors", "CLOSED"], ["Parking brake", "SET"], ["Propeller area", "CLEAR"], ["Beacon", "ON"], ["Fuel pumps", "ON / AUTO"], ["Start clearance", "OBTAINED"]] },
                { id: "after-start", name: "After Engine Start", items: [["Generators", "ON"], ["Bleeds", "SET"], ["Propeller brake", "AS REQUIRED"], ["Anti-ice", "AS REQUIRED"], ["Flight controls", "CHECKED"], ["Flaps", "SET"]] },
                { id: "before-takeoff", name: "Before Takeoff", items: [["Condition levers", "100% OVRD"], ["Takeoff data", "CONFIRMED"], ["Trim", "SET"], ["Cabin", "SECURE"], ["Transponder", "TA / RA"], ["Takeoff configuration", "CHECKED"]] },
                { id: "after-takeoff", name: "After Takeoff", items: [["Landing gear", "UP"], ["Flaps", "UP"], ["Condition levers", "AUTO"], ["Bleeds", "CHECKED"], ["Exterior lights", "SET"]] },
                { id: "descent", name: "Descent", items: [["Landing information", "RECEIVED"], ["Landing performance", "COMPUTED"], ["Approach briefing", "COMPLETE"], ["Minimums", "SET"], ["Passenger signs", "ON"]] },
                { id: "approach", name: "Approach", items: [["Altimeters", "SET"], ["Approach aids", "SET / IDENTIFIED"], ["Landing data", "CONFIRMED"], ["Anti-ice", "AS REQUIRED"]] },
                { id: "before-landing", name: "Before Landing", items: [["Landing gear", "DOWN"], ["Flaps", "LANDING"], ["Condition levers", "100% OVRD"], ["Cabin", "SECURE"], ["Landing lights", "ON"]] },
                { id: "after-landing", name: "After Landing", items: [["Flaps", "UP"], ["Condition levers", "AUTO"], ["Probe heat", "OFF"], ["Landing lights", "OFF"], ["Transponder", "SET"]] },
                { id: "parking", name: "Parking", items: [["Parking brake", "SET / CHOCKS"], ["Condition levers", "FUEL SHUTOFF"], ["Beacon", "OFF"], ["Fuel pumps", "OFF"], ["Passenger signs", "OFF"]] },
                { id: "leaving", name: "Leaving Aircraft", items: [["Emergency lights", "OFF"], ["External lights", "OFF"], ["Electrical sources", "OFF"], ["Battery", "OFF"]] }
            ]
        }
    ]
};
