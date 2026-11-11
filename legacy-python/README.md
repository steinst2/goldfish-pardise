# Goldfish Paradise: Ecology, Energy Flow & Nutrient Cycling

An interactive, command-line Python simulation for high-school biology. Students compare an unmanaged aquatic tank with an aquaponics-inspired **Waste-to-Plate** system and investigate how producers, consumers, decomposers, nutrients, oxygen, and carbon interact.

> **Educational model notice:** This is a simplified conceptual simulation, not a calibrated aquarium-management tool. Biomass values are relative model units, and nutrient/gas pools are mg/L-equivalent teaching values. Do not use the output to make decisions about real animal care.

## Learning goals

Students will be able to:

- Explain the roles of autotrophs, heterotrophs, and decomposers.
- Model how nitrogen and phosphorus availability can limit producer growth.
- Trace how excess nutrients can contribute to eutrophication, algal die-off, decomposition, and low dissolved oxygen.
- Explain why decomposers consume oxygen while breaking down organic matter.
- Compare nutrient recycling in an aquaponics-style system.
- Distinguish energy flow (including the approximate 10% transfer rule) from matter cycling.
- Identify carbon sources and sinks in a simplified carbon cycle.

## Project structure

```text
goldfish-paradise-ecosystem/
├── main.py             # CLI entry point and scenario selection
├── model.py            # Organism, Ecosystem, and Simulation classes
├── scenarios.py        # Scenario A and Scenario B starting conditions
├── visualization.py    # Matplotlib comparison graphs
├── quiz.py             # Four-question CLI assessment
├── requirements.txt
└── README.md
```

## Biological background

### Scenario A — Goldfish Paradise: unmanaged tank

Goldfish are **heterotrophs**: they obtain energy by consuming food and release nitrogen- and phosphorus-containing waste. Uneaten food and waste add nutrients and organic matter to the water. Green algae are **autotrophs** that use light, carbon dioxide, and dissolved nutrients to photosynthesize and grow.

When light and nutrients are abundant, algae can grow rapidly. A bloom does not guarantee permanently high oxygen: dense algal populations can die, and decomposer bacteria break down the dead organic matter. Bacteria are **decomposers**; their aerobic cellular respiration consumes dissolved oxygen. Fish and other organisms also respire. If oxygen falls below the model's 3.0 mg/L stress threshold, fish mortality increases. This chain illustrates how nutrient enrichment can contribute to eutrophication and ecosystem disruption.

### Scenario B — Waste-to-Plate: aquaponics-inspired system

Hydroponic crops are added as another group of photosynthetic primary producers. Their roots take up dissolved nitrogen and phosphorus that would otherwise be available to algae. Crop growth stores some of those nutrients in plant biomass, which can be harvested as food. This is a simplified nutrient-recovery pathway: it does not make waste disappear, and plant roots and microbes still respire.

In the model, crop uptake competes with algae for the same dissolved nutrient pools. The intended comparison is whether this competition can reduce bloom pressure and help maintain dissolved oxygen. Outcomes depend on the starting conditions and model parameters; aquaponics is not guaranteed to prevent every ecological problem.

## Model design and assumptions

- **Organism classes:** `Organism` stores living biomass. `Ecosystem` contains organisms and abiotic pools. `Simulation` advances the ecosystem one day at a time and stores snapshots.
- **Nitrogen cycle:** fish waste adds ammonia nitrogen; nitrifying bacteria convert some ammonia to nitrate; producers take up dissolved nitrogen; decomposer activity mineralizes organic nitrogen back to ammonia; denitrification returns some nitrate to an atmospheric nitrogen pool (represented as a loss from the modeled water).
- **Phosphorus cycle:** fish waste and decomposition add phosphorus; algae and crops remove it through growth. This teaching model does not include a detailed sediment phosphorus pool.
- **Carbon cycle:** photosynthesis removes CO2 and stores carbon in producer biomass; respiration and decomposition return CO2. Dead biomass enters an organic-carbon pool. The cumulative exchange variable records the net modeled exchange.
- **Oxygen:** photosynthesis adds dissolved oxygen; fish, producers, and decomposers consume it through respiration. The model uses daily-average rates and does not simulate day/night oxygen swings.
- **Energy:** the simulation tracks producer energy, consumer assimilation, and metabolic heat. Approximately 10% of energy available to the next trophic level is assigned to consumer assimilation and 90% to metabolic heat/life processes. Energy is not recycled like nutrients.
- **Limiting nutrients:** a Liebig-style minimum factor and nutrient-demand caps constrain producer growth. Nitrogen and phosphorus both matter; whichever is scarcer relative to demand limits growth.
- **Units:** biomass and energy are arbitrary model units. Nutrient and carbon/oxygen pools are simplified mg/L-equivalent values.

## NGSS alignment

| Standard | Core expectation (paraphrased) | Simulation connection |
|---|---|---|
| **HS-LS2-1** | Use mathematical/computational representations to support explanations of factors affecting biodiversity and populations. | Students compare population and biomass changes as nutrients, light, and oxygen change. |
| **HS-LS2-4** | Use a mathematical representation to support claims about cycling of matter and flow of energy. | Students track nitrogen, phosphorus, carbon, oxygen, and trophic energy transfer. |
| **HS-LS2-5** | Develop a model illustrating how photosynthesis and cellular respiration cycle carbon. | Algae/crops remove CO2; fish, plants, and decomposers return CO2 through respiration. |
| **HS-LS2-7** | Design, evaluate, and refine a solution for reducing human impacts on the environment. | Students evaluate the aquaponics-inspired nutrient uptake strategy and propose parameter changes. |

Teachers should consult the official NGSS performance expectations and local course framework when preparing formal standards documentation.

## Setup

Python 3.10 or newer is recommended.

### 1. Create and activate a virtual environment

**Windows PowerShell**
```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
```

**macOS / Linux**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Run the simulation

```bash
python main.py
```

Choose both scenarios for the recommended side-by-side comparison. Enter a simulation length (1–365 days), inspect the graphs, and optionally complete the four-question quiz.

## Reading the graphs

**Top row — nutrients and producers:** Compare dissolved nitrogen, phosphorus, algae biomass, and crop biomass. Look for nutrient increases, producer growth, and whether crop biomass increases while dissolved nutrients are drawn down.

**Bottom row — oxygen and consumers/decomposers:** Compare dissolved oxygen with the 3.0 mg/L stress threshold, fish biomass, and bacteria biomass. Ask whether oxygen decline follows an increase in decomposer activity and whether fish biomass responds.

The plots use separate axes only conceptually: nutrient/gas concentrations and biomass are different kinds of quantities, so students should compare trends rather than treat their numerical magnitudes as directly equivalent.

## Suggested student investigation

1. Run both scenarios for 60 days. Identify the first major difference between the trajectories.
2. Explain the sequence linking fish waste, nutrient availability, algal growth, algal death, decomposition, and dissolved oxygen.
3. Change `fish_waste_n_rate`, `fish_waste_p_rate`, `light`, or `crop_growth_rate` in `model.py`. Predict the result before rerunning.
4. Decide whether the aquaponics scenario is a complete solution. Identify at least two limitations of the model and one additional real-world variable to include.
5. Use evidence from the graphs to write a claim-evidence-reasoning response.

## Extending the project

Possible extensions include temperature effects on oxygen solubility, explicit food input and fish feeding, water exchange, sediment phosphorus, a separate atmospheric N2 pool, harvest events, day/night photosynthesis, stochastic population changes, and automated tests for conservation of matter.
