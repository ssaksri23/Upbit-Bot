import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBotSettings, useUpbitStatus, useUpdateSettings, useTradeLogs, useVerifyApiKeys, useMarkets, useManualBuy, useManualSell, useCandles, useRecommendations } from "@/hooks/use-upbit";
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
  TrendingDown,
  PiggyBank,
  BarChart3,
  Star,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  ReferenceLine,
  Cell
} from "recharts";
import { motion } from "framer-motion";
import { format } from "date-fns";

const STRATEGIES = [
  { value: "percent", label: "변동률 매매", labelEn: "Percent Trading", desc: "일정 비율 변동 시 매수/매도", descEn: "Buy on drops, sell on rises" },
  { value: "grid", label: "그리드 매매", labelEn: "Grid Trading", desc: "가격 구간별 분할 매매", descEn: "Trade at price grid levels" },
  { value: "dca", label: "DCA 적립식", labelEn: "DCA", desc: "정기적 분할 매수", descEn: "Regular interval buying" },
  { value: "rsi", label: "RSI 전략", labelEn: "RSI Strategy", desc: "과매수/과매도 지표 기반", descEn: "Buy oversold, sell overbought" },
  { value: "ma", label: "이동평균선", labelEn: "Moving Average", desc: "골든크로스/데드크로스", descEn: "Golden/Death cross signals" },
  { value: "bollinger", label: "볼린저 밴드", labelEn: "Bollinger Bands", desc: "밴드 상단/하단 터치 시 매매", descEn: "Trade at band touches" },
];

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { data: settings } = useBotSettings();
  const [formState, setFormState] = useState({
    market: "KRW-BTC",
    strategy: "percent",
    buyThreshold: "0.5",
    sellThreshold: "0.5",
    targetAmount: "10000",
    upbitAccessKey: "",
    upbitSecretKey: "",
  });
  const { data: status } = useUpbitStatus(formState.market);
  const { data: logs } = useTradeLogs();
  const { data: markets, isLoading: marketsLoading } = useMarkets();
  const updateSettings = useUpdateSettings();
  const verifyKeys = useVerifyApiKeys();
  const manualBuy = useManualBuy();
  const manualSell = useManualSell();
  const { data: candles } = useCandles(formState.market, 60);
  const { data: recommendations, isLoading: recommendationsLoading, refetch: refetchRecommendations } = useRecommendations();
  const [buyAmount, setBuyAmount] = useState("10000");

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

  // Calculate technical indicators
  const calculateSMA = (data: number[], period: number): number[] => {
    const sma: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(data[i]);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  };

  const calculateBollingerBands = (data: number[], period: number = 20, stdDev: number = 2) => {
    const sma = calculateSMA(data, period);
    return data.map((_, i) => {
      if (i < period - 1) return { upper: sma[i], middle: sma[i], lower: sma[i] };
      const slice = data.slice(i - period + 1, i + 1);
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma[i], 2), 0) / period;
      const std = Math.sqrt(variance);
      return {
        upper: sma[i] + (std * stdDev),
        middle: sma[i],
        lower: sma[i] - (std * stdDev),
      };
    });
  };

  // Calculate RSI
  const calculateRSI = (prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // Prepare chart data with indicators
  const chartData = candles?.map((candle, i, arr) => {
    const prices = arr.slice(0, i + 1).map(c => c.close);
    const sma5 = prices.length >= 5 ? prices.slice(-5).reduce((a, b) => a + b, 0) / 5 : candle.close;
    const sma20 = prices.length >= 20 ? prices.slice(-20).reduce((a, b) => a + b, 0) / 20 : candle.close;
    const rsi = calculateRSI(prices);
    
    let bb = { upper: candle.close, middle: candle.close, lower: candle.close };
    if (prices.length >= 20) {
      const slice = prices.slice(-20);
      const mean = slice.reduce((a, b) => a + b, 0) / 20;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 20;
      const std = Math.sqrt(variance);
      bb = { upper: mean + (std * 2), middle: mean, lower: mean - (std * 2) };
    }

    return {
      time: format(new Date(candle.timestamp), 'HH:mm'),
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume || 0,
      sma5,
      sma20,
      rsi,
      bbUpper: bb.upper,
      bbMiddle: bb.middle,
      bbLower: bb.lower,
      isUp: candle.close >= candle.open,
      candleBody: [candle.open, candle.close],
      candleWick: [candle.low, candle.high],
    };
  }) || [];

  const priceChange = chartData.length >= 2 
    ? ((chartData[chartData.length - 1]?.close || 0) - (chartData[0]?.close || 0)) / (chartData[0]?.close || 1) * 100 
    : 0;

  const currentRSI = chartData.length > 0 ? chartData[chartData.length - 1]?.rsi || 50 : 50;

  const formatPrice = (price: number | string) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Number(price));
  };

  const selectedMarket = markets?.find(m => m.market === formState.market);
  const coinSymbol = formState.market.split('-')[1] || "BTC";
  const isKorean = i18n.language === 'ko';

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
          title={t('dashboard.totalAsset')}
          value={status?.totalAssetKRW ? formatPrice(status.totalAssetKRW) : "0"}
          icon={PiggyBank}
          description={isKorean ? "원화 + 코인" : "KRW + Coin"}
          trend="up"
          testId="card-total-assets"
        />
        <StatusCard
          title={isKorean ? "수익률" : "Profit/Loss"}
          value={status?.profitLoss !== undefined ? `${status.profitLoss >= 0 ? "+" : ""}${formatPrice(status.profitLoss)}` : "-"}
          icon={status?.profitLoss !== undefined && status.profitLoss >= 0 ? TrendingUp : TrendingDown}
          trend={status?.profitLoss !== undefined ? (status.profitLoss >= 0 ? "up" : "down") : "neutral"}
          description={status?.profitLossPercent !== undefined ? `${status.profitLossPercent >= 0 ? "+" : ""}${status.profitLossPercent.toFixed(2)}%` : "0%"}
          className={status?.profitLoss !== undefined ? (status.profitLoss >= 0 ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5") : ""}
          testId="card-profit-loss"
        />
        <StatusCard
          title={isKorean ? "보유량" : "Holdings"}
          value={status?.balanceCoin ? Number(status.balanceCoin).toFixed(8) : "0"}
          icon={Coins}
          description={coinSymbol}
          testId="card-coin-holdings"
        />
        <StatusCard
          title={isKorean ? "거래 횟수" : "Trades"}
          value={status?.tradeCount?.toString() || "0"}
          icon={BarChart3}
          description={isKorean ? "성공한 거래" : "Successful"}
          testId="card-trade-count"
        />
      </div>

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <CardTitle>{isKorean ? "수동 거래" : "Manual Trade"}</CardTitle>
          </div>
          <CardDescription>{isKorean ? "테스트용 수동 매수/매도" : "Manual buy/sell for testing"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{isKorean ? "매수 금액" : "Buy Amount"}</Label>
              <Input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                className="w-32"
                min="5000"
                step="1000"
                data-testid="input-buy-amount"
              />
              <span className="text-muted-foreground text-sm">KRW</span>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => manualBuy.mutate({ market: formState.market, amount: Number(buyAmount) })}
                disabled={manualBuy.isPending || Number(buyAmount) < 5000}
                data-testid="button-manual-buy"
              >
                {manualBuy.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isKorean ? "매수" : "Buy"}
              </Button>
              <Button 
                variant="destructive"
                onClick={() => manualSell.mutate({ market: formState.market })}
                disabled={manualSell.isPending || !status?.balanceCoin || status.balanceCoin === 0}
                data-testid="button-manual-sell"
              >
                {manualSell.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isKorean ? "전량 매도" : "Sell All"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isKorean ? "최소 주문 금액: 5,000원" : "Min order: 5,000 KRW"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <CardTitle>{isKorean ? "추천 종목" : "Recommended Coins"}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchRecommendations()}
              disabled={recommendationsLoading}
              data-testid="button-refresh-recommendations"
            >
              <RefreshCw className={cn("w-4 h-4", recommendationsLoading && "animate-spin")} />
            </Button>
          </div>
          <CardDescription>{isKorean ? "RSI, 거래량, 변동률 기반 분석" : "Analysis based on RSI, volume, and price changes"}</CardDescription>
        </CardHeader>
        <CardContent>
          {recommendationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : recommendations && recommendations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">{isKorean ? "종목" : "Coin"}</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">{isKorean ? "현재가" : "Price"}</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">{isKorean ? "변동률" : "Change"}</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">RSI</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">{isKorean ? "신호" : "Signal"}</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">{isKorean ? "사유" : "Reason"}</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((rec) => (
                    <tr 
                      key={rec.market} 
                      className="border-b border-border/50 hover-elevate cursor-pointer"
                      onClick={() => setFormState(prev => ({ ...prev, market: rec.market }))}
                      data-testid={`recommendation-row-${rec.market}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex flex-col">
                          <span className="font-medium">{isKorean ? rec.koreanName : rec.englishName}</span>
                          <span className="text-xs text-muted-foreground">{rec.market}</span>
                        </div>
                      </td>
                      <td className="text-right py-2 px-2 font-mono">
                        {formatPrice(rec.currentPrice)}
                      </td>
                      <td className={cn(
                        "text-right py-2 px-2 font-mono",
                        rec.changeRate > 0 ? "text-green-500" : rec.changeRate < 0 ? "text-red-500" : ""
                      )}>
                        <div className="flex items-center justify-end gap-1">
                          {rec.changeRate > 0 ? <ArrowUp className="w-3 h-3" /> : rec.changeRate < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {rec.changeRate > 0 ? "+" : ""}{rec.changeRate.toFixed(2)}%
                        </div>
                      </td>
                      <td className={cn(
                        "text-right py-2 px-2 font-mono",
                        rec.rsi < 30 ? "text-green-500" : rec.rsi > 70 ? "text-red-500" : "text-muted-foreground"
                      )}>
                        {rec.rsi}
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          rec.signal === "strong_buy" && "bg-green-500/20 text-green-500",
                          rec.signal === "buy" && "bg-green-500/10 text-green-400",
                          rec.signal === "hold" && "bg-muted text-muted-foreground",
                          rec.signal === "sell" && "bg-red-500/10 text-red-400",
                          rec.signal === "strong_sell" && "bg-red-500/20 text-red-500"
                        )}>
                          {rec.signal === "strong_buy" && (isKorean ? "강력 매수" : "Strong Buy")}
                          {rec.signal === "buy" && (isKorean ? "매수" : "Buy")}
                          {rec.signal === "hold" && (isKorean ? "관망" : "Hold")}
                          {rec.signal === "sell" && (isKorean ? "매도" : "Sell")}
                          {rec.signal === "strong_sell" && (isKorean ? "강력 매도" : "Strong Sell")}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">
                        {rec.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {isKorean ? "추천 종목을 불러오는 중..." : "Loading recommendations..."}
            </div>
          )}
        </CardContent>
      </Card>

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
                        <span className="text-xs text-muted-foreground">{isKorean ? s.desc : s.descEn}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(formState.strategy === "percent" || formState.strategy === "grid") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{formState.strategy === "grid" ? (isKorean ? "그리드 간격" : "Grid Step") : t('dashboard.buyThreshold')}</Label>
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
                {formState.strategy === "percent" && (
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
                )}
              </div>
            )}

            {formState.strategy === "rsi" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isKorean ? "매수 RSI" : "Buy RSI"}</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={formState.buyThreshold}
                      onChange={e => setFormState({...formState, buyThreshold: e.target.value})}
                      placeholder="30"
                      data-testid="input-rsi-buy"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{isKorean ? "RSI가 이 값 이하일 때 매수" : "Buy when RSI below this"}</p>
                </div>
                <div className="space-y-2">
                  <Label>{isKorean ? "매도 RSI" : "Sell RSI"}</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={formState.sellThreshold}
                      onChange={e => setFormState({...formState, sellThreshold: e.target.value})}
                      placeholder="70"
                      data-testid="input-rsi-sell"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{isKorean ? "RSI가 이 값 이상일 때 매도" : "Sell when RSI above this"}</p>
                </div>
              </div>
            )}

            {formState.strategy === "ma" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isKorean ? "단기 이평선" : "Short MA"}</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={formState.buyThreshold}
                      onChange={e => setFormState({...formState, buyThreshold: e.target.value})}
                      placeholder="5"
                      data-testid="input-ma-short"
                    />
                    <span className="absolute right-3 top-2 text-sm text-muted-foreground">{isKorean ? "분" : "min"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{isKorean ? "장기 이평선" : "Long MA"}</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={formState.sellThreshold}
                      onChange={e => setFormState({...formState, sellThreshold: e.target.value})}
                      placeholder="20"
                      data-testid="input-ma-long"
                    />
                    <span className="absolute right-3 top-2 text-sm text-muted-foreground">{isKorean ? "분" : "min"}</span>
                  </div>
                </div>
              </div>
            )}

            {formState.strategy === "bollinger" && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium mb-1">{isKorean ? "볼린저 밴드 전략" : "Bollinger Bands Strategy"}</p>
                <p className="text-muted-foreground">
                  {isKorean 
                    ? "20분 이동평균선 기준 상/하단 밴드 터치 시 자동 매매 (2 표준편차)" 
                    : "Auto trades when price touches upper/lower bands (20-period SMA, 2 std dev)"}
                </p>
              </div>
            )}

            {formState.strategy === "dca" && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium mb-1">{isKorean ? "DCA 적립식 매수" : "DCA Strategy"}</p>
                <p className="text-muted-foreground">
                  {isKorean 
                    ? "1시간마다 설정한 금액으로 자동 매수합니다" 
                    : "Automatically buys the target amount every hour"}
                </p>
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
                <div className="flex items-center gap-2">
                  <Label className="font-semibold">API Keys</Label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" data-testid="button-api-help">
                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{isKorean ? "Upbit API 키 발급 방법" : "How to Get Upbit API Keys"}</DialogTitle>
                        <DialogDescription>
                          {isKorean ? "API 키를 발급받아 자동매매를 시작하세요" : "Get your API keys to start automated trading"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 text-sm">
                        <div className="space-y-2">
                          <h4 className="font-semibold">{isKorean ? "1. Upbit 로그인" : "1. Login to Upbit"}</h4>
                          <p className="text-muted-foreground">
                            {isKorean 
                              ? "Upbit 웹사이트에 로그인합니다." 
                              : "Log in to the Upbit website."}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold">{isKorean ? "2. Open API 관리 페이지 이동" : "2. Go to Open API Management"}</h4>
                          <p className="text-muted-foreground">
                            {isKorean 
                              ? "마이페이지 > Open API 관리 메뉴로 이동합니다." 
                              : "Navigate to My Page > Open API Management."}
                          </p>
                          <a 
                            href="https://upbit.com/mypage/open_api_management" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {isKorean ? "Open API 관리 페이지 바로가기" : "Go to Open API Management"}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold">{isKorean ? "3. API 키 발급" : "3. Create API Keys"}</h4>
                          <p className="text-muted-foreground">
                            {isKorean 
                              ? "'Open API Key 발급' 버튼을 클릭합니다." 
                              : "Click 'Create Open API Key' button."}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold">{isKorean ? "4. 권한 설정" : "4. Set Permissions"}</h4>
                          <p className="text-muted-foreground">
                            {isKorean 
                              ? "다음 권한을 선택하세요:\n- 자산조회\n- 주문조회\n- 주문하기 (자동매매에 필요)" 
                              : "Select these permissions:\n- View Assets\n- View Orders\n- Place Orders (required for auto-trading)"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold">{isKorean ? "5. IP 허용 설정" : "5. IP Allowlist"}</h4>
                          <p className="text-muted-foreground">
                            {isKorean 
                              ? "'모든 IP 허용' 또는 이 서버 IP를 등록하세요:\n104.154.102.160" 
                              : "Allow all IPs or register this server IP:\n104.154.102.160"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold">{isKorean ? "6. 키 복사" : "6. Copy Keys"}</h4>
                          <p className="text-muted-foreground">
                            {isKorean 
                              ? "발급된 Access Key와 Secret Key를 복사하여 위 입력란에 붙여넣기 하세요.\n\n⚠️ Secret Key는 발급 시에만 확인 가능합니다. 반드시 안전하게 보관하세요." 
                              : "Copy the Access Key and Secret Key and paste them in the fields above.\n\n⚠️ Secret Key is only shown once. Store it safely."}
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
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
          <Card className="flex flex-col" data-testid="card-price-chart">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2" data-testid="text-chart-title">
                  <TrendingUp className="w-5 h-5" />
                  {isKorean ? selectedMarket?.korean_name : selectedMarket?.english_name} ({formState.market})
                </CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <span className={cn(
                    "font-bold",
                    priceChange >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-yellow-500" /> SMA5
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-purple-500" /> SMA20
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-blue-400/50" /> BB
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="time" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      yAxisId="price"
                      domain={['auto', 'auto']} 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}K` : val.toFixed(0)}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                    />
                    <YAxis 
                      yAxisId="volume"
                      orientation="right"
                      domain={[0, (max: number) => max * 4]}
                      hide
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          close: isKorean ? '종가' : 'Close',
                          open: isKorean ? '시가' : 'Open',
                          high: isKorean ? '고가' : 'High',
                          low: isKorean ? '저가' : 'Low',
                          volume: isKorean ? '거래량' : 'Volume',
                          sma5: 'SMA5',
                          sma20: 'SMA20',
                          bbUpper: isKorean ? '상단밴드' : 'Upper BB',
                          bbLower: isKorean ? '하단밴드' : 'Lower BB',
                        };
                        return [name === 'volume' ? value.toFixed(4) : formatPrice(value), labels[name] || name];
                      }}
                    />
                    
                    <Area
                      yAxisId="price"
                      type="monotone"
                      dataKey="bbUpper"
                      stroke="transparent"
                      fill="hsl(210 100% 60% / 0.1)"
                      connectNulls
                    />
                    <Area
                      yAxisId="price"
                      type="monotone"
                      dataKey="bbLower"
                      stroke="transparent"
                      fill="hsl(var(--background))"
                      connectNulls
                    />
                    
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="bbUpper"
                      stroke="hsl(210 100% 60% / 0.5)"
                      strokeWidth={1}
                      dot={false}
                      strokeDasharray="3 3"
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="bbLower"
                      stroke="hsl(210 100% 60% / 0.5)"
                      strokeWidth={1}
                      dot={false}
                      strokeDasharray="3 3"
                    />
                    
                    <Bar yAxisId="volume" dataKey="volume" opacity={0.3}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isUp ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)"} 
                        />
                      ))}
                    </Bar>
                    
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="sma20"
                      stroke="hsl(280 100% 70%)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="sma5"
                      stroke="hsl(45 100% 50%)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="close"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              
              <div className="h-[80px] mt-2 border-t border-border pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">RSI (14)</span>
                  <span className={cn(
                    "text-xs font-bold",
                    currentRSI > 70 ? "text-red-500" : currentRSI < 30 ? "text-green-500" : "text-muted-foreground"
                  )}>
                    {currentRSI.toFixed(1)}
                    {currentRSI > 70 && (isKorean ? " 과매수" : " Overbought")}
                    {currentRSI < 30 && (isKorean ? " 과매도" : " Oversold")}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                    <XAxis dataKey="time" hide />
                    <YAxis 
                      domain={[0, 100]} 
                      ticks={[30, 50, 70]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <ReferenceLine y={70} stroke="hsl(0 84% 60% / 0.5)" strokeDasharray="3 3" />
                    <ReferenceLine y={30} stroke="hsl(142 76% 36% / 0.5)" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="rsi"
                      stroke="hsl(280 100% 70%)"
                      fill="hsl(280 100% 70% / 0.2)"
                      strokeWidth={1.5}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-5 gap-2 mt-4 text-xs">
                <div className="bg-muted/50 rounded-md p-2 text-center">
                  <div className="text-muted-foreground">{isKorean ? "시가" : "Open"}</div>
                  <div className="font-mono font-medium">{chartData[chartData.length - 1]?.open?.toLocaleString() || "-"}</div>
                </div>
                <div className="bg-muted/50 rounded-md p-2 text-center">
                  <div className="text-muted-foreground">{isKorean ? "고가" : "High"}</div>
                  <div className="font-mono font-medium text-green-500">{chartData.length > 0 ? Math.max(...chartData.map(c => c.high)).toLocaleString() : "-"}</div>
                </div>
                <div className="bg-muted/50 rounded-md p-2 text-center">
                  <div className="text-muted-foreground">{isKorean ? "저가" : "Low"}</div>
                  <div className="font-mono font-medium text-red-500">{chartData.length > 0 ? Math.min(...chartData.map(c => c.low)).toLocaleString() : "-"}</div>
                </div>
                <div className="bg-muted/50 rounded-md p-2 text-center">
                  <div className="text-muted-foreground">{isKorean ? "종가" : "Close"}</div>
                  <div className="font-mono font-medium">{chartData[chartData.length - 1]?.close?.toLocaleString() || "-"}</div>
                </div>
                <div className="bg-muted/50 rounded-md p-2 text-center">
                  <div className="text-muted-foreground">RSI</div>
                  <div className={cn(
                    "font-mono font-medium",
                    currentRSI > 70 ? "text-red-500" : currentRSI < 30 ? "text-green-500" : ""
                  )}>{currentRSI.toFixed(1)}</div>
                </div>
              </div>
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

      <Card className="mt-8 border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">
                {isKorean ? "투자 위험 고지 및 면책 조항" : "Investment Risk Disclaimer"}
              </p>
              <p>
                {isKorean 
                  ? "본 서비스는 암호화폐 자동매매 보조 도구로서, 투자 조언을 제공하지 않습니다. 암호화폐 투자는 원금 손실의 위험이 있으며, 과거의 수익률이 미래의 수익을 보장하지 않습니다."
                  : "This service is a cryptocurrency auto-trading assistant tool and does not provide investment advice. Cryptocurrency investments carry the risk of principal loss, and past performance does not guarantee future results."}
              </p>
              <p>
                {isKorean 
                  ? "사용자는 본 서비스 이용으로 인해 발생하는 모든 투자 손실에 대해 전적으로 본인이 책임지며, 서비스 제공자는 어떠한 투자 손실에 대해서도 법적 책임을 지지 않습니다."
                  : "Users are solely responsible for all investment losses incurred from using this service. The service provider assumes no legal liability for any investment losses."}
              </p>
              <p>
                {isKorean 
                  ? "자동매매 봇은 시장 상황, 네트워크 지연, API 오류 등으로 인해 예상과 다르게 작동할 수 있습니다. 투자 결정은 신중하게 본인의 판단 하에 이루어져야 합니다."
                  : "The auto-trading bot may operate differently than expected due to market conditions, network delays, API errors, etc. Investment decisions should be made carefully based on your own judgment."}
              </p>
              <p className="text-xs">
                {isKorean 
                  ? "본 서비스를 이용함으로써 위 면책 조항에 동의하는 것으로 간주됩니다."
                  : "By using this service, you are deemed to agree to the above disclaimer."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
