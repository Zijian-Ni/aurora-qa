const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-500/20 text-emerald-400',
  running: 'bg-cyan-500/20 text-cyan-400',
  failed: 'bg-red-500/20 text-red-400',
  error: 'bg-red-500/20 text-red-400',
  idle: 'bg-gray-500/20 text-gray-400',
  open: 'bg-orange-500/20 text-orange-400',
  resolved: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[status] ?? statusStyles.idle}`}>
      {status}
    </span>
  );
}
