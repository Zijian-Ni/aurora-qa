'use client';

import { useParams } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface StepInfo {
  name: string;
  status: string;
  duration: string;
  output?: string;
}

const MOCK_STEPS: StepInfo[] = [
  { name: 'Generate Tests', status: 'completed', duration: '3.2s', output: '12 test cases generated' },
  { name: 'Run Tests', status: 'completed', duration: '8.1s', output: '12 passing, 0 failing' },
  { name: 'Bug Analysis', status: 'completed', duration: '5.4s', output: '2 bugs found (1 medium, 1 low)' },
  { name: 'Coverage Analysis', status: 'completed', duration: '2.1s', output: '87.3% line coverage' },
  { name: 'Code Review', status: 'completed', duration: '4.7s', output: 'Score: 82/100 (B)' },
];

export default function RunDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">Run {id.slice(0, 8)}</h1>
        <StatusBadge status="completed" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="text-xs text-gray-500 uppercase">Duration</div>
          <div className="text-lg font-semibold">23.5s</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-gray-500 uppercase">Steps</div>
          <div className="text-lg font-semibold">{MOCK_STEPS.length}</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-gray-500 uppercase">Trigger</div>
          <div className="text-lg font-semibold">Manual</div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Pipeline Steps</h2>
        <div className="space-y-2">
          {MOCK_STEPS.map((step, i) => (
            <details key={i} className="glass-card">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className={`status-dot ${step.status}`} />
                  <span className="font-medium">{step.name}</span>
                </div>
                <span className="text-sm text-gray-500">{step.duration}</span>
              </summary>
              <div className="px-4 pb-3 text-sm text-gray-400 border-t border-white/5 pt-3">
                {step.output ?? 'No output'}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
