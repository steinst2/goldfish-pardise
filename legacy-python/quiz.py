"""Short CLI assessment for ecology vocabulary and systems thinking."""
QUESTIONS = [
    {
        "question": "Which organism is an autotroph in this simulation?",
        "choices": ["A. Goldfish", "B. Green algae", "C. Decomposer bacteria", "D. All consumers"],
        "answer": "B",
        "explanation": "Algae are photosynthetic producers (autotrophs). Hydroponic crops are autotrophs too."
    },
    {
        "question": "Which nutrients commonly limit producer growth in freshwater systems?",
        "choices": ["A. Nitrogen and phosphorus", "B. Oxygen and helium", "C. Sodium and iron only", "D. Carbon monoxide and neon"],
        "answer": "A",
        "explanation": "Nitrogen and phosphorus are key nutrients that can limit algal and plant growth."
    },
    {
        "question": "If producers capture 100 units of energy, about how much is passed to the next trophic level under the 10% rule?",
        "choices": ["A. 1 unit", "B. 10 units", "C. 50 units", "D. 90 units"],
        "answer": "B",
        "explanation": "About 10% is transferred; roughly 90% is used in life processes and dissipated as heat."
    },
    {
        "question": "Which statement correctly describes a carbon sink and a carbon source?",
        "choices": [
            "A. A sink releases carbon; a source stores it",
            "B. Both always remove CO2",
            "C. A sink absorbs/stores more carbon than it releases; a source releases more than it absorbs",
            "D. Neither affects the carbon cycle"
        ],
        "answer": "C",
        "explanation": "Photosynthesis can act as a CO2 sink; respiration and decomposition release CO2."
    },
]


def run_quiz():
    """Ask four multiple-choice questions and report a score."""
    print("\n=== Ecology Check: Chapter 3 Vocabulary ===")
    score = 0
    for number, item in enumerate(QUESTIONS, start=1):
        print(f"\n{number}. {item['question']}")
        for choice in item["choices"]:
            print("  " + choice)
        response = input("Your answer (A/B/C/D): ").strip().upper()
        if response == item["answer"]:
            print("Correct!")
            score += 1
        else:
            print(f"Not quite. Correct answer: {item['answer']}.")
        print("Why: " + item["explanation"])
    print(f"\nYour score: {score}/{len(QUESTIONS)}")
    if score == len(QUESTIONS):
        print("Excellent systems thinking!")
    elif score >= 2:
        print("Good work. Review the explanations and compare the graphs.")
    else:
        print("Review producer/consumer/decomposer roles and the nutrient and energy cycles.")
