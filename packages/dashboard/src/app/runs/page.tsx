'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface Run {
  id: string;
  intent: string;
  status: string;
  duration: string;
  timestamp: string;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/runs')
      .then(r => r.json())
      .then(data => Array.isArray(data) && setRuns(data))
      .catch(() => {});
  }, []);

  const filtered = filter === 'all' ? runs : runs.filter(r => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pipeline Runs</h1>
        <div className="flex gap-2">
          {['all', 'completed', 'running', 'failed'].map(s => (
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

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-left">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Intent</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Started</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(run => (
              <tr key={run.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/runs/${run.id}`} className="text-aurora-cyan hover:underline">
                    {run.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3">{run.intent}</td>
                <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                <td className="px-4 py-3 text-gray-400">{run.duration}</td>
                <td className="px-4 py-3 text-gray-500">{run.timestamp}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No runs found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
