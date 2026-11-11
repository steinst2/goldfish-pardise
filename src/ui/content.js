/**
 * content.js — all student-facing text that teachers may want to edit:
 * investigations, NGSS mapping, knowledge checks and explanation panels.
 * (Plain data — no code changes are needed to revise the wording.)
 */

export const NGSS = {
  'HS-LS2-1': 'Use mathematical and/or computational representations to support explanations of factors that affect carrying capacity of ecosystems at different scales.',
  'HS-LS2-4': 'Use mathematical representations to support claims for the cycling of matter and flow of energy among organisms in an ecosystem.',
  'HS-LS2-5': 'Develop a model to illustrate the role of photosynthesis and cellular respiration in the cycling of carbon among the biosphere, atmosphere, hydrosphere, and geosphere.',
  'HS-LS2-7': 'Design, evaluate, and refine a solution for reducing the impacts of human activities on the environment and biodiversity.',
};

/** Specific activities in the app mapped to each standard (shown in the Science tab). */
export const NGSS_MAP = [
  { std: 'HS-LS2-1', activities: [
    'Investigation 1 — vary nutrient loading and light; use the limiting-factor readout (f_N, f_P, f_light) to explain what caps algal biomass.',
    'Investigation 2 — increase the number of fish until the tank can no longer support them; identify the oxygen and ammonia limits on carrying capacity.',
    'Lab — compare fish biomass curves under different aeration settings (a computational representation of carrying capacity).',
  ] },
  { std: 'HS-LS2-4', activities: [
    'Investigation 4 — compute the fish\'s growth efficiency and the share of algal energy that reaches fish from the energy budget; compare both with the ~10 % rule.',
    'Investigation 5 — use the nitrogen diagram (grams moved by each process) to show that nitrogen is conserved while it changes form.',
    'Lab — the mass-balance check shows inputs − exports = change in storage for N, P and C.',
  ] },
  { std: 'HS-LS2-5', activities: [
    'Investigation 5 — trace carbon from dissolved CO₂ into algae (photosynthesis) and back to CO₂ (respiration, decomposition) using the carbon diagram.',
    'Lab — the dissolved-oxygen chart\'s day/night swing shows photosynthesis (daytime O₂ rise) versus respiration (night-time O₂ fall).',
  ] },
  { std: 'HS-LS2-7', activities: [
    'Investigation 3 — design a Waste-to-Plate system: choose crop density, harvest interval and aeration to reduce dissolved nutrients and algae while keeping fish alive.',
    'Investigation 6 — compare the model with real Water Quality Portal data and evaluate how nutrient pollution affects a real water body.',
    'Lab — refine the design with water changes and feeding rate; evaluate trade-offs (food produced vs. nutrients released).',
  ] },
];

/**
 * Investigations. `setup` is applied to the controls by the "Set up this investigation" button.
 * `capture` lists metrics recorded by "Record my results".
 */
export const INVESTIGATIONS = [
  {
    id: 'inv1',
    title: 'Investigation 1: What causes an algal bloom?',
    ngss: ['HS-LS2-1'],
    question: 'Algae need light AND nutrients. Which one limits how much algae can grow — and does that change when conditions change?',
    background: 'Producer growth in the model uses Liebig\'s law of the minimum: growth is set by whichever resource is scarcest. For each resource the model calculates a factor from 0 (none available) to 1 (plenty), for example f_P = P ÷ (K_P + P). The smallest factor wins.',
    setup: { scenario: 'A', fishCount: 0, feedPct: 0, nutrientLevel: 0, light: 80, days: 60, aeration: 'gentle' },
    setupNote: 'We remove the fish so YOU control the nutrients with the "Extra nutrient loading" slider.',
    procedure: [
      'Press "Set up this investigation" and then "Run experiment". Record the final algae and the limiting factor (shown in the Metrics panel).',
      'Raise "Extra nutrient loading" one step at a time (none → very high). Run each time and record the results.',
      'Set nutrient loading to "very high" and lower the light to 30 %. Run again.',
      'Use the "Limiting factor" readout and the algae chart to decide what limited growth in each run.',
    ],
    capture: ['algae', 'chl', 'limiting', 'fL', 'fN', 'fP', 'po4', 'din', 'doMinRun'],
    prompts: {
      claim: 'Which factor limited algal growth at low nutrient loading? At high nutrient loading?',
      reasoning: 'Explain using the idea of a limiting factor (Liebig\'s law). Why does adding more of a non-limiting resource not increase growth?',
    },
  },
  {
    id: 'inv2',
    title: 'Investigation 2: Why do fish die during an ecosystem collapse?',
    ngss: ['HS-LS2-1', 'HS-LS2-4'],
    question: 'When fish die in an overcrowded tank, is it because of the algae, the bacteria, the oxygen, or the ammonia?',
    background: 'Dead algae, feces and uneaten food become detritus. Decomposer bacteria break detritus down by aerobic respiration, which uses dissolved oxygen. At night there is no photosynthesis, so oxygen falls fastest just before dawn. Fish also respire, and their waste produces ammonia, which is toxic in its un-ionized form (NH₃).',
    setup: { scenario: 'A', fishCount: 8, feedPct: 1.5, nutrientLevel: 0, light: 80, days: 90, aeration: 'gentle' },
    procedure: [
      'Set up and run. Watch the dissolved-oxygen chart: the shaded band shows each day\'s lowest and highest oxygen.',
      'Find the first day the lowest oxygen drops below the stress line. What was happening to bacteria and detritus just before?',
      'Read "Fish deaths" in the Metrics panel: how much was caused by low oxygen and how much by ammonia?',
      'Change ONE variable (aeration, number of fish, OR feeding) and run again. Did the outcome change?',
    ],
    capture: ['fishWetG', 'doMinRun', 'firstLowDODay', 'deathHypoxiaG', 'deathAmmoniaG', 'bact', 'nh3'],
    prompts: {
      claim: 'What directly killed the fish in your first run? What was the chain of events that led to it?',
      reasoning: 'Connect nutrients → algae → death → decomposition → oxygen demand. Why is oxygen lowest at night?',
    },
  },
  {
    id: 'inv3',
    title: 'Investigation 3: Can aquaponics reduce nutrient accumulation?',
    ngss: ['HS-LS2-7'],
    question: 'Can growing crops on fish water ("Waste-to-Plate") keep nutrients and algae down — and what are its limits?',
    background: 'In aquaponics, crop roots absorb nitrate and phosphate from the fish water. When crops are harvested, those nutrients leave the system as food. Crop leaves release their oxygen into the AIR, not the water, so crops do not oxygenate the fish tank — only the roots draw on the water\'s oxygen.',
    setup: { scenario: 'compare', fishCount: 8, feedPct: 1.5, nutrientLevel: 0, light: 80, days: 90, aeration: 'strong', cropDensity: 60 },
    procedure: [
      'Set up and run. This compares Scenario A (no crops) and Scenario B (crops) with IDENTICAL fish, food, light and aeration.',
      'Record dissolved nitrogen, phosphate and algae at the end of each scenario.',
      'Change crop planting density to 0 %, 30 %, 60 % and 100 %. Run each time and record nitrogen removed by harvest.',
      'Set aeration to "None" and run. Does aquaponics still protect the fish?',
    ],
    capture: ['din', 'po4', 'algae', 'crop', 'harvestN', 'fishWetG', 'doMinRun'],
    prompts: {
      claim: 'How much did crops reduce dissolved nutrients and algae? Did they eliminate algae?',
      reasoning: 'Use the nitrogen diagram: where did the nitrogen go in each scenario? What else (oxygen, light, harvest) does the design depend on?',
    },
  },
  {
    id: 'inv4',
    title: 'Investigation 4: Where does the energy go?',
    ngss: ['HS-LS2-4'],
    question: 'Of all the energy the fish eat, how much becomes new fish? Is it close to the "10 % rule"?',
    background: 'Energy enters as sunlight captured by producers — and, in a fish tank, as the chemical energy in food from outside. At each step most energy is used for life processes and leaves as heat through respiration. The ~10 % rule is an average from real food webs; real transfer efficiencies vary from about 2 % to 25 %. The model does NOT force 10 %: the fish\'s efficiency emerges from its digestion and respiration settings. Careful: the 10 % rule compares the production of a whole trophic level with the level below it. It combines how much of the food is eaten, how much is digested, and how much of that becomes new tissue. The fish\'s growth efficiency measured here is only the last two parts.',
    setup: { scenario: 'A', fishCount: 4, feedPct: 1.0, nutrientLevel: 0, light: 80, days: 60, aeration: 'strong' },
    procedure: [
      'Set up and run. Open the Energy budget panel.',
      'Record the energy the fish ate, the energy stored as new fish tissue, and the heat released by fish respiration.',
      'Calculate: growth efficiency = energy stored in new fish ÷ energy eaten × 100 %. Check your answer against the app\'s value.',
      'Calculate what fraction of the energy captured by algae ended up in new fish tissue. Why is it so much smaller than the growth efficiency?',
      'Set feeding to 0 %. Now the fish can only graze algae. Run again. What happens to the fish, and what does that say about whether this tank\'s algae could support them?',
    ],
    capture: ['eFishIngest', 'eFishProd', 'eHeatFish', 'eff', 'eGPP'],
    prompts: {
      claim: 'What percentage of the energy the fish ate became fish biomass? How does it compare with 10 %, and why are the two numbers measuring different things?',
      reasoning: 'Explain where the rest of the energy went and why energy cannot be recycled the way nitrogen and carbon are.',
    },
  },
  {
    id: 'inv5',
    title: 'Investigation 5: Where does the matter go?',
    ngss: ['HS-LS2-4', 'HS-LS2-5'],
    question: 'If you follow one nitrogen atom and one carbon atom from a food pellet, where can they end up?',
    background: 'Matter is conserved. Nitrogen changes form (protein → ammonium → nitrate → algae → detritus → ammonium …) but only leaves the water as N₂ gas (denitrification), in harvested crops, or in drained water. Carbon moves from CO₂ into producers by photosynthesis and back to CO₂ by respiration and decomposition.',
    setup: { scenario: 'B', fishCount: 6, feedPct: 1.5, nutrientLevel: 0, light: 80, days: 60, aeration: 'strong', cropDensity: 60 },
    procedure: [
      'Set up and run. Open the Nitrogen cycle diagram. Arrow thickness shows how much nitrogen each process moved.',
      'Trace a path for a nitrogen atom from fish food to the harvest. Name every process.',
      'Check the mass balance panel: does (inputs − exports) equal the change in nitrogen stored?',
      'Open the Carbon cycle diagram and trace carbon from CO₂ to algae and back. Identify a carbon source and a carbon sink.',
    ],
    capture: ['feedN', 'nitrified', 'denitrified', 'harvestN', 'nBalance', 'gppC', 'respC'],
    prompts: {
      claim: 'Does nitrification remove nitrogen from the water? Which processes actually remove it?',
      reasoning: 'Use your numbers to show that nitrogen was conserved. How is the carbon cycle different from energy flow?',
    },
  },
  {
    id: 'inv6',
    title: 'Investigation 6: Real-world water quality',
    ngss: ['HS-LS2-7', 'HS-LS2-1'],
    question: 'What do real measurements from a river or lake tell us — and how is a natural water body different from an aquarium?',
    background: 'Real observations come from monitoring organizations (USGS, state agencies, tribes, volunteer groups) and are shared through the Water Quality Portal. Each measurement has a location, date, characteristic, value, unit and quality information. A river is NOT a fish tank: it has flowing water, sediments, seasons, rain events and a watershed full of nutrient sources.',
    setup: null,
    procedure: [
      'Open the "Real Water Data" tab and load the dataset your teacher prepared (or import a CSV).',
      'Record the monitoring location, its ID, the dates, the characteristic and the units.',
      'Describe the pattern: are there seasonal changes? unusually high values? missing periods?',
      'Use "Compare with model" to view the observations NEXT TO (not on top of) your simulation for the same quantity.',
      'List at least three reasons the real water body and the model tank may differ.',
    ],
    capture: ['obsLocation', 'obsCharacteristic', 'obsUnits', 'obsDates', 'obsN', 'obsMedian'],
    prompts: {
      claim: 'What pattern did you find in the real data?',
      reasoning: 'What are the limitations of the data AND of the model? Why should we not tune the aquarium model to match a river?',
    },
  },
];

export const QUIZ = [
  // original four questions from the Python version (kept), plus new ones
  { basic: true, q: 'Which organisms are autotrophs (producers) in this simulation?', choices: ['Goldfish', 'Algae and crop plants', 'Decomposer bacteria', 'All consumers'], answer: 1, why: 'Algae and crops photosynthesize — they make their own food from CO₂ and light. Fish and decomposers are heterotrophs.' },
  { q: 'Which nutrients most commonly limit producer growth in fresh water?', choices: ['Nitrogen and phosphorus', 'Oxygen and helium', 'Sodium and iron only', 'Carbon monoxide and neon'], answer: 0, why: 'Nitrogen and phosphorus are the nutrients most often in short supply for algae and plants.' },
  { basic: true, q: 'Producers capture 1,000 kJ. About how much is passed to the next trophic level under the 10 % rule?', choices: ['1 kJ', '10 kJ', '100 kJ', '900 kJ'], answer: 2, why: 'About 10 % (100 kJ) becomes biomass at the next level; roughly 90 % is used for life processes and released as heat.' },
  { q: 'Which statement correctly describes a carbon sink and a carbon source?', choices: ['A sink releases carbon; a source stores it', 'Both always remove CO₂', 'A sink takes up and stores more carbon than it releases; a source releases more than it takes up', 'Neither affects the carbon cycle'], answer: 2, why: 'Growing producers act as a sink (photosynthesis > respiration); decomposition and respiration make sources.' },
  { q: 'Nitrifying bacteria convert ammonium (NH₄⁺) into nitrate (NO₃⁻). What happens to the total amount of nitrogen in the water?', choices: ['It decreases — nitrification removes nitrogen', 'It stays the same — the nitrogen only changes form', 'It increases — bacteria make nitrogen', 'It turns into oxygen'], answer: 1, why: 'Nitrification is a transformation, not a removal. Nitrogen leaves only by denitrification (N₂ gas), harvest, or water changes.' },
  { basic: true, q: 'In the model, dissolved oxygen is usually lowest…', choices: ['at noon', 'just before dawn', 'right after feeding', 'it never changes'], answer: 1, why: 'All night, organisms respire but nothing photosynthesizes, so oxygen falls until the lights come on.' },
  { basic: true, q: 'Why can a large algal bloom lead to LOW oxygen even though algae make oxygen?', choices: ['Algae breathe nitrogen', 'When the algae die, decomposers use oxygen to break them down, and algae respire at night', 'Algae block the air pump', 'Oxygen is heavier than water'], answer: 1, why: 'Decomposition of dead algae and night-time respiration can use more oxygen than the algae produced.' },
  { basic: true, q: 'In aquaponics, crop leaves release the oxygen from photosynthesis…', choices: ['into the fish water', 'into the air', 'into the soil', 'nowhere — plants do not make oxygen'], answer: 1, why: 'Leaves are above the water. Crops remove nutrients from the water but do not add oxygen to it; their roots actually use some.' },
  { q: 'A river\'s nitrate values from the Water Quality Portal are lower than your model tank. What is the BEST conclusion?', choices: ['The model is wrong', 'The river data are wrong', 'A river and a fish tank are different systems with different inputs and flows, so they should not be expected to match', 'Nitrate does not exist in rivers'], answer: 2, why: 'Comparing them can be useful for scale and patterns, but the model is not calibrated to any river.' },
];

/** Short explanation panels shown under each chart ("What am I seeing?"). */
export const EXPLAIN = {
  nitrogen: 'Ammonium (NH₄⁺, includes NH₃) comes from fish excretion and decomposition. Nitrifying bacteria turn it into nitrate (NO₃⁻) — the nitrogen stays in the water. Algae and crops absorb both forms. Values are milligrams of nitrogen per litre (mg N/L).',
  phosphorus: 'Dissolved phosphate comes from fish waste and decomposition and is taken up by algae, crops and bacteria. Phosphorus has no gas form, so it can only leave by harvest or water changes.',
  algae: 'Algae grow when light and nutrients allow; they shade themselves when dense. Dead algae become detritus for decomposers. The chlorophyll-a estimate uses AQUATOX\'s ratio of 28 µg carbon per µg chlorophyll-a.',
  crops: 'Crop biomass in the grow beds (dry mass per litre of system water). Harvests remove part of the crop — and the nutrients inside it — every few days.',
  fish: 'Total wet mass of the goldfish. Fish grow when food supplies more energy than respiration uses, and shrink or die when food, oxygen or water quality fail.',
  bacteria: 'Decomposers grow on detritus; nitrifiers live on gravel and filter surfaces and need ammonium AND oxygen. A brand-new tank has very few nitrifiers.',
  oxygen: 'The line is the daily average; the shaded band is each day\'s lowest and highest value. Oxygen rises in daylight (photosynthesis) and falls at night (respiration). The red dashed line is the fish-stress threshold you set — real fish species differ widely.',
  carbon: 'Dissolved inorganic carbon (CO₂ + bicarbonate) versus carbon stored in living things and detritus. Photosynthesis moves carbon from the first pool into the second; respiration and decomposition move it back.',
};

/** Basic-mode missions (match the paper worksheet docs/lab-worksheet.pdf). */
export const MISSIONS = [
  {
    id: 'm1', title: 'Mission 1: Keep the fish alive', pages: 'Worksheet pages 1–2', ngss: ['HS-LS2-1'],
    goal: 'Eight goldfish live in this tank. With the starting settings, they do not survive. Find a way to keep all 8 alive for 60 days.',
    setup: { scenario: 'A', fishCount: 8, food: 'normal', light: 'medium', pump: 'off', days: 60 },
    steps: [
      'Press "Load the starting tank". Write your prediction on the worksheet, then press Run.',
      'Fill in Trial 1 on the worksheet: fish alive at the end, oxygen color, water color.',
      'Change ONE thing (food, light, number of fish, or air pump). Run again and fill in the next trial.',
      'Keep going until all 8 fish survive. Which change worked? Did more than one change work?',
    ],
  },
  {
    id: 'm2', title: 'Mission 2: Why did the fish die?', pages: 'Worksheet page 3', ngss: ['HS-LS2-1', 'HS-LS2-4'],
    goal: 'Use the "What happened?" story and the oxygen chart to explain the chain of events that killed the fish.',
    setup: { scenario: 'A', fishCount: 8, food: 'normal', light: 'medium', pump: 'off', days: 60 },
    steps: [
      'Press "Load the starting tank" and Run.',
      'Read the "What happened?" list from top to bottom. Write the day of each event on the worksheet.',
      'Look at the oxygen chart. Is oxygen lowest in the day or at night? Use "Look at day" to check the tank picture.',
      'Number the boxes on the worksheet to put the cause-and-effect chain in order.',
    ],
  },
  {
    id: 'm3', title: 'Mission 3: Waste to Plate', pages: 'Worksheet pages 4–5', ngss: ['HS-LS2-7', 'HS-LS2-5'],
    goal: 'Can plants grown on fish water clean up the fish waste AND grow food? Compare a plain fish tank with an aquaponics tank.',
    setup: { scenario: 'compare', fishCount: 8, food: 'normal', light: 'medium', pump: 'on', days: 60 },
    steps: [
      'Press "Load the comparison" and Run. Both tanks get the same fish, food, light and air pump. Fill in Run 1 on the worksheet.',
      'Run 2: change the food to "A lot" and Run. Fill in Run 2.',
      'Run 3: keep "A lot" of food, turn the air pump Off, and Run. Fill in Run 3.',
      'Write your claim, evidence and reasoning on the worksheet.',
    ],
  },
];
