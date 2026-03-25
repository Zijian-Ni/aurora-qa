'use client';

import { AgentCard } from '@/components/ui/AgentCard';

const AGENTS = [
  { name: 'TestGenerator', status: 'idle' as const, runs: 142, successRate: 98.5, avgDuration: '3.2s' },
  { name: 'TestRunner', status: 'idle' as const, runs: 142, successRate: 94.2, avgDuration: '8.1s' },
  { name: 'BugAnalyzer', status: 'idle' as const, runs: 89, successRate: 96.3, avgDuration: '5.4s' },
  { name: 'CoverageAgent', status: 'idle' as const, runs: 76, successRate: 99.1, avgDuration: '2.1s' },
  { name: 'ReviewAgent', status: 'idle' as const, runs: 134, successRate: 97.8, avgDuration: '4.7s' },
  { name: 'HealerAgent', status: 'idle' as const, runs: 23, successRate: 82.6, avgDuration: '6.3s' },
  { name: 'SecurityAgent', status: 'idle' as const, runs: 67, successRate: 100, avgDuration: '4.2s' },
  { name: 'PerformanceAgent', status: 'idle' as const, runs: 45, successRate: 95.6, avgDuration: '3.8s' },
  { name: 'AccessibilityAgent', status: 'idle' as const, runs: 38, successRate: 100, avgDuration: '2.9s' },
  { name: 'ChaosAgent', status: 'idle' as const, runs: 12, successRate: 91.7, avgDuration: '15.2s' },
  { name: 'MutationAgent', status: 'idle' as const, runs: 19, successRate: 94.7, avgDuration: '12.4s' },
  { name: 'ContractAgent', status: 'idle' as const, runs: 8, successRate: 100, avgDuration: '5.1s' },
  { name: 'PlaywrightAgent', status: 'idle' as const, runs: 31, successRate: 87.1, avgDuration: '9.8s' },
];

export default function AgentsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Agents ({AGENTS.length})</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map(agent => (
          <div key={agent.name} className="glass-card p-4 space-y-3">
            <AgentCard name={agent.name} status={agent.status} />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-gray-500">Runs</div>
                <div className="font-semibold">{agent.runs}</div>
              </div>
              <div>
                <div className="text-gray-500">Success</div>
                <div className="font-semibold text-aurora-green">{agent.successRate}%</div>
              </div>
              <div>
                <div className="text-gray-500">Avg Time</div>
                <div className="font-semibold">{agent.avgDuration}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
