import React from 'react';
import { PolicyLayout } from '../../components/PolicyLayout';

export default function CookiesPage() {
  return (
    <PolicyLayout title="No QMaps tracking cookies." eyebrow="Cookies and browser storage">
      <section>
        <h2>What the app uses today</h2>
        <p>The QMaps frontend does not set its own cookies, use analytics or advertising trackers, or store a user profile in local browser storage. The interface therefore does not show an optional-cookie consent banner.</p>
      </section>
      <section>
        <h2>Map and routing requests</h2>
        <p>Opening a map makes requests to the configured OpenStreetMap tile host. Route generation can also send coordinates from the API to the configured OSRM routing service. These requests may expose ordinary connection metadata to those services and are governed by their own terms and policies; they are not QMaps cookies. See the <a href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noreferrer">OpenStreetMap tile policy</a>.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>If a deployed version adds login sessions, preference storage, analytics or other non-essential cookies, its operator should update this notice and add any consent controls required by the applicable law before enabling them.</p>
      </section>
    </PolicyLayout>
  );
}
