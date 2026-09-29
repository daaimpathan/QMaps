'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CircleHelp, FlaskConical, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';
import { BenchmarkStatistics, BenchmarkSummaryItem } from '../types';

const DEFAULT_ALGORITHM_ORDER = ['A*', 'PSO', 'QPSO', 'ACO', 'QACO', 'QA-QPSO'];
const formatP = (value: number) => value === 0 ? '0 (reported)' : value < 0.001 ? value.toExponential(2) : value.toFixed(4);

export const BenchmarkDashboard: React.FC = () => {
  const [results, setResults] = useState<BenchmarkSummaryItem[]>([]);
  const [statistics, setStatistics] = useState<BenchmarkStatistics | null>(null);
  const [instance, setInstance] = useState('RC101');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, analysis] = await Promise.all([
        apiService.getBenchmarkResults(),
        apiService.getBenchmarkStatistics(),
      ]);
      setResults(summary.results);
      setStatistics(analysis);
      const available = Array.from(new Set(summary.results.map((item) => item.instance)));
      if (available.length && !available.includes(instance)) setInstance(available[0]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load saved benchmark results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const instances = useMemo(() => Array.from(new Set(results.map((item) => item.instance))), [results]);
  const currentResults = useMemo(() => results.filter((item) => item.instance === instance), [results, instance]);
  const chartRows = useMemo(
    () => orderedForResults(currentResults),
    [currentResults],
  );
  const orderedAlgorithms = useMemo(() => {
    const names = Array.from(new Set(results.map((item) => item.algorithm)));
    return [...DEFAULT_ALGORITHM_ORDER.filter((name) => names.includes(name)), ...names.filter((name) => !DEFAULT_ALGORITHM_ORDER.includes(name))];
  }, [results]);
  const currentWilcoxon = statistics?.wilcoxon[instance] ?? {};
  const currentNormality = statistics?.normality[instance] ?? {};
  const currentFriedman = statistics?.friedman[instance];
  const currentNemenyi = statistics?.nemenyi[instance];
  return (
    <main className="min-h-[calc(100vh-4.5rem)] bg-sand-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-olive-700">Research workspace</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-olive-950">Benchmark lab</h1>
            <p className="mt-2 max-w-3xl text-sm text-stone-600">Cost summaries come from the saved run-level CSV. Paired and omnibus tests are shown when the saved run data supports them.</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-olive-300 bg-white px-4 py-2.5 text-sm font-bold text-olive-900 hover:bg-olive-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh data
          </button>
        </header>

        {loading && <div className="rounded-2xl border border-sand-200 bg-white p-8 text-center text-sm text-stone-500">Loading benchmark summaries and statistical tests…</div>}
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

        {!loading && !error && (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-sand-200 bg-white p-4"><p className="text-xs font-semibold text-stone-500">Saved experiment rows</p><p className="mt-1 text-2xl font-black text-olive-950">{statistics?.total_runs ?? '—'}</p></div>
              <div className="rounded-2xl border border-sand-200 bg-white p-4"><p className="text-xs font-semibold text-stone-500">Instances with results</p><p className="mt-1 text-2xl font-black text-olive-950">{instances.length}</p></div>
              <div className="rounded-2xl border border-sand-200 bg-white p-4"><p className="text-xs font-semibold text-stone-500">Algorithms compared</p><p className="mt-1 text-2xl font-black text-olive-950">{orderedAlgorithms.length}</p></div>
            </section>

            {results.length === 0 ? (
              <div className="rounded-2xl border border-sand-200 bg-white p-6 text-sm text-stone-600">No benchmark summary rows were returned by the backend.</div>
            ) : (
              <>
                <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
                  <div className="border-b border-sand-200 px-5 py-4">
                    <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-olive-700" /><h2 className="font-extrabold text-olive-950">All-algorithm comparison</h2></div>
                    <p className="mt-1 text-xs text-stone-500">Mean cost from {statistics?.source_csv ?? 'the saved benchmark CSV'}.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[660px] text-left text-xs">
                      <thead className="bg-sand-100 text-[10px] uppercase tracking-wide text-stone-600"><tr><th className="px-4 py-3">Algorithm</th>{instances.map((name) => <th key={name} className="px-4 py-3">{name} · mean cost</th>)}</tr></thead>
                      <tbody className="divide-y divide-sand-200">
                        {orderedAlgorithms.map((name) => <tr key={name} className="hover:bg-sand-50"><th className="px-4 py-3 font-bold text-olive-950">{name}</th>{instances.map((dataset) => {
                          const item = results.find((row) => row.algorithm === name && row.instance === dataset);
                          return <td key={dataset} className="px-4 py-3 font-mono text-stone-700">{item ? item.mean_cost.toFixed(2) : '—'}</td>;
                        })}</tr>)}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
                <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="font-extrabold text-olive-950">Per-instance results</h2><p className="mt-1 text-xs text-stone-500">Best, mean, worst, and sample count from feasible rows in the source CSV.</p></div>
                    <div className="flex rounded-xl bg-sand-100 p-1">{instances.map((name) => <button key={name} onClick={() => setInstance(name)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${instance === name ? 'bg-olive-800 text-white' : 'text-stone-600 hover:bg-white'}`}>{name}</button>)}</div>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-sand-200">
                    <table className="w-full min-w-[580px] text-left text-xs">
                      <thead className="bg-sand-100 text-[10px] uppercase tracking-wide text-stone-600"><tr><th className="px-4 py-3">Algorithm</th><th className="px-4 py-3">Best cost</th><th className="px-4 py-3">Mean cost</th><th className="px-4 py-3">Worst cost</th><th className="px-4 py-3">Feasible runs</th></tr></thead>
                      <tbody className="divide-y divide-sand-200">{orderedAlgorithms.map((name) => {
                        const item = currentResults.find((row) => row.algorithm === name);
                        return <tr key={name}><th className="px-4 py-3 font-bold text-olive-950">{name}</th><td className="px-4 py-3 font-mono">{item?.best_cost.toFixed(2) ?? '—'}</td><td className="px-4 py-3 font-mono">{item?.mean_cost.toFixed(2) ?? '—'}</td><td className="px-4 py-3 font-mono">{item?.worst_cost.toFixed(2) ?? '—'}</td><td className="px-4 py-3">{item?.n_runs ?? '—'}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                </section>

                <CostVisualization instance={instance} rows={chartRows} />
                </div>

                <section className="grid gap-4 lg:grid-cols-2">
                  <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3"><FlaskConical className="mt-0.5 h-5 w-5 text-olive-700" /><div><h2 className="font-extrabold text-olive-950">Friedman test · {instance}</h2><p className="mt-1 text-xs text-stone-500">Omnibus rank comparison across all listed algorithms.</p></div></div>
                    {currentFriedman ? <div className="mt-4 grid grid-cols-3 gap-2 text-xs"><Metric label="Statistic" value={currentFriedman.statistic.toFixed(3)} /><Metric label="p-value" value={formatP(currentFriedman.p_value)} /><Metric label="Samples / methods" value={`${currentFriedman.n_samples} / ${currentFriedman.n_algorithms}`} /></div> : <MissingResult />}
                    {currentFriedman && <p className="mt-3 text-xs text-stone-600">{currentFriedman.significant ? 'The saved result marks this overall comparison as statistically significant.' : 'The saved result does not mark this overall comparison as statistically significant.'}</p>}
                  </article>

                  <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3"><Activity className="mt-0.5 h-5 w-5 text-olive-700" /><div><h2 className="font-extrabold text-olive-950">Shapiro–Wilk normality · {instance}</h2><p className="mt-1 text-xs text-stone-500">Normality status and p-values recorded for each method.</p></div></div>
                    {Object.keys(currentNormality).length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-[10px] uppercase text-stone-500"><tr><th className="py-2">Algorithm</th><th>p-value</th><th>Saved result</th></tr></thead><tbody className="divide-y divide-sand-200">{orderedAlgorithms.map((name) => { const item = currentNormality[name]; return item ? <tr key={name}><th className="py-2 font-semibold text-olive-950">{name}</th><td className="font-mono">{formatP(item.p_value)}</td><td>{item.normal ? 'Normal' : 'Non-normal'}</td></tr> : null; })}</tbody></table></div> : <MissingResult />}
                  </article>
                </section>

                <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3"><CircleHelp className="mt-0.5 h-5 w-5 text-olive-700" /><div><h2 className="font-extrabold text-olive-950">Wilcoxon paired comparisons · {instance}</h2><p className="mt-1 text-xs text-stone-500">QPSO vs PSO is recalculated from paired rows in the displayed source CSV; other pairs use the saved test output.</p></div></div>
                  {Object.keys(currentWilcoxon).length ? <div className="mt-4 overflow-x-auto rounded-xl border border-sand-200"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-sand-100 text-[10px] uppercase tracking-wide text-stone-600"><tr><th className="px-3 py-2.5">Pair</th><th className="px-3 py-2.5">Mean 1 / mean 2</th><th className="px-3 py-2.5">p-value</th><th className="px-3 py-2.5">Cohen’s d</th><th className="px-3 py-2.5">Direction</th><th className="px-3 py-2.5">Samples</th></tr></thead><tbody className="divide-y divide-sand-200">{Object.entries(currentWilcoxon).map(([pair, item]) => <tr key={pair}><th className="px-3 py-2.5 font-semibold text-olive-950">{pair.replace('_vs_', ' vs ')}</th><td className="px-3 py-2.5 font-mono">{item.mean_1.toFixed(2)} / {item.mean_2.toFixed(2)}</td><td className="px-3 py-2.5 font-mono">{formatP(item.p_value)}{item.significant ? ' · significant' : ''}</td><td className="px-3 py-2.5">{item.cohens_d.toFixed(2)} · {item.effect_size_interpretation}</td><td className="px-3 py-2.5 font-semibold">{item.better}</td><td className="px-3 py-2.5">{item.n_samples}</td></tr>)}</tbody></table></div> : <MissingResult />}
                </section>

                <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
                  <div><h2 className="font-extrabold text-olive-950">Nemenyi post-hoc p-value matrix · {instance}</h2><p className="mt-1 text-xs text-stone-500">Pairwise entries are shown in the exact algorithm order saved with the matrix.</p></div>
                  {currentNemenyi?.algorithms?.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-full text-center text-[11px]"><thead><tr><th className="p-2 text-left text-stone-500">Method</th>{currentNemenyi.algorithms.map((name) => <th key={name} className="p-2 font-bold text-olive-900">{name}</th>)}</tr></thead><tbody>{currentNemenyi.algorithms.map((rowName, rowIndex) => <tr key={rowName} className="border-t border-sand-200"><th className="p-2 text-left font-bold text-olive-900">{rowName}</th>{currentNemenyi.algorithms.map((_, colIndex) => <td key={colIndex} className="p-2 font-mono text-stone-600">{formatP(currentNemenyi.p_values[String(rowIndex)]?.[String(colIndex)] ?? NaN)}</td>)}</tr>)}</tbody></table></div> : <MissingResult />}
                </section>
              </>
            )}
            <p className="text-[11px] text-stone-500">Source: {statistics?.source_csv ?? 'benchmark CSV unavailable'}.</p>
          </>
        )}
      </div>
    </main>
  );
};

function orderedForResults(rows: BenchmarkSummaryItem[]): BenchmarkSummaryItem[] {
  return [...rows].sort((a, b) => {
    const aIndex = DEFAULT_ALGORITHM_ORDER.indexOf(a.algorithm);
    const bIndex = DEFAULT_ALGORITHM_ORDER.indexOf(b.algorithm);
    return (aIndex < 0 ? DEFAULT_ALGORITHM_ORDER.length : aIndex)
      - (bIndex < 0 ? DEFAULT_ALGORITHM_ORDER.length : bIndex);
  });
}

const CostVisualization: React.FC<{ instance: string; rows: BenchmarkSummaryItem[] }> = ({ instance, rows }) => {
  const validRows = rows.filter((row) =>
    Number.isFinite(row.mean_cost)
    && Number.isFinite(row.n_runs)
    && row.n_runs > 0
    && row.mean_cost >= 0,
  );
  const largestMean = Math.max(0, ...validRows.map((row) => row.mean_cost));
  const rawStep = largestMean > 0 ? largestMean / 5 : 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const stepFactor = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10;
  const step = stepFactor * magnitude;
  const scaleMax = step * 5;
  const ticks = Array.from({ length: 6 }, (_, index) => index * step);
  const plot = { width: 560, height: 235, left: 48, right: 12, top: 28, bottom: 184 };
  const plotWidth = plot.width - plot.left - plot.right;
  const plotHeight = plot.bottom - plot.top;
  const slotWidth = validRows.length ? plotWidth / validRows.length : plotWidth;

  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="cost-visualization-title">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 shrink-0 text-olive-700" />
        <h2 id="cost-visualization-title" className="font-extrabold text-olive-950">Mean cost · {instance}</h2>
      </div>
      <p className="mt-1 text-xs text-stone-500">Saved feasible runs · lower is better.</p>

      {validRows.length === 0 ? (
        <MissingResult />
      ) : (
        <div className="mt-3">
          <svg className="block h-auto w-full" viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label={`Mean benchmark costs for ${validRows.map((row) => `${row.algorithm}: ${row.mean_cost.toFixed(2)}`).join(', ')}`}>
            <title>Mean benchmark cost by algorithm for {instance}</title>
            <desc>Bars start at zero and show the mean cost from feasible saved benchmark runs. Lower is better.</desc>
            {ticks.map((tick, index) => {
              const y = plot.bottom - (tick / scaleMax) * plotHeight;
              return (
                <g key={index}>
                  <line x1={plot.left} x2={plot.width - plot.right} y1={y} y2={y} stroke="#e8dfcd" strokeWidth="1" />
                  <text x={plot.left - 7} y={y + 3.5} textAnchor="end" fill="#78716c" fontSize="9">{tick.toFixed(0)}</text>
                </g>
              );
            })}
            {validRows.map((row, index) => {
              const center = plot.left + slotWidth * (index + 0.5);
              const barWidth = Math.min(42, slotWidth * 0.56);
              const barHeight = (row.mean_cost / scaleMax) * plotHeight;
              const barY = plot.bottom - barHeight;
              return (
                <g key={row.algorithm}>
                  <text x={center} y={Math.max(plot.top - 2, barY - 6)} textAnchor="middle" fill="#374151" fontSize="9" fontWeight="600">{row.mean_cost.toFixed(2)}</text>
                  <rect x={center - barWidth / 2} y={barY} width={barWidth} height={barHeight} rx="3" fill="#647a3b" />
                  <text x={center} y={plot.bottom + 17} textAnchor="middle" fill="#3f4635" fontSize="10" fontWeight="600">{row.algorithm}</text>
                </g>
              );
            })}
            <text x={plot.left} y={plot.height - 5} fill="#78716c" fontSize="9">Cost units · zero-based scale</text>
          </svg>
        </div>
      )}
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-sand-100 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-1 break-words font-mono font-bold text-olive-950">{value}</p></div>
);

const MissingResult: React.FC = () => <p className="mt-4 rounded-xl bg-sand-100 p-3 text-xs text-stone-600">No saved output is available for this test and instance.</p>;
