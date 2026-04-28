const historicalDisasters = [
    // === MAJOR DISASTERS ===
    {
        id: "H001",
        event: "2018 Kerala South Floods",
        description: "Catastrophic flooding due to unusually high rainfall. Over 1 million evacuated. Landslides destroyed primary highway routes.",
        lessonsLearned: "Ground vehicles failed due to landslides. Aerial supply drops of medical kits and high-ground shelters were the only viable lifeline during the first 72 hours."
    },
    {
        id: "H002",
        event: "2021 Cyclone Tauktae",
        description: "Severe cyclonic storm causing massive coastal devastation, extreme wind speeds up to 130 km/h, and widespread communication blackouts.",
        lessonsLearned: "Wind speeds grounded all aerial relief. Heavy reliance was placed on pre-positioned concrete shelters and fortified marine transport."
    },
    {
        id: "H003",
        event: "2004 Indian Ocean Tsunami",
        description: "Massive coastal waves obliterating coastal villages. Immediate extreme medical trauma and total loss of clean water.",
        lessonsLearned: "Immediate priority was emergency medical triage and mobile water purification units. Food was secondary to immediate life-saving trauma care and preventing waterborne diseases."
    },
    {
        id: "H004",
        event: "2023 North India Heatwave",
        description: "Unprecedented temperatures peaking at 49°C causing massive heatstroke casualties and grid blackouts.",
        lessonsLearned: "Mass transport of water and mobile cooling stations took absolute priority over standard food resupply. Night-time operations required due to daylight sun lethality."
    },
    // === EARTHQUAKE EVENTS ===
    {
        id: "H005",
        event: "2001 Gujarat Bhuj Earthquake",
        description: "Magnitude 7.7 earthquake destroying over 400,000 homes. 20,000 casualties. Total infrastructure collapse across Kutch region including hospitals and schools.",
        lessonsLearned: "Search and rescue within first 48 hours was critical. Heavy machinery for debris removal was bottlenecked. Prepositioned tents and temporary medical camps saved the most lives. Aftershock monitoring was essential before entering collapsed structures."
    },
    {
        id: "H006",
        event: "2015 Nepal-India Border Earthquake",
        description: "Magnitude 7.8 earthquake with severe impact on Bihar and Uttar Pradesh border regions. Thousands of mud-brick homes collapsed. Landslides blocked mountain access roads.",
        lessonsLearned: "Cross-border coordination with Nepal was essential. Helicopter-based rescue was the only viable option for mountain villages. Lightweight portable shelters outperformed heavy tents in remote terrain."
    },
    {
        id: "H007",
        event: "2005 Kashmir Earthquake",
        description: "Magnitude 7.6 earthquake in Jammu & Kashmir. Severe winter conditions compounded rescue challenges. Over 80,000 casualties across the region.",
        lessonsLearned: "Extreme cold weather required heated shelters and thermal blankets alongside medical supplies. Hypothermia killed more survivors than the earthquake itself in the first week. Winter-grade logistics are non-negotiable in mountain disaster zones."
    },
    // === FLOOD EVENTS ===
    {
        id: "H008",
        event: "2013 Uttarakhand Flash Floods (Kedarnath Disaster)",
        description: "Glacial lake outburst and cloudbursts caused devastating flash floods and landslides across Uttarakhand. Kedarnath temple area was obliterated. Over 5,700 confirmed dead.",
        lessonsLearned: "Pilgrimage sites became death traps with no evacuation routes. Helicopter rescue was the only extraction method. Pre-monsoon early warning systems and tourist evacuation drills are critical for religious tourism zones."
    },
    {
        id: "H009",
        event: "2015 Chennai Floods",
        description: "Record-breaking 494mm rainfall in a single day submerged Chennai. Airports shut down. 500+ deaths. Massive urban displacement.",
        lessonsLearned: "Urban drainage systems failed catastrophically. Boats became the primary transport for rescue. Digital communication networks collapsed — ham radio operators became the backbone of coordination. Pre-positioned inflatable boats in flood-prone cities are essential."
    },
    {
        id: "H010",
        event: "2020 Assam Annual Floods",
        description: "Brahmaputra river flooding displacing 5.5 million people across 30 districts. Recurring annual event destroying crops and livestock.",
        lessonsLearned: "Elevated bamboo shelters (chang ghars) outperformed government tents. Food and seed supply for post-flood agricultural recovery was as critical as immediate rescue. Recurring flood zones need permanent elevated infrastructure, not temporary relief."
    },
    {
        id: "H011",
        event: "2019 Karnataka-Maharashtra Floods",
        description: "Severe flooding across Western Ghats region affecting over 10 lakh people. 100+ deaths. Dam water releases worsened downstream flooding.",
        lessonsLearned: "Coordinated dam release schedules are essential to prevent compounding flood damage. Evacuation warnings must precede dam releases by minimum 12 hours. Community-level WhatsApp alert groups proved faster than official government warnings."
    },
    // === CYCLONE EVENTS ===
    {
        id: "H012",
        event: "1999 Odisha Super Cyclone",
        description: "Wind speeds of 260 km/h. 15,000+ casualties. 20-foot storm surge obliterated coastal Odisha. Worst natural disaster in Indian cyclone history.",
        lessonsLearned: "Post-1999, India built the world-class NDRF and cyclone shelter network. Lesson: permanent concrete cyclone shelters within 2km of every coastal village save exponentially more lives than post-disaster response."
    },
    {
        id: "H013",
        event: "2020 Cyclone Amphan",
        description: "Super cyclonic storm devastating West Bengal and Odisha coastline. Wind speeds up to 185 km/h. $13 billion in damages. Kolkata severely impacted.",
        lessonsLearned: "Early evacuation of 3 million people to cyclone shelters reduced casualties to under 100. Lesson validated: advance evacuation saves lives, but post-cyclone power restoration and tree clearance from roads must begin within hours, not days."
    },
    {
        id: "H014",
        event: "2023 Cyclone Biparjoy Gujarat",
        description: "Severe cyclone hitting Kutch and Saurashtra coastline with 150 km/h winds. Fishing communities severely impacted. Salt pan workers stranded.",
        lessonsLearned: "Fishing boat recall systems 72 hours before landfall saved thousands. Salt pan workers in remote areas needed specialized extraction. Livestock evacuation was neglected — post-storm livestock loss devastated rural economies for years."
    },
    // === LANDSLIDE EVENTS ===
    {
        id: "H015",
        event: "2024 Wayanad Landslides Kerala",
        description: "Massive landslides burying entire villages in Wayanad district. Over 400 deaths. Tea and coffee plantation workers trapped under debris.",
        lessonsLearned: "Seismic sensors and soil moisture monitoring could have provided 6-hour advance warning. Manual search with local volunteers was faster than waiting for heavy machinery in narrow plantation terrain. Community-based early warning saves more lives than centralized systems."
    },
    {
        id: "H016",
        event: "2014 Pune Malin Village Landslide",
        description: "Entire hilltop village of Malin buried under landslide debris at 3 AM while residents slept. 151 deaths.",
        lessonsLearned: "Night-time landslides are the deadliest because victims cannot self-evacuate. Settlements at the base of deforested hills must be permanently relocated. Real-time rain gauge alerts to mobile phones are the cheapest life-saving intervention."
    },
    // === INDUSTRIAL/URBAN DISASTERS ===
    {
        id: "H017",
        event: "2020 Vizag Gas Leak (LG Polymers)",
        description: "Styrene gas leak from chemical plant in residential area of Visakhapatnam. 12 deaths and 1,000+ hospitalized. Residents collapsed unconscious on streets.",
        lessonsLearned: "Chemical disaster response requires specialized HAZMAT teams, not standard medical responders. Immediate evacuation radius of 3km must be enforced. Wind direction monitoring determines evacuation corridor direction. Standard medical oxygen was insufficient — activated charcoal and chemical-specific antidotes were needed."
    },
    {
        id: "H018",
        event: "2021 Mumbai Building Collapse (Mahad)",
        description: "Multi-story residential building collapse in monsoon season. 39 deaths. Old deteriorated structures failed under heavy rain saturation.",
        lessonsLearned: "Pre-monsoon structural audits of old buildings save lives. NDRF dog squads detected buried survivors faster than thermal imaging in concrete rubble. Controlled demolition of adjacent weakened structures prevented secondary collapses during rescue."
    },
    // === DROUGHT/FAMINE EVENTS ===
    {
        id: "H019",
        event: "2016 Marathwada Drought Maharashtra",
        description: "Severe water crisis across 8 districts. Farmers lost entire crop yields. 852 farmer suicides recorded. Water trains deployed for the first time.",
        lessonsLearned: "Water tanker supply is unsustainable beyond 2 weeks. Bore-well drilling teams must be deployed alongside immediate relief. Psychological counseling and financial aid for farmers prevented further suicides. Agricultural seed banks for drought-resistant crops are critical post-drought."
    },
    // === FIRE EVENTS ===
    {
        id: "H020",
        event: "2023 Uttarakhand Forest Fires",
        description: "Massive forest fires across Kumaon and Garhwal divisions. 1,600+ hectares of forest destroyed. Wildlife displaced. Nearby villages choked with smoke.",
        lessonsLearned: "Aerial water bombing was effective only in accessible valleys — ground crews with firebreaks were essential in steep terrain. Smoke inhalation caused more hospital admissions than burns. N95 masks and portable oxygen concentrators should be standard issue in fire-adjacent villages."
    }
];

module.exports = { historicalDisasters };
