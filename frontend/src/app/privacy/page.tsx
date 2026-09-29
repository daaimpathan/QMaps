import React from 'react';
import { PolicyLayout } from '../../components/PolicyLayout';

export default function PrivacyPage() {
  return (
    <PolicyLayout title="Privacy, in plain language." eyebrow="Your data in QMaps">
      <section>
        <h2>What this demo handles</h2>
        <p>When an operator prepares a dispatch, QMaps can process delivery names and coordinates, package demand, service times, time windows and priority; vehicle names, capacity and the driver name or phone entered for a vehicle; the selected traffic scenario and manual slowdown inputs; and delivery completion updates made in the driver view.</p>
      </section>
      <section>
        <h2>Why and where it is processed</h2>
        <p>The QMaps frontend sends dispatch inputs to the project API so the existing optimizer can generate a plan and the interface can display routes and progress. The API currently keeps the active dispatch and driver progress in process memory. It has no user accounts or persistent database in this demo; restarting the API clears that in-memory state.</p>
        <p>The map loads tiles from OpenStreetMap’s tile service, which receives normal browser network information such as your IP address and the requested map tiles. For street geometry, the API sends route coordinates to the OSRM service configured for this project. If no <code>QMAPS_OSRM_BASE_URL</code> is set, the API uses the public OSRM demo service. See the <a href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noreferrer">OSM tile policy</a> and <a href="https://project-osrm.org/docs/" target="_blank" rel="noreferrer">OSRM API documentation</a>.</p>
      </section>
      <section>
        <h2>Demo access and safeguards</h2>
        <p>The current driver picker is a demo selector, not authentication. The API does not enforce driver-specific access: a person who can reach it may be able to request the shared dispatch. Do not enter real customer addresses, personal driver details or confidential fleet data into an internet-accessible deployment until authentication, access controls, secure hosting, retention rules and an accountable privacy contact are in place.</p>
        <p>Before optimization, the admin interface asks the operator to confirm they are authorized to submit the operational details and that route coordinates may be sent to the configured map/routing services. This is an operational acknowledgement, not a claim that it satisfies every jurisdiction’s legal consent requirements.</p>
      </section>
      <section>
        <h2>Correction and deletion</h2>
        <p>Operators can edit or remove delivery inputs in the dispatch interface and generate a replacement plan. This demo has no account-level export or erase request workflow, and no dedicated endpoint to clear one person’s dispatch. Its active in-memory dispatch is removed when the API process is restarted, which clears all demo dispatch state. A production operator should provide a verified, user-level access and deletion process before collecting real personal data.</p>
      </section>
      <section>
        <h2>Cookies and analytics</h2>
        <p>The QMaps frontend does not currently set its own cookies, use advertising trackers or include analytics. More detail is on the <a href="/cookies">Cookies page</a>. Third-party map and routing requests remain subject to their providers’ terms and privacy practices.</p>
      </section>
      <section>
        <h2>Operator and policy owner</h2>
        <p>This repository does not identify a legal entity, privacy contact or deployment operator. The team deploying QMaps must add those details, confirm the applicable jurisdiction and retention period, and have this draft reviewed before public or commercial use.</p>
      </section>
    </PolicyLayout>
  );
}
