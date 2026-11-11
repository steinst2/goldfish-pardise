"""Core ecosystem model for Goldfish Paradise and Waste-to-Plate.

This is an educational, deterministic, daily-step model. Values are illustrative
rather than calibrated to a real aquarium. Biomass is expressed in model biomass
units; dissolved nutrients and gases are represented in mg/L-equivalent units.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List
import math


@dataclass
class Organism:
    """Base class for living populations in the simulated ecosystem."""
    name: str
    biomass: float

    def clamp(self) -> None:
        """Prevent negative biomass after a daily update."""
        self.biomass = max(0.0, self.biomass)


@dataclass
class Ecosystem:
    """State and daily process rules for one aquatic ecosystem."""
    scenario_name: str
    aquaponics: bool = False
    light: float = 0.85                 # 0..1 relative light availability
    water_volume_l: float = 100.0       # reference volume for mg/L-equivalent pools

    fish: Organism = field(default_factory=lambda: Organism("Goldfish", 12.0))
    algae: Organism = field(default_factory=lambda: Organism("Green algae", 3.0))
    bacteria: Organism = field(default_factory=lambda: Organism("Decomposer bacteria", 1.0))
    crops: Organism = field(default_factory=lambda: Organism("Hydroponic crops", 0.0))

    ammonia_n: float = 0.35
    nitrate_n: float = 0.65
    phosphorus: float = 0.30
    dissolved_oxygen: float = 8.0
    co2: float = 1.5
    organic_carbon: float = 2.0
    atmospheric_carbon_exchange: float = 0.0

    # Cumulative energy accounting (arbitrary energy units).
    producer_energy_created: float = 0.0
    consumer_energy_assimilated: float = 0.0
    metabolic_heat_lost: float = 0.0

    # Daily rates / thresholds; exposed so teachers can modify experiments.
    fish_waste_n_rate: float = 0.055
    fish_waste_p_rate: float = 0.009
    fish_oxygen_rate: float = 0.035
    algae_growth_rate: float = 0.42
    crop_growth_rate: float = 0.06
    bacteria_growth_rate: float = 0.16
    algae_respiration_rate: float = 0.025
    bacteria_oxygen_rate: float = 0.22
    fish_critical_oxygen: float = 3.0
    algae_bloom_threshold: float = 2.4
    nutrient_uptake_rate: float = 0.20
    denitrification_rate: float = 0.025

    def __post_init__(self) -> None:
        if self.aquaponics and self.crops.biomass <= 0:
            self.crops.biomass = 5.0

    @staticmethod
    def _limiting_fraction(nitrogen: float, phosphorus: float) -> float:
        """Return a 0..1 nutrient limitation factor (Liebig-style minimum)."""
        n_factor = nitrogen / (nitrogen + 0.8) if nitrogen > 0 else 0.0
        p_factor = phosphorus / (phosphorus + 0.18) if phosphorus > 0 else 0.0
        return min(n_factor, p_factor)

    def step(self, day: int) -> Dict[str, float]:
        """Advance the ecosystem by one day and return a snapshot.

        Order of operations is intentional: fish add waste; producers compete
        for dissolved nutrients; dead biomass enters detritus; bacteria
        decompose detritus and consume oxygen; then fish mortality is applied.
        """
        # A simple seasonal/daylight pattern keeps light from being a constant.
        self.light = min(1.0, max(0.15, 0.82 + 0.12 * math.sin(day / 5.0)))

        # 1. Fish are heterotrophic consumers: they respire and excrete waste.
        fish_activity = self.fish.biomass
        fish_waste_n = fish_activity * self.fish_waste_n_rate
        fish_waste_p = fish_activity * self.fish_waste_p_rate
        self.ammonia_n += fish_waste_n
        self.phosphorus += fish_waste_p
        fish_oxygen_use = fish_activity * self.fish_oxygen_rate

        # 2. Nitrifying bacteria convert some ammonia to nitrate.
        nitrified = min(self.ammonia_n, 0.10 * self.bacteria.biomass)
        self.ammonia_n -= nitrified
        self.nitrate_n += nitrified

        # 3. Producers compete for the same dissolved N and P pools.
        nutrient_factor = self._limiting_fraction(
            self.ammonia_n + self.nitrate_n, self.phosphorus
        )
        light_factor = self.light
        algae_potential = (
            self.algae.biomass * self.algae_growth_rate *
            light_factor * nutrient_factor
        )
        crop_potential = 0.0
        if self.aquaponics:
            crop_potential = (
                self.crops.biomass * self.crop_growth_rate *
                light_factor * nutrient_factor
            )

        # Allocate nutrient availability proportionally to producer demand.
        total_demand = algae_potential + crop_potential
        available_n = self.ammonia_n + self.nitrate_n
        available_p = self.phosphorus
        # Biomass growth needs both N and P. These coefficients are teaching
        # parameters, not empirical stoichiometric constants.
        n_limited_growth = available_n / 0.11 if total_demand else 0.0
        p_limited_growth = available_p / 0.025 if total_demand else 0.0
        total_growth = min(total_demand, n_limited_growth, p_limited_growth)
        scale = total_growth / total_demand if total_demand > 0 else 0.0
        algae_growth = algae_potential * scale
        crop_growth = crop_potential * scale

        n_used = total_growth * 0.11
        p_used = total_growth * 0.025
        # Remove ammonia first, then nitrate.
        ammonia_used = min(self.ammonia_n, n_used)
        self.ammonia_n -= ammonia_used
        self.nitrate_n = max(0.0, self.nitrate_n - (n_used - ammonia_used))
        self.phosphorus = max(0.0, self.phosphorus - p_used)

        # 4. Algae bloom dynamics: abundant nutrients + light can cause a
        # temporary high-growth state followed by density-related die-off.
        nutrient_total = self.ammonia_n + self.nitrate_n + self.phosphorus
        bloom = nutrient_total >= self.algae_bloom_threshold and self.light > 0.65
        algae_mortality = self.algae.biomass * (0.035 + (0.30 if bloom else 0.0))
        # In a balanced aquaponics system, crop uptake reduces bloom pressure.
        if self.aquaponics:
            algae_mortality *= 0.80

        self.algae.biomass += algae_growth - algae_mortality
        self.crops.biomass += crop_growth

        # 5. Fish consume a small fraction of producer energy. The model
        # explicitly sends 10% to consumer biomass and 90% to metabolic heat.
        # This is an energy-flow illustration, not a literal biomass conversion.
        producer_energy_today = max(0.0, algae_growth + crop_growth) * 10.0
        fish_energy_available = min(producer_energy_today, self.fish.biomass * 0.08)
        assimilated = fish_energy_available * 0.10
        heat = fish_energy_available * 0.90
        self.producer_energy_created += producer_energy_today
        self.consumer_energy_assimilated += assimilated
        self.metabolic_heat_lost += heat
        # A tiny food-energy benefit offsets a portion of fish maintenance.
        fish_energy_support = assimilated * 0.015

        # 6. Dead algae and crop tissue become detritus / organic carbon.
        dead_organic = algae_mortality + crop_growth * 0.006
        self.organic_carbon += dead_organic * 0.16

        # 7. Decomposers grow on organic matter, mineralize nutrients, and
        # consume dissolved oxygen during aerobic cellular respiration.
        decomposition = min(self.organic_carbon, self.bacteria.biomass * 0.20)
        self.organic_carbon -= decomposition
        bacteria_growth = decomposition * self.bacteria_growth_rate
        self.bacteria.biomass += bacteria_growth
        mineralized_n = decomposition * 0.045
        mineralized_p = decomposition * 0.010
        self.ammonia_n += mineralized_n
        self.phosphorus += mineralized_p
        bacteria_oxygen_use = decomposition * self.bacteria_oxygen_rate

        # 8. Photosynthesis adds oxygen and removes CO2; respiration adds CO2.
        photosynthesis = (algae_growth + crop_growth) * 0.42 * self.light
        producer_respiration = (
            self.algae.biomass * self.algae_respiration_rate
            + self.crops.biomass * 0.002
        )
        self.dissolved_oxygen += photosynthesis
        self.dissolved_oxygen -= (
            fish_oxygen_use + bacteria_oxygen_use + producer_respiration
        )
        self.dissolved_oxygen = min(12.0, max(0.0, self.dissolved_oxygen))

        co2_removed = photosynthesis * 0.30
        co2_added = (fish_oxygen_use + bacteria_oxygen_use + producer_respiration) * 0.28
        self.co2 = max(0.05, self.co2 + co2_added - co2_removed)
        self.atmospheric_carbon_exchange += co2_added - co2_removed

        # 9. Denitrification returns a small amount of nitrate nitrogen to N2.
        denitrified = min(self.nitrate_n, self.nitrate_n * self.denitrification_rate)
        self.nitrate_n -= denitrified

        # 10. Low oxygen causes fish stress and mortality. This is the
        # ecological-collapse mechanism students should identify in Scenario A.
        if self.dissolved_oxygen < self.fish_critical_oxygen:
            oxygen_stress = (self.fish_critical_oxygen - self.dissolved_oxygen) / 4.0
            fish_deaths = min(self.fish.biomass, self.fish.biomass * oxygen_stress * 0.22)
        else:
            fish_deaths = 0.0
        self.fish.biomass = max(0.0, self.fish.biomass - fish_deaths)
        # Dead fish add organic carbon and later fuel decomposer activity.
        self.organic_carbon += fish_deaths * 0.20

        # Keep all living pools non-negative.
        for organism in (self.fish, self.algae, self.bacteria, self.crops):
            organism.clamp()

        return self.snapshot(day, bloom=bloom, fish_deaths=fish_deaths,
                             decomposition=decomposition, photosynthesis=photosynthesis)

    def snapshot(self, day: int, **extra: float) -> Dict[str, float]:
        """Return all variables needed by the visualization and student analysis."""
        result = {
            "day": float(day),
            "light": self.light,
            "ammonia_n": self.ammonia_n,
            "nitrate_n": self.nitrate_n,
            "nitrogen_total": self.ammonia_n + self.nitrate_n,
            "phosphorus": self.phosphorus,
            "algae": self.algae.biomass,
            "fish": self.fish.biomass,
            "crops": self.crops.biomass,
            "bacteria": self.bacteria.biomass,
            "dissolved_oxygen": self.dissolved_oxygen,
            "co2": self.co2,
            "organic_carbon": self.organic_carbon,
            "producer_energy_created": self.producer_energy_created,
            "consumer_energy_assimilated": self.consumer_energy_assimilated,
            "metabolic_heat_lost": self.metabolic_heat_lost,
        }
        result.update({k: float(v) for k, v in extra.items()})
        return result


@dataclass
class Simulation:
    """Runs a scenario for a chosen number of daily time steps."""
    ecosystem: Ecosystem
    days: int = 60
    history: List[Dict[str, float]] = field(default_factory=list)

    def run(self) -> List[Dict[str, float]]:
        """Run from day 0 through the configured number of days."""
        self.history = [self.ecosystem.snapshot(0)]
        for day in range(1, self.days + 1):
            self.history.append(self.ecosystem.step(day))
        return self.history
