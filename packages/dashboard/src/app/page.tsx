'use client';

import { useEffect, useState } from 'react';
import { MetricCard } from '@/components/ui/MetricCard';
import { AgentCard } from '@/components/ui/AgentCard';
import { RunRow } from '@/components/ui/RunRow';

interface AgentStatus {
  name: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  lastRun?: string;
}

interface RunInfo {
  id: string;
  intent: string;
  status: string;
  duration: string;
  timestamp: string;
}

const INITIAL_AGENTS: AgentStatus[] = [
  { name: 'TestGenerator', status: 'idle' },
  { name: 'TestRunner', status: 'idle' },
  { name: 'BugAnalyzer', status: 'idle' },
  { name: 'CoverageAgent', status: 'idle' },
  { name: 'ReviewAgent', status: 'idle' },
  { name: 'HealerAgent', status: 'idle' },
  { name: 'SecurityAgent', status: 'idle' },
  { name: 'PerformanceAgent', status: 'idle' },
  { name: 'AccessibilityAgent', status: 'idle' },
  { name: 'ChaosAgent', status: 'idle' },
  { name: 'MutationAgent', status: 'idle' },
  { name: 'ContractAgent', status: 'idle' },
  { name: 'PlaywrightAgent', status: 'idle' },
];

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentStatus[]>(INITIAL_AGENTS);
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [metrics, setMetrics] = useState({ runs: 0, passRate: 0, bugs: 0, avgDuration: 0 });

  useEffect(() => {
    fetch('/api/runs')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRuns(data);
          setMetrics({
            runs: data.length,
            passRate: data.length > 0
              ? Math.round(data.filter((r: RunInfo) => r.status === 'completed').length / data.length * 100 * 10) / 10
              : 0,
            bugs: data.reduce((sum: number, r: RunInfo) => sum + (r.status === 'failed' ? 1 : 0), 0),
            avgDuration: data.length > 0
              ? Math.round(data.reduce((sum: number, r: RunInfo) => sum + parseFloat(r.duration), 0) / data.length * 10) / 10
              : 0,
          });
        }
      })
      .catch(() => {});

    // SSE for live updates
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'agent-status') {
          setAgents(prev => prev.map(a =>
            a.name === event.payload.name ? { ...a, status: event.payload.status } : a,
          ));
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  return (
    <div className="space-y-6">
      {/* Metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Runs" value={metrics.runs} />
        <MetricCard label="Pass Rate" value={`${metrics.passRate}%`} />
        <MetricCard label="Bugs Found" value={metrics.bugs} />
        <MetricCard label="Avg Duration" value={`${metrics.avgDuration}s`} />
      </div>

      {/* Agent Status */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Agent Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {agents.map(agent => (
            <AgentCard key={agent.name} name={agent.name} status={agent.status} />
          ))}
        </div>
      </section>

      {/* Recent Runs */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Runs</h2>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-left">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Intent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 10).map(run => (
                <RunRow key={run.id} {...run} />
              ))}
              {runs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No runs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
