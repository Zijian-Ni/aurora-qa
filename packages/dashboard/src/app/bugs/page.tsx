'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface Bug {
  id: string;
  title: string;
  severity: string;
  file: string;
  status: string;
  suggestedFix: string;
  date: string;
}

const MOCK_BUGS: Bug[] = [
  { id: 'bug-1', title: 'Potential null dereference in user handler', severity: 'high', file: 'src/handlers/user.ts', status: 'open', suggestedFix: 'Add null check before accessing user.email', date: '2026-03-25' },
  { id: 'bug-2', title: 'SQL injection in search query', severity: 'critical', file: 'src/db/search.ts', status: 'open', suggestedFix: 'Use parameterized query instead of string concatenation', date: '2026-03-25' },
  { id: 'bug-3', title: 'Unhandled promise rejection in async middleware', severity: 'medium', file: 'src/middleware/auth.ts', status: 'open', suggestedFix: 'Wrap async handler with try-catch', date: '2026-03-24' },
  { id: 'bug-4', title: 'Missing input validation for email field', severity: 'medium', file: 'src/routes/register.ts', status: 'resolved', suggestedFix: 'Add Zod schema validation', date: '2026-03-24' },
  { id: 'bug-5', title: 'Console.log left in production code', severity: 'low', file: 'src/utils/format.ts', status: 'resolved', suggestedFix: 'Remove console.log or use logger', date: '2026-03-23' },
];

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-blue-500/20 text-blue-400',
};

export default function BugsPage() {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? MOCK_BUGS : MOCK_BUGS.filter(b => b.severity === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bugs ({MOCK_BUGS.length})</h1>
        <div className="flex gap-2">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs capitalize transition-colors ${
                filter === s ? 'bg-aurora-purple text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map(bug => (
          <details key={bug.id} className="glass-card">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[bug.severity] ?? ''}`}>
                  {bug.severity}
                </span>
                <span className="font-medium">{bug.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{bug.file}</span>
                <StatusBadge status={bug.status} />
              </div>
            </summary>
            <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
              <div className="text-sm text-gray-400">
                <span className="text-gray-500">Suggested Fix:</span> {bug.suggestedFix}
              </div>
              <div className="text-xs text-gray-500">Found on {bug.date}</div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
