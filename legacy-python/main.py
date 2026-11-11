"""Command-line entry point for the ecosystem simulation."""
from scenarios import unmanaged_tank, waste_to_plate
from model import Simulation
from visualization import plot_comparison
from quiz import run_quiz


def summarize(label, history):
    """Print selected start/end measurements for quick comparison."""
    start, end = history[0], history[-1]
    print(f"\n{label}")
    print("-" * len(label))
    for key, display in [
        ("algae", "Algae biomass"),
        ("crops", "Crop biomass"),
        ("fish", "Fish biomass"),
        ("bacteria", "Bacteria biomass"),
        ("dissolved_oxygen", "Dissolved oxygen (mg/L)"),
        ("nitrogen_total", "Dissolved nitrogen"),
        ("phosphorus", "Phosphorus"),
        ("co2", "CO2 pool"),
    ]:
        print(f"{display:28s} {start[key]:8.2f}  ->  {end[key]:8.2f}")
    low_oxygen_days = sum(1 for row in history if row["dissolved_oxygen"] < 3.0)
    print(f"Days below 3.0 mg/L oxygen: {low_oxygen_days}")


def main():
    print("GOLDFISH PARADISE: ECOLOGY & NUTRIENT-CYCLE SIMULATOR")
    print("1. Run both scenarios (recommended)")
    print("2. Run only Scenario A — unmanaged tank")
    print("3. Run only Scenario B — Waste-to-Plate")
    choice = input("Choose 1, 2, or 3 [1]: ").strip() or "1"
    days_text = input("Number of days to simulate [60]: ").strip() or "60"
    try:
        days = max(1, min(365, int(days_text)))
    except ValueError:
        print("Invalid number; using 60 days.")
        days = 60

    history_a = Simulation(unmanaged_tank(), days).run()
    history_b = Simulation(waste_to_plate(), days).run()

    if choice == "2":
        summarize("Scenario A — Unmanaged Tank", history_a)
        plot_comparison(history_a, history_b, show=True)
    elif choice == "3":
        summarize("Scenario B — Waste-to-Plate", history_b)
        plot_comparison(history_a, history_b, show=True)
    else:
        summarize("Scenario A — Unmanaged Tank", history_a)
        summarize("Scenario B — Waste-to-Plate", history_b)
        plot_comparison(history_a, history_b, show=True)

    if input("\nTake the ecology quiz? (y/n) [y]: ").strip().lower() != "n":
        run_quiz()


if __name__ == "__main__":
    main()
