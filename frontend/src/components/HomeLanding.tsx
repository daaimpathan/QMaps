'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  MapPinned,
  PackageCheck,
  Route,
  Shield,
  Truck,
  Waves,
  Zap,
} from 'lucide-react';
import { AlgorithmInfo, NaviLocation, OptimizationResult, TrafficSegment } from '../types';
import { RouteAtlas3D } from './RouteAtlas3D';

export type AppSection = 'home' | 'admin' | 'driver' | 'benchmarks';

interface HomeLandingProps {
  algorithms: AlgorithmInfo[];
  backendConnected: boolean;
  depot: NaviLocation;
  deliveries: NaviLocation[];
  result: OptimizationResult | null;
  isOptimizing: boolean;
  algorithmName: string;
  trafficSegments: TrafficSegment[];
  onRunOptimization: () => void;
  onNavigate: (section: AppSection) => void;
}

const methodDetails: Record<string, { family: string; purpose: string }> = {
  astar: { family: 'Classical · reference', purpose: 'Shortest-path reference; not a multi-vehicle VRP solver.' },
  pso: { family: 'Classical · swarm', purpose: 'Baseline swarm search over delivery sequences.' },
  qpso: { family: 'Quantum-inspired · swarm', purpose: 'Quantum-behaved search compared directly with PSO.' },
  aco: { family: 'Classical · ant colony', purpose: 'Pheromone-based construction for route sequences.' },
  qaco: { family: 'Quantum-inspired · ant colony', purpose: 'Quantum rotation gates guide candidate route construction.' },
  qa_qpso: { family: 'Hybrid · proposed', purpose: 'QACO construction followed by QPSO refinement.' },
};

const operatingPrinciples = [
  {
    icon: PackageCheck,
    number: '01',
    title: 'Capacity stays real',
    detail: 'Each vehicle route is split into capacity-feasible trips before it reaches dispatch.',
  },
  {
    icon: Clock3,
    number: '02',
    title: 'Time windows matter',
    detail: 'Delivery sequence and arrival times account for each stop’s ready and due times.',
  },
  {
    icon: Waves,
    number: '03',
    title: 'Roads shape the plan',
    detail: 'Street-following geometry and modeled traffic inform the route view for each driver.',
  },
];

export const HomeLanding: React.FC<HomeLandingProps> = ({
  algorithms,
  backendConnected,
  depot,
  deliveries,
  result,
  isOptimizing,
  algorithmName,
  trafficSegments,
  onRunOptimization,
  onNavigate,
}) => (
  <main className="landing-page text-olive-950">
    <div className="landing-shell">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-noise" aria-hidden="true" />
        <div className="landing-hero-grid">
          <div className="landing-copy">
            <div className="landing-eyebrow">
              <MapPinned className="h-4 w-4" />
              <span>NAVI MUMBAI · ROUTE OPERATIONS</span>
              <i />
              <span className="landing-eyebrow-state"><b className={backendConnected ? 'is-connected' : ''} />{backendConnected ? 'ENGINE CONNECTED' : 'ENGINE STANDBY'}</span>
            </div>

            <h1 id="landing-title" className="landing-title">
              Make every<br />
              <span>delivery</span> count.
            </h1>

            <p className="landing-lede">
              A route planning lab for real fleets. Balance vehicle capacity, delivery windows and road conditions—then send each driver a clear route.
            </p>

            <div className="landing-actions">
              <button onClick={() => onNavigate('admin')} className="landing-primary-action">
                <span className="landing-action-icon"><Route className="h-[18px] w-[18px]" /></span>
                <span>Plan a dispatch</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={() => onNavigate('driver')} className="landing-secondary-action">
                <Truck className="h-4 w-4" /> Driver view <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="landing-truth-row">
              <span><i /> OpenStreetMap streets</span>
              <span>Modeled traffic · no live feed</span>
            </div>

            <a className="landing-scroll-cue" href="#workflow">
              <span className="landing-scroll-cue-icon"><ArrowDown className="h-3.5 w-3.5" /></span>
              <span>Scroll to explore</span>
              <span className="landing-scroll-line" />
            </a>
          </div>

          <div className="landing-art-wrap">
            <div className="landing-art-label"><span>01 / ROUTE ATLAS</span><span>SCHEMATIC · NAVI MUMBAI</span></div>
            <RouteAtlas3D
              depot={depot}
              deliveries={deliveries}
              result={result}
              isOptimizing={isOptimizing}
              algorithmName={algorithmName}
              trafficSegments={trafficSegments}
              onRunOptimization={onRunOptimization}
            />
            <div className="landing-art-caption"><span className="landing-caption-dot" />A dispatch plan, viewed in three dimensions</div>
          </div>
        </div>

        <div className="landing-hero-footer">
          <span>QUANTUM-INSPIRED ROUTE OPTIMIZATION</span>
          <span className="landing-hero-footer-line" />
          <span>PLAN <b>·</b> OPTIMIZE <b>·</b> DISPATCH</span>
        </div>
      </section>

      <section id="workflow" className="landing-section landing-principles" aria-labelledby="principles-title">
        <div className="landing-section-heading">
          <div>
            <p className="landing-kicker"><span>THE REAL-WORLD RULES</span><i /></p>
            <h2 id="principles-title">A good route is<br /><em>more than a short line.</em></h2>
          </div>
          <p className="landing-section-intro">The planner works with the constraints that make deliveries hard: finite payloads, promised arrival windows and a road network that never behaves like a straight line.</p>
        </div>

        <div className="landing-principle-grid">
          {operatingPrinciples.map(({ icon: Icon, number, title, detail }) => (
            <article key={number} className="landing-principle-card">
              <div className="landing-principle-top"><span>{number}</span><Icon className="h-[19px] w-[19px]" strokeWidth={1.6} /></div>
              <h3>{title}</h3>
              <p>{detail}</p>
              <div className="landing-principle-rule"><i /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-workflow" aria-labelledby="workflow-title">
        <div className="landing-workflow-heading">
          <div>
            <p className="landing-kicker landing-kicker-light"><span>FROM INPUT TO ROAD</span><i /></p>
            <h2 id="workflow-title">One clear path<br /><em>from plan to pavement.</em></h2>
          </div>
          <p>Move from delivery data to an assigned driver route in three deliberate steps.</p>
        </div>

        <div className="landing-workflow-grid">
          <article className="landing-workflow-card">
            <span className="landing-workflow-number">01</span>
            <div className="landing-workflow-icon"><PackageCheck className="h-5 w-5" /></div>
            <h3>Shape the day</h3>
            <p>Add delivery stops, fleet capacity, service times and time windows.</p>
            <span className="landing-workflow-foot">STOPS · FLEET · WINDOWS</span>
          </article>
          <article className="landing-workflow-card landing-workflow-card-featured">
            <span className="landing-workflow-number">02</span>
            <div className="landing-workflow-icon"><Zap className="h-5 w-5" /></div>
            <h3>Explore route plans</h3>
            <p>Run the selected optimizer and inspect its assignments and street geometry.</p>
            <span className="landing-workflow-foot">CLASSICAL ↔ QUANTUM-INSPIRED</span>
          </article>
          <article className="landing-workflow-card">
            <span className="landing-workflow-number">03</span>
            <div className="landing-workflow-icon"><Truck className="h-5 w-5" /></div>
            <h3>Put it in motion</h3>
            <p>Dispatch one route per vehicle and track delivery progress stop by stop.</p>
            <span className="landing-workflow-foot">ASSIGN · NAVIGATE · COMPLETE</span>
          </article>
        </div>
        <button onClick={() => onNavigate('admin')} className="landing-text-action landing-text-action-light">Open the dispatch desk <ArrowRight className="h-4 w-4" /></button>
      </section>

      <section className="landing-section landing-methods" aria-labelledby="methods-title">
        <div className="landing-section-heading landing-method-heading">
          <div>
            <p className="landing-kicker"><span>THE EXPERIMENT</span><i /></p>
            <h2 id="methods-title">Six search strategies.<br /><em>One routing problem.</em></h2>
          </div>
          <div className="landing-method-aside">
            <p>Compare classical and quantum-inspired methods on the same vehicle-routing task. The results belong to the backend and saved benchmark runs.</p>
            <button onClick={() => onNavigate('benchmarks')} className="landing-text-action">Explore benchmark results <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="landing-algorithm-grid">
          {algorithms.map((algorithm, index) => {
            const detail = methodDetails[algorithm.id] ?? { family: 'Optimization method', purpose: algorithm.description };
            const isHybrid = algorithm.id === 'qa_qpso';
            return (
              <article key={algorithm.id} className={`landing-algorithm-card${isHybrid ? ' landing-algorithm-card-hybrid' : ''}`} style={{ '--card-index': index } as React.CSSProperties}>
                <div className="landing-algorithm-topline"><span className="landing-algorithm-index">0{index + 1}</span><span className={`landing-algorithm-dot${isHybrid ? ' landing-algorithm-dot-hot' : ''}`} /></div>
                <div className="landing-algorithm-name">{algorithm.name}</div>
                <div className="landing-algorithm-family">{detail.family}</div>
                <p>{detail.purpose}</p>
                <div className="landing-algorithm-bottom"><span>{isHybrid ? 'PROPOSED HYBRID' : algorithm.id === 'astar' ? 'REFERENCE' : 'COMPARISON'}</span><ArrowRight className="h-3.5 w-3.5" /></div>
              </article>
            );
          })}
        </div>

        <div className="landing-method-note"><CircleHelp className="h-4 w-4 shrink-0" /><span>A* is a single-pair shortest-path reference. It is not a multi-vehicle VRP solver, so compare it in that context.</span></div>
      </section>

      <section className="landing-close" aria-labelledby="close-title">
        <div className="landing-close-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div className="landing-close-copy">
          <p className="landing-kicker landing-kicker-light"><span>READY WHEN YOU ARE</span><i /></p>
          <h2 id="close-title">The next move<br /><em>starts with a plan.</em></h2>
          <p>Open the dispatch desk to build a route plan, or review the benchmark runs behind the comparison.</p>
        </div>
        <div className="landing-close-actions">
          <button onClick={() => onNavigate('admin')} className="landing-primary-action landing-primary-action-close">
            <span className="landing-action-icon"><Shield className="h-[18px] w-[18px]" /></span>
            <span>Plan a dispatch</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={() => onNavigate('benchmarks')} className="landing-close-benchmark"><BarChart3 className="h-4 w-4" /> Open benchmark lab</button>
        </div>
        <div className="landing-close-stamp"><Check className="h-3.5 w-3.5" /> BUILT AROUND THE EXISTING OPTIMIZER</div>
      </section>

      <footer className="landing-footer">
        <div><span className="landing-footer-mark"><Image src="/qmaps-route-mark.svg" alt="" width={31} height={31} /></span><span><strong>QMaps</strong><small>Navi Mumbai operations</small></span></div>
        <nav aria-label="Product policies">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/licenses">Map credits</Link>
        </nav>
        <span className="landing-footer-status"><i className={backendConnected ? 'is-connected' : ''} />{backendConnected ? 'Backend connected' : 'Backend offline'}</span>
      </footer>
    </div>
  </main>
);
