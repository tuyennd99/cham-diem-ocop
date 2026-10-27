# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are OCOP staff coordinating product submissions, judge assignments, evaluation completion, and reporting. This user model was confirmed by the product owner.

Secondary users are registrants preparing and managing product applications, judges completing assigned criteria, and public visitors browsing available product information.

## Product Purpose

Support the OCOP product-registration and evaluation workflow from application submission through assignment, judging, status tracking, and reporting. A business success measure has not been confirmed.

## Positioning

Open: no market position or unique differentiator has been confirmed. The current implementation is organized around OCOP product categories and criteria, scoped assignments, evidence, multi-judge scoring, and reports; treat this as observed product behavior rather than a competitive claim.

## Operating Context

- Vietnamese-language web product with public catalog pages and authenticated registrant, judge, and staff workflows.
- Registrants can create, edit, save, and submit product applications; the registration form follows Mẫu 01 and supports optional product photos and evidence files.
- Judges work from assigned products and criteria, save evaluations, and submit score sheets.
- Staff manage users, organization units, categories, criteria, assignments, products, and evaluation reports. The product includes print views for registration and evaluation documents.

## Capabilities and Constraints

- Product states are `DRAFT`, `SUBMITTED`, `SCORING`, and `COMPLETED`. Keep product status distinct from evaluation-sheet status.
- The shared access model uses `REGISTRANT`, `JUDGE`, `ADMIN`, and `VIEWER` roles, with staff permissions `MANAGE`, `VIEW`, and `SCORE`.
- Judges select configured score options for assigned criteria. Assignments can be limited to a subset of criteria.
- Public product pages expose products from `SUBMITTED` onward (`Đã tiếp nhận`, `SCORING`, and `COMPLETED`) using public information and images only; evidence files require authorization. Do not expose private evidence.
- Reports display calculated evaluation results. Current report copy distinguishes system-calculated points from an official OCOP recognition decision; preserve that distinction unless the product owner changes it.

## Evidence on Hand

- The web app README and current source describe public catalog, registration, judge evaluation, staff administration, reporting, and print workflows.
- Current print views are implemented in `apps/web/src/components/print/OcopPrintSheets.tsx`.
- No customer testimonials, case studies, or external outcome claims were confirmed in the reviewed project documentation; do not invent them.

## Product Principles

Working principles inferred from current product behavior; validate before treating them as business commitments:

- Keep evaluation outcomes tied to the submitted application and assigned criteria.
- Enforce role, assignment, and evidence-access boundaries consistently.
- Keep computed scores and stars distinct from formal recognition decisions.

## Open Decisions

- Confirm the intended market position, differentiator, and success measure.
- Confirm whether the current UI label “OCOP Đánh Giá” is the formal product name and whether there are binding brand or voice commitments.
- No product-specific accessibility standard or inclusion requirements have been confirmed.
