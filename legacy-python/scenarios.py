"""Preset starting conditions for the two classroom scenarios."""
from model import Ecosystem, Organism


def unmanaged_tank() -> Ecosystem:
    """Scenario A: excess fish waste and no crop nutrient-removal pathway."""
    return Ecosystem(
        scenario_name="A — Goldfish Paradise (unmanaged tank)",
        aquaponics=False,
        light=0.95,
        fish=Organism("Goldfish", 18.0),
        algae=Organism("Green algae", 4.0),
        bacteria=Organism("Decomposer bacteria", 1.3),
        crops=Organism("Hydroponic crops", 0.0),
        ammonia_n=0.45,
        nitrate_n=0.75,
        phosphorus=0.48,
        dissolved_oxygen=8.2,
        co2=1.6,
        organic_carbon=2.2,
    )


def waste_to_plate() -> Ecosystem:
    """Scenario B: crops compete with algae and remove dissolved nutrients."""
    return Ecosystem(
        scenario_name="B — Waste-to-Plate (aquaponics)",
        aquaponics=True,
        light=0.82,
        fish=Organism("Goldfish", 12.0),
        algae=Organism("Green algae", 2.2),
        bacteria=Organism("Decomposer bacteria", 0.9),
        crops=Organism("Hydroponic crops", 7.0),
        ammonia_n=0.30,
        nitrate_n=0.55,
        phosphorus=0.24,
        dissolved_oxygen=8.4,
        co2=1.4,
        organic_carbon=1.6,
    )
