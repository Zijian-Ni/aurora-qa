import Link from 'next/link';
import { StatusBadge } from './StatusBadge';

export function RunRow({ id, intent, status, duration }: {
  id: string;
  intent: string;
  status: string;
  duration: string;
}) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">
        <Link href={`/runs/${id}`} className="text-aurora-cyan hover:underline text-xs font-mono">
          {id.slice(0, 8)}
        </Link>
      </td>
      <td className="px-4 py-3">{intent}</td>
      <td className="px-4 py-3"><StatusBadge status={status} /></td>
      <td className="px-4 py-3 text-gray-400">{duration}</td>
    </tr>
  );
}
