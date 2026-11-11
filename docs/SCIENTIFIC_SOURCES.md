# Scientific sources and how each one is used

"Used for" says exactly what we took from each source. Anything not listed as taken from a source is an illustrative teaching value (see the parameter table in [MODEL_CARD.md](MODEL_CARD.md)).

## Aquatic ecosystem modelling

**US EPA — AQUATOX.**
* Overview: <https://www.epa.gov/hydrowq/what-does-aquatox-do>
* Release 3.1 supporting documents: <https://www.epa.gov/hydrowq/aquatox-31-supporting-documents>. The Release 3.1 Technical Documentation (Park & Clough, April 2014, EPA-820-R-14-007) was read from the EPA web-archive copy: <https://19january2021snapshot.epa.gov/sites/static/files/2014-03/documents/technical-documentation-3-1.pdf>
* Release 3.2 Technical Documentation: Park, R.A. & Clough, J.S. (2018), EPA/600/B-18/241. <https://www.epa.gov/sites/default/files/2018-09/documents/aquatox_tech_doc_3.2.pdf>

| What we used | Where in AQUATOX |
|---|---|
| Producer nutrient limitation = Michaelis–Menten factor per nutrient, combined by minimum (Liebig) | 3.2 eqs. 52–54 and 56, p. 79–81 |
| Form of the light- and nutrient-stress mortality term | 3.2 eqs. 67, 69, p. 89 |
| Algal N and P fractions of dry weight (0.059, 0.007) | 3.2 Table 13, p. 176 (citing Sterner & Elser 2002) |
| O₂ half-saturation for aerobic decomposition, 0.5 g/m³ in the water column | 3.2 p. 160 (HalfSatO) |
| Nitrification ∝ rate × O₂ correction × T correction × ammonia; denitrification ∝ (1 − O₂ correction) × nitrate | 3.2 eqs. 175–176, p. 169–170 |
| Structure of the dissolved-oxygen balance | 3.2 eq. 187, p. 185 |
| Reaeration = K_reaer (O₂sat − O₂) and temperature coefficient θ = 1.024 | 3.2 eqs. 191 and 198, p. 186–188 |
| Scaling of the CO₂ exchange coefficient from O₂ reaeration by molecular weights, (32/44)^0.25 | 3.1 eq. 212 |
| Chlorophyll-a carbon ratio, 28 µg C per µg chl-a (non-cyanobacterial phytoplankton) | 3.1 §4.1 |
| List of processes simplified or omitted (sediment diagenesis, internal nutrients, multiple taxa, toxicity models, hydrodynamics) | 3.2 chapters 2–7 (see MODEL_CARD §5–6) |

We did **not** take AQUATOX's site-specific parameter libraries, and the model is **not** an implementation of AQUATOX.

**Legović, T. & Cruzado, A. (1997).** A model of phytoplankton growth on multiple nutrients based on the Michaelis-Menten-Monod uptake, Droop's growth and Liebig's law. *Ecological Modelling* 99(1): 19–31. <https://doi.org/10.1016/S0304-3800(96)01919-9>
*Used for:* the conceptual basis for combining Monod-type nutrient responses with Liebig's law across several nutrients. *Not used:* the paper's Droop internal-quota growth (we use fixed composition) and its parameter values. The model card's future-work section proposes a Droop-quota version.

## Dissolved oxygen, ammonia and chemistry

**US EPA CADDIS, Dissolved Oxygen** (Volume 2: Sources, Stressors and Responses). <https://www.epa.gov/caddis/dissolved-oxygen>. The EPA site now marks CADDIS Volume 2 as retired. An archived copy: <https://19january2021snapshot.epa.gov/caddis-vol2/caddis-volume-2-sources-stressors-responses-dissolved-oxygen_.html>.
*Used for:* the conceptual pathway nutrients → plant growth → day/night oxygen swings → decomposition oxygen demand, and the caution that low-oxygen effects depend on the organism. This is why the stress threshold is a student-set parameter, not a universal constant.

**US Geological Survey (2011).** Change to solubility equations for oxygen in water. Office of Water Quality Technical Memorandum 2011.03. <https://water.usgs.gov/water-resources/memos/documents/WQ.2011.03.pdf>. This adopts **Benson, B.B. & Krause, D. (1980)** *Limnology and Oceanography* 25: 662–671, and **(1984)** *Limnol. Oceanogr.* 29: 620–632.
*Used for:* the oxygen-saturation equation.

**Emerson, K., Russo, R.C., Lund, R.E. & Thurston, R.V. (1975).** Aqueous ammonia equilibrium calculations: effect of pH and temperature. *J. Fisheries Research Board of Canada* 32: 2379–2383.
*Used for:* pKa = 0.09018 + 2729.92/T and the un-ionized NH₃ fraction.

Standard stoichiometry: nitrification NH₄⁺ + 2 O₂ → NO₃⁻ + 2 H⁺ + H₂O (4.57 g O₂ per g N); aerobic respiration with RQ = 1 (32/12 g O₂ per g C); denitrification 5 CH₂O + 4 NO₃⁻ → 2 N₂ + … (60/56 g C per g N).

## Energy flow

**Lindeman, R.L. (1942).** The trophic-dynamic aspect of ecology. *Ecology* 23: 399–417. The origin of trophic-level energy-efficiency reasoning.
**Pauly, D. & Christensen, V. (1995).** Primary production required to sustain global fisheries. *Nature* 374: 255–257. <https://doi.org/10.1038/374255a0>. Estimated a mean transfer efficiency between trophic levels of about 10 % from 48 aquatic food-web models.
*Used for:* the classroom "~10 % rule" reference, presented as an average with wide variation, **not** imposed on the model.

**Sterner, R.W. & Elser, J.J. (2002).** *Ecological Stoichiometry*. Princeton University Press. Algal N and P fractions, as tabulated in AQUATOX 3.2 Table 13.

## Environmental data sources

**Water Quality Portal (WQP)**, a cooperative service of USGS, US EPA and the National Water Quality Monitoring Council. <https://www.waterqualitydata.us/> · Web services: <https://www.waterqualitydata.us/webservices_documentation/> · WQX 3.0 (beta) services: <https://www.waterqualitydata.us/beta/webservices_documentation/>
The portal and USGS dataRetrieval documentation note that the legacy WQX 2.2 profiles (`/data/…`) do not include USGS data added after March 11, 2024. Newer data are in the WQX 3.0 profiles (`/wqx3/…`), which are still in development. `scripts/fetch_wqp.py` supports both.

**USGS Water Data APIs** (OGC API, v1). <https://api.waterdata.usgs.gov/> · <https://api.waterdata.usgs.gov/docs/> · <https://api.waterdata.usgs.gov/docs/ogcapi/>
USGS has announced that the legacy WaterServices APIs (waterservices.usgs.gov) will be decommissioned in the first quarter of 2027 (<https://waterdata.usgs.gov/blog/api-waterservices-decom>). A later USGS notice gives February 22, 2027, with planned outages beforehand. This project does not use WaterServices.

**US EPA Nitrogen and Phosphorus Pollution Data Access Tool.** <https://www.epa.gov/waterdata/epa-nitrogen-and-phosphorus-pollution-data-access-tool>. A geospatial viewer with downloadable layers: USGS SPARROW nitrogen and phosphorus loads and yields, monitoring sites with N/P data, National Aquatic Resource Surveys values, facilities likely to discharge N/P, and waters with N/P TMDLs. Suggested for watershed-scale extensions (see the Teacher Guide). It is not imported into the app, because its data are watershed layers, not time series.

**US EPA Nutrient Data.** <https://www.epa.gov/nutrientpollution/nutrient-data>. Links to the Nutrient Indicators Dataset (state-level indicators of nutrient sources, impacts and actions) and the National Aquatic Resource Surveys (statistical surveys of lakes, rivers and streams, coasts and wetlands). Suggested for national-context discussion.

**Local context.** The Saginaw Bay Monitoring Consortium (Saginaw Valley State University and partners) began weekly tributary sampling in summer 2023: <https://www.svsu.edu/sbesi/research/saginawbaymonitoringconsortium/>. Check whether its data are available in the WQP before planning to use them.

## Sources we could not access while building this version

Some EPA pages (including the AQUATOX 3.1 supporting-documents page and the CADDIS dissolved-oxygen page) could not be fetched directly from our build environment. Their content was read from EPA's official archived snapshots or from search-engine copies of the same pages. The Water Quality Portal and USGS data services could not be queried from the build environment. As a result, **no observation data are bundled**: the teacher scripts must be run on a normal internet connection.
