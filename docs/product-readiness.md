# QMaps product-readiness checklist

Scope: maps the 20 items in the supplied product checklist to this repository as inspected on 27 September 2026. “In demo” means the interface or documentation exists; it is not a claim of legal compliance or commercial readiness.

## Before a real-company pilot

The current driver selector is not authentication, the API does not enforce per-driver access, and dispatch state is held in process memory. A reachable API can expose the shared dispatch, which may contain driver and customer location details. Do not place real personal or confidential data on a public deployment until identity, role-based server authorization, secure hosting, retention and user-level deletion are implemented and reviewed. Replace public OSM tiles and the public OSRM demo endpoint with services suitable for the intended traffic and service levels.

## Supplied checklist

| # | Item | Repository status | Evidence / action |
|---:|---|---|---|
| 1 | Privacy policy | Draft in demo | `/privacy` explains the input fields, process-memory dispatch state and external map/routing requests. Deployment owner, legal identity, contact and jurisdiction still need to be supplied. |
| 2 | Terms and conditions | Draft in demo | `/terms` covers the demo, route estimates, third-party services and operator responsibilities. Obtain jurisdiction-specific review before launch. |
| 3 | Cookie policy | In demo | `/cookies` states that the QMaps frontend does not currently set its own cookies or use analytics/ad tracking. |
| 4 | Decide whether cookie consent is required | Checked for current source | No QMaps cookie/local-storage feature was found; no optional-cookie banner is shown. Recheck after adding login, analytics, preferences or production monitoring. Third-party services have their own practices. |
| 5 | Consent/permission at forms collecting personal data | Operational acknowledgement in demo | Admin must confirm authorization to use driver/delivery details and disclosure that coordinates go to mapping/routing services before optimization. This is not presented as a legally sufficient consent mechanism. Add the correct legal basis and notice for the deployment jurisdiction. |
| 6 | Explain the collected data | In demo | Privacy page lists stop names/coordinates, package demand, service/window/priority, vehicle capacity, driver details, traffic inputs and completion updates. |
| 7 | Explain why each item is collected | In demo | Values are submitted to the optimizer, used for street geometry/display and used to track demo delivery progress. Avoid collecting fields that a real deployment does not need. |
| 8 | Provide deletion requests | Open | There is no user-level deletion request UI or API. Restarting the API clears all shared in-memory demo dispatch state; implement verified, scoped deletion before real-data use. |
| 9 | Provide correction requests | Partial | Admin can edit/remove delivery inputs and regenerate a route. There is no account-level personal-data correction workflow; add one if real driver/customer data is retained. |
| 10 | Review every third-party API’s terms | Disclosed; deployment action open | OSM tile and OSRM documentation/policy links are shown. The deployment owner must review the actual configured services, limits, privacy terms and any commercial agreements. |
| 11 | Check IP issues with AI-generated content | Action identified | The QMaps mark and hero illustration are original AI-assisted SVG/code assets for this project. Review tool/output terms and ownership before commercial release. |
| 12 | Review open-source dependency licenses | Partial | `THIRD_PARTY_NOTICES.md` records license IDs from the npm lockfile for direct dependencies. Generate a complete transitive SBOM/license report and include required full notices before distribution. |
| 13 | Avoid unlicensed copyrighted assets | In demo; release audit open | The new mark/illustration are custom SVG/code, not copied stock imagery. Audit future imports, supplied datasets, screenshots and uploaded material. |
| 14 | Add required attribution | In demo | Leaflet map keeps visible © OpenStreetMap contributors attribution. Preserve it; check the selected tile provider’s attribution terms if changed. |
| 15 | Check licensing for user-generated content | Not applicable to current flow | The app has no public posting, file upload or UGC gallery. If comments, uploads or shared customer content are added, define permission, moderation, retention and license terms. |
| 16 | Add age restrictions if needed | Not applicable to current feature set | No age-gated feature or consumer account flow is implemented. Reassess product audience and local rules before launch. |
| 17 | Add high-risk advice disclaimers | Narrow disclaimer in demo | Terms clarify that route/ETA/traffic information is an estimate, not a live safety guarantee; drivers must follow signs and local rules. The product does not offer medical/legal/financial advice. |
| 18 | Refund/cancellation policy if charging | Not applicable today | This repository has no checkout or subscription. Add pricing, renewal, cancellation and refund terms before charging. |
| 19 | Keep marketing claims accurate | In demo | Landing page describes supported workflows without performance claims. Benchmark screens must continue to show only values present in saved benchmark files; validate every published result and comparison. |
| 20 | Final legal audit and lawyer review | Open | No legal review is evidenced in this repository. The operating entity should appoint an owner and obtain review for its jurisdictions, contracts and data flows. |

## Product operations still to decide

- Identify the service operator, privacy contact, jurisdiction and retention schedule.
- Add authentication and server-side role/vehicle authorization; a client-side vehicle picker is not access control.
- Add persistent storage with scoped access, auditability, backup and deletion behavior if dispatch history is required.
- Configure production map tiles and routing; the public OSM tile server is best-effort and public OSRM demo is not a production SLA.
- Decide how drivers receive route updates. Current refresh is periodic API polling; no push notification or GPS-based live tracking is implemented.
- Publish a QMaps project license and complete a release-specific dependency/data/artwork review.
