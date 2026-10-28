# Flat product categories implementation plan

**Goal:** Replace product-group hierarchy with the 26 existing independent product categories.

**Constraints:** Keep category, criteria, product, assignment, and score IDs. Continue reading historical snapshots. Do not delete additional categories or run seed against existing data during migration.

- Update schema, seed, and migration to preserve existing category records and order the 26 official categories.
- Remove group-dependent availability, filtering, catalog management, reporting, and live snapshot fields. Support existing snapshots.
- Update shared contracts and all product, assignment, reporting, and print interfaces to use categories directly.
- Verify migration and historical snapshots; run backend and frontend type checks and relevant tests.
