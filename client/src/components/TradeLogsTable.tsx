import { TradeLog } from "@shared/schema";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle } from "lucide-react";

interface TradeLogsTableProps {
  logs: TradeLog[];
  isLoading: boolean;
}

export function TradeLogsTable({ logs, isLoading }: TradeLogsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 bg-white/5 rounded-xl border border-dashed border-white/10">
        <p className="text-muted-foreground">No trades executed yet.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">Time</th>
              <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">Market</th>
              <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">Side</th>
              <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono text-right">Price (KRW)</th>
              <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono text-right">Volume</th>
              <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {logs.map((log) => (
              <tr key={log.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="p-4 text-sm text-muted-foreground font-mono">
                  {log.timestamp ? format(new Date(log.timestamp), "HH:mm:ss") : "-"}
                </td>
                <td className="p-4 text-sm font-medium">{log.market}</td>
                <td className="p-4 text-sm">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                    log.side === 'bid' 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {log.side === 'bid' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                    {log.side === 'bid' ? 'Buy' : 'Sell'}
                  </span>
                </td>
                <td className="p-4 text-sm font-mono text-right text-foreground">
                  {Number(log.price).toLocaleString()}
                </td>
                <td className="p-4 text-sm font-mono text-right text-muted-foreground">
                  {log.volume}
                </td>
                <td className="p-4 text-center">
                  {log.status === 'success' ? (
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 text-red-400">
                      <XCircle className="w-4 h-4" />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
