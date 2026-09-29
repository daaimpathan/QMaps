import React from 'react';

/** Original, static isometric illustration for the landing page (not a live map). */
export const DeliveryScene: React.FC = () => (
  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 820 590" role="img" aria-labelledby="delivery-scene-title" preserveAspectRatio="xMidYMid slice">
    <title id="delivery-scene-title">Illustration of a delivery van leaving a Navi Mumbai depot for three stops</title>
    <defs>
      <filter id="scene-shadow" x="-25%" y="-25%" width="150%" height="160%">
        <feDropShadow dx="0" dy="13" stdDeviation="12" floodColor="#27301d" floodOpacity="0.16" />
      </filter>
      <pattern id="scene-grid" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="skewY(-28)">
        <path d="M24 0H0V24" fill="none" stroke="#aeb098" strokeOpacity=".25" strokeWidth="1" />
      </pattern>
      <linearGradient id="truck-side" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#667744" />
        <stop offset="1" stopColor="#485934" />
      </linearGradient>
      <linearGradient id="truck-front" x1="0" x2="0.9" y1="0" y2="1">
        <stop offset="0" stopColor="#82915b" />
        <stop offset="1" stopColor="#657344" />
      </linearGradient>
    </defs>

    <ellipse cx="482" cy="277" rx="327" ry="214" fill="#f8f5e9" opacity=".68" />
    <path d="M0 343 428 95l392 226-428 247Z" fill="#d9dbc9" opacity=".62" />
    <path d="M0 343 428 95l392 226-428 247Z" fill="url(#scene-grid)" />

    {/* Two neighborhood blocks with isometric roofs and shaded faces. */}
    <g opacity=".95">
      <path d="m71 200 93-54 75 43-94 55Z" fill="#b7bba2" />
      <path d="m71 200 74 44v52l-74-43Z" fill="#9da388" />
      <path d="m145 244 94-55v54l-94 53Z" fill="#8c9574" />
      <path d="m83 205 79-46 62 35-80 47Z" fill="#e5e1ce" />
      <path d="m108 211 29-17 23 13-29 17Z" fill="#c9bfa5" />
      <path d="m164 177 42 24" stroke="#faf8ee" strokeWidth="5" />
      <path d="m553 113 96-55 101 58-97 57Z" fill="#b4b89e" />
      <path d="m553 113 100 60v59l-100-59Z" fill="#909877" />
      <path d="m653 173 97-57v57l-97 59Z" fill="#7c8768" />
      <path d="m568 114 80-46 80 47-81 48Z" fill="#e8e3d1" />
      <path d="m607 122 37-21 28 16-37 22Z" fill="#c7bda5" />
      <path d="m687 103 29 17" stroke="#faf8ee" strokeWidth="5" />
      <path d="m278 344 72-42 55 32-72 43Z" fill="#d1cbb7" />
      <path d="m278 344 55 33v37l-55-32Z" fill="#b5ae98" />
      <path d="m333 377 72-43v38l-72 42Z" fill="#9e9a82" />
      <path d="m289 344 61-35 41 24-60 36Z" fill="#ebe5d4" />
    </g>

    {/* Street network */}
    <g fill="none" strokeLinecap="round">
      <path d="m70 427 396-228 301 175" stroke="#f5f1e4" strokeWidth="48" />
      <path d="m125 172 352 207 279-162" stroke="#f5f1e4" strokeWidth="35" />
      <path d="m70 427 396-228 301 175" stroke="#c7c8b4" strokeWidth="1.5" />
      <path d="m125 172 352 207 279-162" stroke="#c7c8b4" strokeWidth="1.5" />
      <path d="m93 414 365-210 289 169" stroke="#c9b985" strokeWidth="2" strokeDasharray="10 12" opacity=".8" />
    </g>

    {/* Delivery path intentionally uses a distinct ink color from the map. */}
    <path d="M516 309 C450 277 425 246 371 231 S286 233 244 196 S180 165 150 184" fill="none" stroke="#fbf9f2" strokeWidth="15" strokeLinecap="round" />
    <path d="M516 309 C450 277 425 246 371 231 S286 233 244 196 S180 165 150 184" fill="none" stroke="#d35a35" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 12" />

    {/* Depot block */}
    <g filter="url(#scene-shadow)">
      <path d="m481 242 70-41 82 48-71 43Z" fill="#758353" />
      <path d="m481 242 81 50v55l-81-49Z" fill="#53633d" />
      <path d="m562 292 71-43v55l-71 43Z" fill="#3d4a2d" />
      <path d="m496 241 57-33 65 39-58 34Z" fill="#aeb78c" />
      <path d="m531 229 24-14 28 17-24 14Z" fill="#e9e6d8" />
      <path d="m535 232 19-11 20 12-20 12Z" fill="#758353" />
      <path d="m537 242 1 35 20 12v-35Z" fill="#d8d6c5" />
      <path d="m562 257 16-9v32l-16 9Z" fill="#bbc0a6" />
      <path d="m578 248 16 10v16l-16-10Z" fill="#ebe8d9" />
      <rect x="477" y="332" width="120" height="27" rx="7" fill="#fbf9f2" />
      <text x="537" y="350" textAnchor="middle" fill="#455334" fontSize="10" fontWeight="700" letterSpacing="1.2">TURBHE DEPOT</text>
    </g>

    {/* Stop pins */}
    {[
      { x: 150, y: 174, n: '03', name: 'VASHI' },
      { x: 244, y: 185, n: '02', name: 'APMC' },
      { x: 371, y: 220, n: '01', name: 'SANPADA' },
    ].map((stop) => (
      <g key={stop.n} transform={`translate(${stop.x} ${stop.y})`}>
        <path d="M0 0c-15 0-26 11-26 25 0 17 26 42 26 42s26-25 26-42C26 11 15 0 0 0Z" fill="#f9f6eb" stroke="#53633d" strokeWidth="2" />
        <circle cy="24" r="16" fill="#53633d" />
        <text y="28" textAnchor="middle" fill="#fffdf6" fontSize="11" fontWeight="700">{stop.n}</text>
        <rect x="-31" y="69" width="62" height="20" rx="6" fill="#fbf9f2" stroke="#ddd9c8" />
        <text y="82" textAnchor="middle" fill="#4b5639" fontSize="8" fontWeight="700" letterSpacing=".8">{stop.name}</text>
      </g>
    ))}

    {/* Original isometric delivery van */}
    <g transform="translate(354 303)" filter="url(#scene-shadow)">
      <ellipse cx="51" cy="86" rx="72" ry="22" fill="#46513a" opacity=".2" />
      <path d="m-4 36 74-43 86 48-75 44Z" fill="#e5e0ce" />
      <path d="m-4 36 81 49v25l-81-48Z" fill="#c9c3af" />
      <path d="m77 85 79-44v24l-79 45Z" fill="#aaa690" />
      {/* cargo box */}
      <path d="m15 7 52-30 76 44-54 31Z" fill="#aab487" />
      <path d="m15 7 74 44v39L15 46Z" fill="url(#truck-side)" />
      <path d="m89 51 54-30v37L89 90Z" fill="#404e30" />
      <path d="m25 11 42-24 59 34-43 25Z" fill="#d7dcc1" />
      <path d="m41 14 18-11 19 11-19 11Z" fill="#fbf9f2" opacity=".83" />
      {/* cab */}
      <path d="m89 51 39-22 38 22-40 23Z" fill="#a2ae7d" />
      <path d="m126 74 40-23v30l-40 24Z" fill="url(#truck-front)" />
      <path d="m89 51 37 23v30L89 82Z" fill="#5d6b43" />
      <path d="m133 51 25-14 25 15-25 15Z" fill="#d8dfca" />
      <path d="m138 52 18-10 17 10-18 11Z" fill="#516342" />
      <path d="m166 51 17-10v32l-17 10Z" fill="#657448" />
      <path d="m173 48 10-6 6 4v27l-16 9Z" fill="#e5d391" />
      {/* wheels */}
      <path d="m18 62 18 11v26L18 88Z" fill="#34372e" />
      <ellipse cx="29" cy="88" rx="12" ry="8" transform="rotate(31 29 88)" fill="#34372e" />
      <ellipse cx="29" cy="88" rx="5" ry="3.5" transform="rotate(31 29 88)" fill="#d5d0bd" />
      <path d="m103 92 19 11v25l-19-11Z" fill="#34372e" />
      <ellipse cx="115" cy="119" rx="12" ry="8" transform="rotate(31 115 119)" fill="#34372e" />
      <ellipse cx="115" cy="119" rx="5" ry="3.5" transform="rotate(31 115 119)" fill="#d5d0bd" />
      <path d="m157 81 18 10v25l-18-10Z" fill="#34372e" />
      <ellipse cx="168" cy="107" rx="12" ry="8" transform="rotate(31 168 107)" fill="#34372e" />
      <ellipse cx="168" cy="107" rx="5" ry="3.5" transform="rotate(31 168 107)" fill="#d5d0bd" />
      <path d="m39 25 27 16" stroke="#c8d0af" strokeWidth="2" opacity=".6" />
      <text x="45" y="60" fill="#f8f6ec" fontSize="11" fontWeight="700" letterSpacing="1.4" transform="skewY(30)">QMAPS</text>
    </g>

    <g transform="translate(632 365)">
      <circle r="4" fill="#d35a35" />
      <circle r="9" fill="none" stroke="#d35a35" strokeOpacity=".25" />
      <path d="M15 0h43" stroke="#727b5b" strokeWidth="1" />
      <text x="64" y="4" fill="#596448" fontSize="9" fontWeight="600" letterSpacing=".8">ROUTE IN PROGRESS</text>
    </g>
  </svg>
);
