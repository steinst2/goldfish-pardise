#!/usr/bin/env python3
"""Build the printable student worksheet and teacher key (PDF) for Basic mode.

    pip install reportlab          # only needed by the teacher who edits the worksheet
    python scripts/make_worksheet.py

Writes docs/lab-worksheet.pdf (published with the site) and teacher/lab-worksheet-teacher-key.pdf
(kept in the repository only; the GitHub Pages workflow does not publish the teacher/ folder). Edit the text below and
re-run to customise. Designed for black-and-white printing on US Letter paper.
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"

# Fonts: DejaVu Sans has the checkbox and arrow symbols; fall back to Helvetica with ASCII marks.
FONT, BOLD = "Helvetica", "Helvetica-Bold"
BOX, ARROW = "[ ]", "->"
for base in ("/usr/share/fonts/truetype/dejavu", "/Library/Fonts", "C:/Windows/Fonts"):
    reg, bold = Path(base, "DejaVuSans.ttf"), Path(base, "DejaVuSans-Bold.ttf")
    if reg.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("DejaVu", str(reg)))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(bold)))
        FONT, BOLD, BOX, ARROW = "DejaVu", "DejaVu-Bold", "\u2610", "\u2192"
        break

TEAL = colors.HexColor("#14535a")
SHADE = colors.HexColor("#eeeeee")
LINE = colors.HexColor("#888888")

S = {
    "title": ParagraphStyle("title", fontName=BOLD, fontSize=17, leading=21, textColor=TEAL, spaceAfter=4),
    "h2": ParagraphStyle("h2", fontName=BOLD, fontSize=13.5, leading=17, textColor=TEAL, spaceBefore=8, spaceAfter=4),
    "h3": ParagraphStyle("h3", fontName=BOLD, fontSize=11.5, leading=15, spaceBefore=6, spaceAfter=2),
    "body": ParagraphStyle("body", fontName=FONT, fontSize=11, leading=15, spaceAfter=4),
    "small": ParagraphStyle("small", fontName=FONT, fontSize=9.5, leading=12.5, textColor=colors.HexColor("#333333")),
    "cell": ParagraphStyle("cell", fontName=FONT, fontSize=10, leading=12.5),
    "cellb": ParagraphStyle("cellb", fontName=BOLD, fontSize=10, leading=12.5),
    "key": ParagraphStyle("key", fontName=FONT, fontSize=10.5, leading=14, spaceAfter=3, leftIndent=10),
    "center": ParagraphStyle("center", fontName=BOLD, fontSize=10.5, leading=13, alignment=TA_CENTER),
}


def P(t, s="body"):
    return Paragraph(t, S[s])


def lines(n=3, width=7.0 * inch, gap=24):
    """Blank writing lines."""
    t = Table([[""]] * n, colWidths=[width], rowHeights=[gap] * n)
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.6, LINE)]))
    return t


def boxed(flowables, width=7.0 * inch, shade=True):
    t = Table([[flowables]], colWidths=[width])
    st = [("BOX", (0, 0), (-1, -1), 0.8, colors.black), ("LEFTPADDING", (0, 0), (-1, -1), 8),
          ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]
    if shade:
        st.append(("BACKGROUND", (0, 0), (-1, -1), SHADE))
    t.setStyle(TableStyle(st))
    return t


def grid(rows, widths, header_rows=1, height=None):
    data = [[c if not isinstance(c, str) else P(c, "cellb" if r < header_rows else "cell") for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, rowHeights=height)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
        ("BACKGROUND", (0, 0), (-1, header_rows - 1), SHADE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def footer(canvas, doc, label):
    canvas.saveState()
    canvas.setFont(FONT, 8.5)
    canvas.setFillColor(colors.HexColor("#555555"))
    canvas.drawString(0.75 * inch, 0.5 * inch, f"Goldfish Paradise Ecosystem Lab · {label}")
    canvas.drawRightString(7.75 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


def choice(*opts):
    return "&nbsp;&nbsp;&nbsp;".join(f"{BOX} {o}" for o in opts)


# ----------------------------------------------------------------------------- student worksheet
def worksheet():
    st = []
    st.append(grid([["Name:", "", "Date:", "", "Period:", ""]], [0.6 * inch, 2.9 * inch, 0.55 * inch, 1.2 * inch, 0.7 * inch, 1.05 * inch], header_rows=0, height=[26]))
    st.append(Spacer(1, 8))
    st.append(P("Goldfish Paradise: Ecosystem Lab Worksheet", "title"))
    st.append(P("In this lab you will use a computer model of a fish tank to find out what keeps an aquatic ecosystem healthy, "
                "why ecosystems sometimes collapse, and whether growing plants on fish water can clean it up and grow food."))
    st.append(boxed([
        P("<b>Getting started</b>", "h3"),
        P(f"1. Open the lab link from your teacher. Make sure <b>Basic</b> is selected (top right).<br/>"
          f"2. Click the <b>Missions</b> tab. Each mission has a button that sets up the tank for you.<br/>"
          f"3. Use <b>Run</b>, then read the <b>status cards</b>, the <b>What happened?</b> list and the <b>charts</b>.<br/>"
          f"4. The <b>Look at day</b> slider lets you see the tank on any day.", "body"),
        P("<b>Remember:</b> this is a <i>model</i>. It follows real science, but its numbers are not measurements from a real tank.", "small"),
    ]))
    st.append(Spacer(1, 6))
    st.append(P("Words to know", "h2"))
    vocab = [
        ["Producer", "A living thing that makes its own food from sunlight (photosynthesis). Algae and plants."],
        ["Consumer", "A living thing that eats other things for energy. The goldfish."],
        ["Decomposer", "Bacteria that break down dead things and waste. They use oxygen while they work."],
        ["Photosynthesis", "Producers use light, CO<sub>2</sub> and water to make food and give off oxygen. Only in light."],
        ["Respiration", "All living things use food and oxygen for energy and give off CO<sub>2</sub>. Day AND night."],
        ["Ammonia", "Toxic waste from fish. Bacteria change it into nitrate (nitrification)."],
        ["Nitrate", "A less harmful form of nitrogen. Algae and plants use it to grow."],
        ["Algal bloom", "A burst of algae growth that turns the water green."],
        ["Limiting factor", "The thing in shortest supply that stops a population from growing more."],
    ]
    st.append(grid([["Word", "What it means"]] + vocab, [1.35 * inch, 5.65 * inch]))
    st.append(PageBreak())

    # ---- Mission 1
    st.append(P("Mission 1: Keep the fish alive", "h2"))
    st.append(P("Eight goldfish live in this tank. In the Missions tab, press <b>Load the starting tank</b>. "
                "The settings are: <b>8 fish, Normal food, Medium light, Air pump Off, 60 days</b>."))
    st.append(P("Prediction (before you press Run)", "h3"))
    st.append(P(f"After 60 days I think: &nbsp;&nbsp;{choice('all 8 fish live', 'some fish die', 'all the fish die')}"))
    st.append(P("Because…", "small"))
    st.append(lines(2))
    st.append(P("Data table", "h3"))
    st.append(P("Trial 1 uses the starting settings. For each new trial, change <b>only ONE thing</b> from Trial 1.", "small"))
    hdr = ["Trial", "What I changed", "Fish alive at day 60", "Lowest oxygen (G / Y / R)", "Water color"]
    rows = [hdr, ["1", "Nothing (starting tank)", "", "", ""]] + [[str(i), "", "", "", ""] for i in range(2, 7)]
    st.append(grid(rows, [0.5 * inch, 2.4 * inch, 1.25 * inch, 1.4 * inch, 1.45 * inch], height=[30] + [30] * 6))
    st.append(P("G / Y / R = the color of the Oxygen status card: green (Healthy), yellow (Getting low), red (Fish in danger). "
                "Use the Look at day slider to find the worst day. Water color: clear, green, or pea soup.", "small"))
    st.append(P("Questions", "h3"))
    st.append(P("1. Which change(s) kept all 8 fish alive? Did more than one change work?"))
    st.append(lines(2))
    st.append(P("2. Pick one change that worked. Explain <b>why</b> it helped. Use the word <b>oxygen</b>."))
    st.append(P("<i>Sentence starter:</i> When I changed ______, the fish survived because…", "small"))
    st.append(lines(3))
    st.append(PageBreak())

    # ---- Mission 2
    st.append(P("Mission 2: Why did the fish die?", "h2"))
    st.append(P("Load the starting tank again and press Run. Read the <b>What happened?</b> list."))
    st.append(P("A. When did it happen?", "h3"))
    ev = [["Event", "Day"], ["The water turned green (algae growing fast)", ""], ["Decomposer bacteria multiplying fast", ""],
          ["Oxygen dropped below the danger line at night", ""], ["The first fish died", ""], ["Half of the fish were gone", ""]]
    st.append(grid(ev, [5.6 * inch, 1.4 * inch], height=[22] + [26] * 5))
    st.append(P("B. Put the chain in order", "h3"))
    st.append(P("Number the boxes 1 to 6 to show what caused what. Box 1 starts the chain.", "small"))
    chain = ["Decomposers multiply and use up oxygen", "Fish die", "Food and fish waste add nutrients to the water",
             "Oxygen drops very low at night", "Algae grow fast (algal bloom)", "Algae die and waste piles up"]
    cells = [[P(f"<b>___</b>&nbsp; {c}", "cell") for c in chain[i:i + 3]] for i in (0, 3)]
    t = Table(cells, colWidths=[2.33 * inch] * 3, rowHeights=[52, 52])
    t.setStyle(TableStyle([("BOX", (0, 0), (0, 0), 1, colors.black), ("BOX", (1, 0), (1, 0), 1, colors.black), ("BOX", (2, 0), (2, 0), 1, colors.black),
                           ("BOX", (0, 1), (0, 1), 1, colors.black), ("BOX", (1, 1), (1, 1), 1, colors.black), ("BOX", (2, 1), (2, 1), 1, colors.black),
                           ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8)]))
    st.append(t)
    st.append(P("C. Questions", "h3"))
    st.append(P("1. Look at the oxygen chart. Is oxygen lowest in the <b>day</b> or at <b>night</b>? Why?"))
    st.append(P("<i>Hint:</i> which process happens only in the light, and which happens all the time?", "small"))
    st.append(lines(2))
    st.append(P("2. Algae <b>make</b> oxygen. So how can a huge algal bloom end with <b>too little</b> oxygen?"))
    st.append(lines(3))
    st.append(P("3. Did the fish die mostly from low oxygen or from toxic ammonia? (Look at the last line of What happened?)"))
    st.append(lines(1))
    st.append(PageBreak())

    # ---- Mission 3
    st.append(P("Mission 3: Waste to Plate", "h2"))
    st.append(P("In <b>aquaponics</b>, fish water flows past plant roots. The plants soak up nitrogen from fish waste and grow food. "
                "In the Missions tab, press <b>Load the comparison</b>. Both tanks get the same fish, food, light and air pump."))
    st.append(P("Prediction", "h3"))
    st.append(P(f"I think the tank with plants will have: &nbsp;{choice('more waste', 'less waste', 'the same waste')}"))
    st.append(P(f"I think the plants will: &nbsp;{choice('get rid of ALL the algae', 'reduce the algae', 'not change the algae')}"))
    st.append(P("Data table", "h3"))
    st.append(P("Read the values at <b>day 60</b>. Waste = the \"fish waste\" chart. Food grown = the status card on the plants tank.", "small"))
    hdr = ["Run", "Settings", "Tank", "Fish alive", "Waste at day 60 (mg/L)", "Water", "Food grown (g)"]
    rows = [hdr]
    for run, sets in (("1", "Normal food, pump ON"), ("2", "A lot of food, pump ON"), ("3", "A lot of food, pump OFF")):
        rows.append([run, sets, "Fish tank", "", "", "", "—"])
        rows.append(["", "", "+ plants", "", "", "", ""])
    t = grid(rows, [0.45 * inch, 1.45 * inch, 0.85 * inch, 0.85 * inch, 1.2 * inch, 1.0 * inch, 1.2 * inch], height=[30] + [26] * 6)
    t.setStyle(TableStyle([("SPAN", (0, 1), (0, 2)), ("SPAN", (1, 1), (1, 2)), ("SPAN", (0, 3), (0, 4)), ("SPAN", (1, 3), (1, 4)),
                           ("SPAN", (0, 5), (0, 6)), ("SPAN", (1, 5), (1, 6))]))
    st.append(t)
    st.append(P("Questions", "h3"))
    st.append(P("1. In Run 1, how much less waste did the plants tank have? Did the plants get rid of all the algae?"))
    st.append(lines(2))
    st.append(P("2. In Run 3 the air pump was off. Did the plants still save the fish? Why not?"))
    st.append(P("<i>Hint:</i> plant leaves are above the water. Where does the oxygen they make go?", "small"))
    st.append(lines(2))
    st.append(PageBreak())

    # ---- CER + wrap-up
    st.append(P("Claim, Evidence, Reasoning", "h2"))
    st.append(P("<b>Question:</b> Can aquaponics (Waste to Plate) reduce the impact of fish waste on a water ecosystem?"))
    for label, starter, n in (("Claim", "Aquaponics can / cannot reduce the impact of fish waste because…", 1),
                              ("Evidence", "In Run ___, the tank with plants had ___ mg/L of waste and the fish tank had ___ mg/L. Also…", 2),
                              ("Reasoning", "This happens because plants use nitrogen from the water to… When we harvest the plants, the nitrogen…", 3)):
        st.append(P(label, "h3"))
        st.append(P(f"<i>Sentence starter:</i> {starter}", "small"))
        st.append(lines(n))
    st.append(P("Matter and energy check", "h2"))
    tf = [["Statement", "True", "False"],
          ["When bacteria turn ammonia into nitrate, the nitrogen leaves the tank.", BOX, BOX],
          ["The carbon in a fish can later become part of an algae cell.", BOX, BOX],
          ["Energy is recycled in an ecosystem, just like carbon and nitrogen.", BOX, BOX],
          ["When we harvest the plants, nitrogen leaves the system as food.", BOX, BOX],
          ["Fish use most of the energy in their food to stay alive, and it ends up as heat.", BOX, BOX]]
    st.append(grid(tf, [5.6 * inch, 0.7 * inch, 0.7 * inch], height=[22] + [26] * 5))
    st.append(P("Reflection", "h2"))
    st.append(P("Give one way the computer model is <b>different</b> from a real fish tank or a real river like the Saginaw River."))
    st.append(lines(2))
    return st


# ----------------------------------------------------------------------------- teacher key
def key():
    k = []
    k.append(P("Teacher Key: Goldfish Paradise Lab Worksheet (Basic mode)", "title"))
    k.append(P("Values below were produced by the current version of the model with the Basic settings. "
               "The model is deterministic, so students running the same settings get the same results. "
               "If the model is updated, re-check with <font face='Courier'>node tests/verification-report.mjs</font> or by running the lab.", "small"))
    k.append(P("Mission 1: Keep the fish alive", "h2"))
    k.append(P("<b>Trial 1 (starting tank):</b> 0 of 8 alive. Oxygen card red (lowest about 1 mg/L). Water: pea soup. Fish start dying around day 15."))
    res = [["Change from Trial 1", "Fish alive at day 60", "Notes"],
           ["Air pump On", "8 of 8", "Oxygen stays Healthy (lowest about 5.6 mg/L). Best single fix."],
           ["Light Low", "8 of 8", "Fewer algae (about 16 mg/L) means less dead algae for decomposers. Oxygen card yellow (lowest about 2.5 mg/L): a close call."],
           ["Light High", "0 of 8", "More algae, so a bigger crash."],
           ["Food: A little", "2 of 8", "Less waste, but the algae bloom still crashes the oxygen."],
           ["Food: A lot", "0 of 8", "Uneaten food rots, so oxygen demand rises."],
           ["6 fish / 4 fish", "1 of 6 / 1 of 4", "Fewer fish alone is not enough. The algae crash still happens."],
           ["2 fish", "2 of 2", "Very low stocking survives (lowest oxygen about 2 mg/L, right at the line)."]]
    k.append(grid(res, [1.7 * inch, 1.3 * inch, 4.0 * inch]))
    k.append(P("Q2 model answer: <i>When I turned the air pump on, the fish survived because the pump puts oxygen from the air into the water "
               "faster than the fish, algae and decomposers use it up at night.</i>", "key"))
    k.append(P("Mission 2: Why did the fish die?", "h2"))
    k.append(P("<b>A. Days:</b> water turns green, day 4 · decomposers multiplying, day 8 · oxygen below the danger line, day 13 · "
               "first fish died, day 15 · half the fish gone, day 19."))
    k.append(P("<b>B. Chain order:</b> 1 Food and fish waste add nutrients " + ARROW + " 2 Algae grow fast " + ARROW +
               " 3 Algae die and waste piles up " + ARROW + " 4 Decomposers multiply and use up oxygen " + ARROW +
               " 5 Oxygen drops very low at night " + ARROW + " 6 Fish die."))
    k.append(P("Box numbers as printed (left to right, top row then bottom row): 4, 6, 1, 5, 2, 3.", "small"))
    k.append(P("<b>C1:</b> At night. Photosynthesis only happens in light, but respiration (fish, algae, bacteria) happens all the time. "
               "The daily low–high band on the chart shows this swing.", "key"))
    k.append(P("<b>C2:</b> Algae make oxygen only in daylight, but they use oxygen all night. When the huge population dies, "
               "decomposers use a lot of oxygen breaking the dead algae down.", "key"))
    k.append(P("<b>C3:</b> Mostly low oxygen (the last line of What happened? says so for the starting tank). "
               "Ammonia also climbs once fish start dying.", "key"))
    m3h = P("Mission 3: Waste to Plate", "h2")
    m3 = [["Run", "Tank", "Fish alive", "Waste day 60 (mg N/L)", "Water", "Food grown (g)"],
          ["1  Normal food, pump ON", "Fish tank", "8 of 8", "about 33", "pea soup", "—"],
          ["", "+ plants", "8 of 8", "about 13", "pea soup", "about 67"],
          ["2  A lot of food, pump ON", "Fish tank", "0 of 8", "about 55", "pea soup", "—"],
          ["", "+ plants", "8 of 8", "about 47", "pea soup", "about 82"],
          ["3  A lot of food, pump OFF", "Fish tank", "0 of 8", "about 21", "pea soup", "—"],
          ["", "+ plants", "0 of 8", "about 1", "pea soup", "about 75"]]
    t = grid(m3, [1.75 * inch, 0.9 * inch, 0.85 * inch, 1.35 * inch, 0.85 * inch, 1.3 * inch])
    t.setStyle(TableStyle([("SPAN", (0, 1), (0, 2)), ("SPAN", (0, 3), (0, 4)), ("SPAN", (0, 5), (0, 6))]))
    k.append(KeepTogether([m3h, t]))
    k.append(P("Watch for these: (a) The plants reduce algae (about 53 " + ARROW + " 36 mg/L in Run 1) but do <b>not</b> remove it all. "
               "(b) In Run 2 the plain tank dies from toxic ammonia. With plants, ammonia stays much lower, so the fish live. "
               "(c) In Run 3 everything dies even with plants: plant leaves release oxygen into the air, not the water. "
               "Low waste numbers after a crash are misleading, because a dead tank has no fish making waste.", "small"))
    k.append(P("Matter and energy check", "h2"))
    k.append(P("1 False (nitrification only changes ammonia into nitrate; the nitrogen stays). 2 True (carbon cycles). "
               "3 False (energy flows through and leaves as heat). 4 True. 5 True.", "key"))
    k.append(P("Reflection examples", "h2"))
    k.append(P("A river flows and brings in water from a whole watershed (farms, towns, rain). Temperature changes with the seasons. "
               "There are many species and sediments. Most model numbers are teaching values, not measurements.", "key"))
    k.append(P("Standards", "h2"))
    k.append(P("Mission 1: HS-LS2-1 (factors affecting carrying capacity). Mission 2: HS-LS2-1, HS-LS2-4 (matter cycling and energy flow). "
               "Mission 3 and CER: HS-LS2-7 (design and evaluate a solution), HS-LS2-5 (photosynthesis and respiration in the carbon cycle). "
               "Matter and energy check: HS-LS2-4.", "small"))
    return k


def build():
    OUT.mkdir(exist_ok=True)
    common = dict(pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.65 * inch, bottomMargin=0.75 * inch)
    w = OUT / "lab-worksheet.pdf"
    SimpleDocTemplate(str(w), title="Goldfish Paradise Lab Worksheet", author="Goldfish Paradise Ecosystem Lab", **common).build(
        worksheet(), onFirstPage=lambda c, d: footer(c, d, "Student worksheet"), onLaterPages=lambda c, d: footer(c, d, "Student worksheet"))
    (ROOT / "teacher").mkdir(exist_ok=True)
    kf = ROOT / "teacher" / "lab-worksheet-teacher-key.pdf"
    SimpleDocTemplate(str(kf), title="Goldfish Paradise Lab Worksheet — Teacher Key", author="Goldfish Paradise Ecosystem Lab", **common).build(
        key(), onFirstPage=lambda c, d: footer(c, d, "Teacher key — do not distribute to students"), onLaterPages=lambda c, d: footer(c, d, "Teacher key — do not distribute to students"))
    print(f"wrote {w.relative_to(ROOT)} and {kf.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
