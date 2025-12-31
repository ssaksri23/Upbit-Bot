import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBotSettings, useUpbitStatus, useUpdateSettings, useTradeLogs, useVerifyApiKeys, useMarkets } from "@/hooks/use-upbit";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  Activity, 
  Wallet, 
  Coins, 
  Power, 
  Settings2, 
  Save,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Loader2,
  TrendingUp,
  PiggyBank
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { motion } from "framer-motion";
import { format } from "date-fns";

const STRATEGIES = [
  { value: "percent", label: "변동률 매매", labelEn: "Percent Trading", desc: "일정 비율 변동 시 매수/매도" },
  { value: "grid", label: "그리드 매매", labelEn: "Grid Trading", desc: "가격 구간별 분할 매매" },
  { value: "dca", label: "DCA 적립식", labelEn: "DCA", desc: "정기적 분할 매수" },
];

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { data: status } = useUpbitStatus();
  const { data: settings } = useBotSettings();
  const { data: logs } = useTradeLogs();
  const { data: markets, isLoading: marketsLoading } = useMarkets();
  const updateSettings = useUpdateSettings();
  const verifyKeys = useVerifyApiKeys();

  const [formState, setFormState] = useState({
    market: "KRW-BTC",
    strategy: "percent",
    buyThreshold: "0.5",
    sellThreshold: "0.5",
    targetAmount: "10000",
    upbitAccessKey: "",
    upbitSecretKey: "",
  });

  useEffect(() => {
    if (settings) {
      setFormState(prev => ({
        ...prev,
        market: settings.market,
        strategy: settings.strategy || "percent",
        buyThreshold: settings.buyThreshold || "0.5",
        sellThreshold: settings.sellThreshold || "0.5",
        targetAmount: settings.targetAmount || "10000",
      }));
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      ...formState,
      upbitAccessKey: formState.upbitAccessKey || undefined,
      upbitSecretKey: formState.upbitSecretKey || undefined,
    }, {
      onSuccess: () => {
        // Clear API key fields after successful save
        setFormState(prev => ({
          ...prev,
          upbitAccessKey: "",
          upbitSecretKey: "",
        }));
      }
    });
  };

  const toggleActive = () => {
    updateSettings.mutate({ isActive: !settings?.isActive });
  };

  const chartData = Array.from({ length: 20 }).map((_, i) => ({
    time: i,
    price: status?.currentPrice ? status.currentPrice * (1 + (Math.random() * 0.02 - 0.01)) : 0
  }));

  const formatPrice = (price: number | string) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Number(price));
  };

  const selectedMarket = markets?.find(m => m.market === formState.market);
  const coinSymbol = formState.market.split('-')[1] || "BTC";
  const isKorean = i18n.language === 'ko';

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatusCard
          title={t('dashboard.status')}
          value={settings?.isActive ? t('dashboard.active') : t('dashboard.inactive')}
          icon={Power}
          trend={settings?.isActive ? "up" : "neutral"}
          className={settings?.isActive ? "border-primary/50 bg-primary/5" : ""}
          testId="card-bot-status"
        />
        <StatusCard
          title={isKorean ? (selectedMarket?.korean_name || coinSymbol) : (selectedMarket?.english_name || coinSymbol)}
          value={status?.currentPrice ? formatPrice(status.currentPrice) : "-"}
          icon={Activity}
          trend="up"
          description={formState.market}
          testId="card-current-price"
        />
        <StatusCard
          title={t('dashboard.balance')}
          value={status?.balanceKRW ? formatPrice(status.balanceKRW) : "0"}
          icon={Wallet}
          description="KRW"
          testId="card-krw-balance"
        />
        <StatusCard
          title={t('dashboard.holdings')}
          value={status?.balanceCoin ? Number(status.balanceCoin).toFixed(8) : "0"}
          icon={Coins}
          description={coinSymbol}
          testId="card-coin-holdings"
        />
        <StatusCard
          title={t('dashboard.totalAsset')}
          value={status?.totalAssetKRW ? formatPrice(status.totalAssetKRW) : "0"}
          icon={PiggyBank}
          description="KRW"
          trend="up"
          testId="card-total-assets"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <CardTitle>{t('dashboard.settings')}</CardTitle>
            </div>
            <CardDescription>Configure your trading parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">{t('dashboard.startBot')}</Label>
                <div className="text-xs text-muted-foreground">
                  {settings?.isActive ? t('dashboard.monitoring') : t('dashboard.inactive')}
                </div>
              </div>
              <Switch checked={settings?.isActive} onCheckedChange={toggleActive} data-testid="switch-bot-active" />
            </div>

            <div className="space-y-2">
              <Label>{t('dashboard.market')}</Label>
              <Select 
                value={formState.market} 
                onValueChange={(value) => setFormState({...formState, market: value})}
              >
                <SelectTrigger data-testid="select-market">
                  <SelectValue placeholder="Select market" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {marketsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    markets?.map((m) => (
                      <SelectItem key={m.market} value={m.market} data-testid={`market-option-${m.market}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{m.market.split('-')[1]}</span>
                          <span>{isKorean ? m.korean_name : m.english_name}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('dashboard.strategy')}</Label>
              <Select 
                value={formState.strategy} 
                onValueChange={(value) => setFormState({...formState, strategy: value})}
              >
                <SelectTrigger data-testid="select-strategy">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value} data-testid={`strategy-option-${s.value}`}>
                      <div className="flex flex-col">
                        <span>{isKorean ? s.label : s.labelEn}</span>
                        <span className="text-xs text-muted-foreground">{s.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formState.strategy === "percent" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('dashboard.buyThreshold')}</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={formState.buyThreshold}
                      onChange={e => setFormState({...formState, buyThreshold: e.target.value})}
                      data-testid="input-buy-threshold"
                    />
                    <span className="absolute right-3 top-2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('dashboard.sellThreshold')}</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={formState.sellThreshold}
                      onChange={e => setFormState({...formState, sellThreshold: e.target.value})}
                      data-testid="input-sell-threshold"
                    />
                    <span className="absolute right-3 top-2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('dashboard.targetAmount')}</Label>
              <div className="relative">
                <Input 
                  type="number"
                  value={formState.targetAmount}
                  onChange={e => setFormState({...formState, targetAmount: e.target.value})}
                  data-testid="input-target-amount"
                />
                <span className="absolute right-3 top-2 text-sm text-muted-foreground">KRW</span>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <Label className="font-semibold">API Keys</Label>
                {settings?.hasAccessKey ? (
                  <span className="text-xs flex items-center gap-1 text-green-500" data-testid="status-api-key-set">
                    <CheckCircle2 className="w-3 h-3" /> {t('dashboard.keySet')}
                  </span>
                ) : (
                  <span className="text-xs flex items-center gap-1 text-yellow-500" data-testid="status-api-key-not-set">
                    <AlertCircle className="w-3 h-3" /> {t('dashboard.keyNotSet')}
                  </span>
                )}
              </div>
              <Input 
                type="password" 
                placeholder={t('dashboard.accessKey')} 
                value={formState.upbitAccessKey}
                onChange={e => setFormState({...formState, upbitAccessKey: e.target.value})}
                data-testid="input-access-key"
              />
              <Input 
                type="password" 
                placeholder={t('dashboard.secretKey')} 
                value={formState.upbitSecretKey}
                onChange={e => setFormState({...formState, upbitSecretKey: e.target.value})}
                data-testid="input-secret-key"
              />
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} className="flex-1" disabled={updateSettings.isPending} data-testid="button-save-settings">
                {updateSettings.isPending ? t('dashboard.saving') : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t('dashboard.save')}
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => verifyKeys.mutate()} 
                disabled={verifyKeys.isPending || !settings?.hasAccessKey}
                data-testid="button-verify-keys"
              >
                {verifyKeys.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-8">
          <Card className="h-[400px] flex flex-col" data-testid="card-price-chart">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-chart-title">
                <TrendingUp className="w-5 h-5" />
                {isKorean ? selectedMarket?.korean_name : selectedMarket?.english_name} ({formState.market})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="time" hide />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(val) => `${val.toLocaleString()}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recentTrades')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {(!logs || logs.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-trades">
                    {t('dashboard.noTrades')}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 font-medium text-muted-foreground">{t('columns.time')}</th>
                        <th className="py-2 font-medium text-muted-foreground">{t('columns.side')}</th>
                        <th className="py-2 font-medium text-muted-foreground">{t('columns.price')}</th>
                        <th className="py-2 font-medium text-muted-foreground">{t('columns.volume')}</th>
                        <th className="py-2 font-medium text-muted-foreground">{t('columns.status')}</th>
                      </tr>
                    </thead>
                    <tbody data-testid="trades-table-body">
                      {logs.map((log, idx) => (
                        <motion.tr 
                          key={log.id} 
                          className="border-b border-border/50"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          data-testid={`row-trade-${idx}`}
                        >
                          <td className="py-3 font-mono text-xs" data-testid={`text-time-${idx}`}>
                            {log.timestamp ? format(new Date(log.timestamp), 'MM-dd HH:mm:ss') : '-'}
                          </td>
                          <td className={cn(
                            "py-3 font-bold",
                            log.side === 'bid' ? "text-green-500" : 
                            log.side === 'ask' ? "text-red-500" : "text-blue-500"
                          )} data-testid={`text-side-${idx}`}>
                            {t(`sides.${log.side}`)}
                          </td>
                          <td className="py-3 font-mono" data-testid={`text-price-${idx}`}>{Number(log.price).toLocaleString()}</td>
                          <td className="py-3 font-mono" data-testid={`text-volume-${idx}`}>{log.volume}</td>
                          <td className="py-3">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              log.status === 'success' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                            )} data-testid={`status-trade-${idx}`}>
                              {log.status}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
