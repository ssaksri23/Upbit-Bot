import { 
  useUpbitStatus, 
  useBotSettings, 
  useUpdateSettings, 
  useToggleBot,
  useTradeLogs 
} from "@/hooks/use-upbit";
import { MetricCard } from "@/components/MetricCard";
import { SettingsForm } from "@/components/SettingsForm";
import { TradeLogsTable } from "@/components/TradeLogsTable";
import { PriceChart } from "@/components/PriceChart";
import { Activity, Wallet, Bitcoin, Power, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: status, isLoading: isLoadingStatus } = useUpbitStatus();
  const { data: settings, isLoading: isLoadingSettings } = useBotSettings();
  const { data: logs, isLoading: isLoadingLogs } = useTradeLogs();
  
  const updateSettingsMutation = useUpdateSettings();
  const toggleBotMutation = useToggleBot();

  const handleToggleBot = () => {
    if (status) {
      toggleBotMutation.mutate(!status.isActive);
    }
  };

  const isActive = status?.isActive ?? false;

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Upbit AutoTrader
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            Automated High-Frequency Trading System
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">System Status</span>
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", isActive ? "bg-green-500 animate-pulse" : "bg-red-500")} />
              <span className={cn("font-bold", isActive ? "text-green-400" : "text-red-400")}>
                {isActive ? "OPERATIONAL" : "STOPPED"}
              </span>
            </div>
          </div>
          
          <Button
            size="lg"
            onClick={handleToggleBot}
            disabled={toggleBotMutation.isPending}
            className={cn(
              "h-12 px-8 text-base font-bold shadow-xl transition-all duration-300",
              isActive 
                ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 hover:shadow-red-500/10" 
                : "bg-green-500 hover:bg-green-400 text-white shadow-green-500/20 hover:shadow-green-500/40"
            )}
          >
            <Power className="mr-2 h-5 w-5" />
            {toggleBotMutation.isPending ? "Switching..." : isActive ? "STOP BOT" : "START BOT"}
          </Button>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Current Price"
          value={status?.currentPrice ? `₩${status.currentPrice.toLocaleString()}` : "---"}
          subValue={status?.market || "---"}
          icon={<Activity className="w-6 h-6" />}
          isLoading={isLoadingStatus}
          className="border-primary/20 bg-primary/5"
        />
        <MetricCard
          label="KRW Balance"
          value={status?.balanceKRW ? `₩${Math.floor(status.balanceKRW).toLocaleString()}` : "---"}
          icon={<Wallet className="w-6 h-6" />}
          isLoading={isLoadingStatus}
        />
        <MetricCard
          label="Coin Balance"
          value={status?.balanceCoin ? status.balanceCoin.toFixed(8) : "---"}
          subValue={status?.market?.split('-')[1] || "BTC"}
          icon={<Bitcoin className="w-6 h-6" />}
          isLoading={isLoadingStatus}
        />
        <MetricCard
          label="24h Change"
          value="+2.4%" // Mock data for now
          trend="up"
          icon={<TrendingUp className="w-6 h-6" />}
          isLoading={isLoadingStatus}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
        {/* Left: Settings */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <SettingsForm 
            initialData={settings} 
            onSubmit={(data) => updateSettingsMutation.mutate(data)}
            isPending={updateSettingsMutation.isPending}
          />
        </motion.div>
        
        {/* Right: Chart */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <PriceChart currentPrice={status?.currentPrice || 0} />
        </motion.div>
      </div>

      {/* Bottom: Logs */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Trade History
          </h2>
          <span className="text-xs font-mono text-muted-foreground">Auto-refreshing every 5s</span>
        </div>
        <TradeLogsTable logs={logs || []} isLoading={isLoadingLogs} />
      </motion.div>
    </div>
  );
}
