# Test fixtures — SYNTHETIC, NOT REAL DATA

Files in this folder are **made-up test inputs** for the automated tests of the CSV importer and the
teacher scripts. They use the column layout of a Water Quality Portal download so the parsers can
be tested offline, but every value is invented and every row is labelled
`SYNTHETIC TEST FIXTURE - NOT REAL DATA` with the fake location ID `TEST-0000`.

They must never be copied into `data/datasets/` or shown to students as observations.
The browser importer refuses rows labelled as synthetic.
