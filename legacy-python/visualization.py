"""Matplotlib plots comparing the two scenarios."""
from __future__ import annotations
import matplotlib.pyplot as plt


def _series(history, key):
    return [row[key] for row in history]


def plot_comparison(history_a, history_b, save_path=None, show=True):
    """Create two side-by-side scenario comparisons, each with two panels."""
    fig, axes = plt.subplots(2, 2, figsize=(14, 9), sharex="col")
    scenarios = [
        ("Scenario A — Unmanaged Tank", history_a),
        ("Scenario B — Waste-to-Plate", history_b),
    ]

    for col, (title, history) in enumerate(scenarios):
        days = _series(history, "day")

        # Graph 1: nutrients and producer biomass.
        ax = axes[0, col]
        ax.plot(days, _series(history, "nitrogen_total"), label="Dissolved nitrogen")
        ax.plot(days, _series(history, "phosphorus"), label="Phosphorus")
        ax.plot(days, _series(history, "algae"), label="Algae biomass")
        ax.plot(days, _series(history, "crops"), label="Crop biomass")
        ax.set_title(f"{title}\nNutrients and producer biomass")
        ax.set_ylabel("Model units / mg/L-equivalent")
        ax.grid(True, alpha=0.25)
        ax.legend(fontsize=8)

        # Graph 2: oxygen, fish and decomposer activity.
        ax2 = axes[1, col]
        ax2.plot(days, _series(history, "dissolved_oxygen"),
                 label="Dissolved oxygen (mg/L)", linewidth=2)
        ax2.axhline(3.0, linestyle="--", label="Fish-stress threshold (3 mg/L)")
        ax2.plot(days, _series(history, "fish"), label="Fish biomass")
        ax2.plot(days, _series(history, "bacteria"), label="Bacteria biomass")
        ax2.set_title("Oxygen, fish and decomposers")
        ax2.set_xlabel("Day")
        ax2.set_ylabel("mg/L or model biomass units")
        ax2.grid(True, alpha=0.25)
        ax2.legend(fontsize=8)

    fig.suptitle("Goldfish Paradise vs. Waste-to-Plate Ecosystem Simulation",
                 fontsize=14)
    fig.tight_layout()
    if save_path:
        fig.savefig(save_path, dpi=160, bbox_inches="tight")
        print(f"Saved graph to: {save_path}")
    if show:
        plt.show()
    else:
        plt.close(fig)
