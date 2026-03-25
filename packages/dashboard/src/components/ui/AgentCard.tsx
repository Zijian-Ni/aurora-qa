export function AgentCard({ name, status }: { name: string; status: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`status-dot ${status}`} />
      <span className="text-sm font-medium">{name}</span>
      <span className="text-xs text-gray-500 ml-auto capitalize">{status}</span>
    </div>
  );
}
