import React from 'react';
import { PolicyLayout } from '../../components/PolicyLayout';

export default function TermsPage() {
  return (
    <PolicyLayout title="Terms for the project demo." eyebrow="Use of QMaps">
      <section>
        <h2>What QMaps is</h2>
        <p>QMaps is a route-planning and dispatch research demo for Navi Mumbai. It connects a web interface to the optimizer and benchmark outputs present in this project. It is not a production navigation, fleet-management or emergency-response service.</p>
      </section>
      <section>
        <h2>Routes and traffic are estimates</h2>
        <p>Optimization results depend on the selected algorithm, supplied inputs and current project implementation. Displayed road geometry and turn instructions come from the configured routing service. Travel-time and congestion values may be modeled or manually entered; QMaps does not currently provide a live traffic feed or guarantee real-time incident detection, arrival times, delivery-window compliance or route availability.</p>
        <p>Drivers and dispatchers must use their judgment, obey road signs and local rules, and verify that a route is safe and suitable for the vehicle. Do not rely on QMaps as the sole source of directions.</p>
      </section>
      <section>
        <h2>Operator responsibilities</h2>
        <p>Use data you are authorized to process. The demo driver selector is not an account or identity check. Operators are responsible for protecting access to the API and for obtaining any permissions required for driver or customer data in their operating location.</p>
      </section>
      <section>
        <h2>Third-party services and software</h2>
        <p>Map tiles, map data, routing services and open-source software have their own terms and licenses. See <a href="/licenses">Licenses & map credits</a>. The public OSM tile service and public OSRM demo endpoint are development defaults; neither should be treated as a production service-level commitment.</p>
      </section>
      <section>
        <h2>Availability, payment and age</h2>
        <p>This repository describes a project demo and includes no paid subscription, checkout or refund process. No age-restricted feature is implemented. If the product is offered commercially or to minors, the operating organization must publish appropriate service, payment, cancellation, refund and age-related terms before launch.</p>
      </section>
      <section>
        <h2>Advice and legal review</h2>
        <p>QMaps provides logistics estimates, not legal, financial, medical or other professional advice. This page is a project-level draft, not a lawyer-approved agreement. The deploying organization should identify itself and have the final terms reviewed for its jurisdiction.</p>
      </section>
    </PolicyLayout>
  );
}
