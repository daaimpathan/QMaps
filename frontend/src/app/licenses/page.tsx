import React from 'react';
import { PolicyLayout } from '../../components/PolicyLayout';

const dependencies = [
  ['Next.js', 'MIT'], ['React', 'MIT'], ['React DOM', 'MIT'], ['Axios', 'MIT'],
  ['Leaflet', 'BSD-2-Clause'], ['Lucide React', 'ISC'],
  ['TypeScript', 'Apache-2.0'], ['Tailwind CSS', 'MIT'],
  ['PostCSS', 'MIT'], ['Autoprefixer', 'MIT'],
  ['@types/react', 'MIT'], ['@types/react-dom', 'MIT'], ['@types/leaflet', 'MIT'], ['@types/node', 'MIT'],
];

export default function LicensesPage() {
  return (
    <PolicyLayout title="Credits & licenses." eyebrow="Open source and map attribution">
      <section>
        <h2>OpenStreetMap data and tiles</h2>
        <p>Map attribution is shown on the map: © OpenStreetMap contributors. OpenStreetMap data is available under the Open Database License (ODbL). The project currently uses the standard OSM raster tile endpoint for its demo map; data availability does not mean the public tile service is an unlimited commercial hosting service.</p>
        <p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap copyright and license</a> · <a href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noreferrer">OSM tile usage policy</a></p>
        <p>For a public or commercial deployment, select a tile provider or host that fits expected traffic, attribution and service requirements. Keep attribution visible.</p>
      </section>
      <section>
        <h2>Routing service</h2>
        <p>Street geometry is requested through the project API from the OSRM service configured by the deployment. The development default is the public OSRM demo endpoint; production operators should configure a suitable service and review its terms, privacy handling and capacity. See the <a href="https://project-osrm.org/docs/" target="_blank" rel="noreferrer">OSRM API documentation</a>.</p>
      </section>
      <section>
        <h2>Direct frontend dependencies</h2>
        <div className="overflow-hidden rounded-xl border border-sand-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#eeeadb] text-[10px] uppercase tracking-wider text-stone-600"><tr><th className="px-4 py-2.5">Package</th><th className="px-4 py-2.5">License identifier</th></tr></thead>
            <tbody className="divide-y divide-sand-200 bg-sand-50">{dependencies.map(([name, license]) => <tr key={name}><td className="px-4 py-2.5 font-medium text-olive-950">{name}</td><td className="px-4 py-2.5 text-stone-600">{license}</td></tr>)}</tbody>
          </table>
        </div>
        <p>An unused <code>react-leaflet</code> dependency was removed from the app manifest after checking that the source did not import it. The upstream package used Hippocratic-2.1; see its <a href="https://github.com/PaulLeCam/react-leaflet/blob/master/LICENSE.md" target="_blank" rel="noreferrer">license text</a> if your team considers adding it back.</p>
        <p>The repository’s <code>THIRD_PARTY_NOTICES.md</code> gives the full direct-dependency inventory. A full transitive dependency and distribution-license audit has not yet been completed.</p>
      </section>
      <section>
        <h2>Project artwork and project license</h2>
        <p>The QMaps mark and isometric delivery illustration are original vector artwork authored in this project for this interface. The repository does not currently declare a project-wide QMaps license; its owner should choose and publish one before external redistribution or commercial release.</p>
      </section>
    </PolicyLayout>
  );
}
