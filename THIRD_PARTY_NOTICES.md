# Third-party notices

This inventory reflects the direct dependencies declared in `frontend/package.json` as of 27 September 2026. The identifiers below are read from the checked-in npm lockfile; consult each package's distributed license text for the full terms.

| Direct frontend dependency | License identifier |
| --- | --- |
| `next` | MIT |
| `react` | MIT |
| `react-dom` | MIT |
| `axios` | MIT |
| `leaflet` | BSD-2-Clause |
| `lucide-react` | ISC |
| `@types/react` | MIT |
| `@types/react-dom` | MIT |
| `@types/leaflet` | MIT |
| `@types/node` | MIT |
| `typescript` | Apache-2.0 |
| `tailwindcss` | MIT |
| `postcss` | MIT |
| `autoprefixer` | MIT |

`react-leaflet` and its `@react-leaflet/core` dependency were unused by the source and have been removed from the direct dependency manifest and lockfile. Their package metadata declared Hippocratic-2.1; check the upstream license if either is reconsidered.

## Map data, tiles and routing

- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), made available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
- The app displays OpenStreetMap attribution on the map. The default raster tile endpoint is governed by the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Its public infrastructure is not a production capacity or uptime commitment.
- Street geometry is requested through the API from the configured OSRM service. The default development endpoint is the public OSRM demo service; see [OSRM API documentation](https://project-osrm.org/docs/). Configure a suitable production service and review its current terms before deployment.

## Project assets and audit scope

The QMaps logo and isometric delivery illustration are original, AI-assisted SVG/code assets created for this project; they are not copied stock imagery. The repository does not currently publish a project-wide QMaps license. The team should choose one before redistribution.

This is a direct-dependency inventory, not a full Software Bill of Materials or transitive dependency audit. Before commercial distribution, generate and review a complete dependency/license report for the shipped build, include required upstream license texts and notices, and audit any additional data, icons, imagery or uploaded content introduced after this inventory.
