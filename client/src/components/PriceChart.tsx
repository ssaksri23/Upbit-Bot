import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";

// Mock data generator for the visual effect since we might not have full history API yet
const generateMockData = (currentPrice: number) => {
  const data = [];
  let price = currentPrice || 50000000;
  for (let i = 0; i < 20; i++) {
    price = price * (1 + (Math.random() * 0.02 - 0.01));
    data.push({
      time: i,
      price: Math.floor(price),
    });
  }
  return data;
};

interface PriceChartProps {
  currentPrice: number;
}

export function PriceChart({ currentPrice }: PriceChartProps) {
  const data = generateMockData(currentPrice);
  const isPositive = data[data.length - 1].price >= data[0].price;
  const color = isPositive ? "#22c55e" : "#ef4444"; // Green or Red

  return (
    <Card className="glass-card h-[400px] w-full p-6 flex flex-col border-none shadow-none bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Market Overview</h3>
          <p className="text-sm text-muted-foreground">Real-time price action</p>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-white/5 text-muted-foreground">
            1H
          </span>
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-primary/20 text-primary">
            1D
          </span>
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-white/5 text-muted-foreground">
            1W
          </span>
        </div>
      </div>
      
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis 
              dataKey="time" 
              hide 
            />
            <YAxis 
              domain={['auto', 'auto']}
              orientation="right"
              tick={{ fill: '#6b7280', fontSize: 12, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`}
              stroke="#ffffff10"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(17, 24, 39, 0.9)', 
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                backdropFilter: 'blur(8px)'
              }}
              itemStyle={{ color: '#fff', fontFamily: 'JetBrains Mono' }}
              formatter={(value: number) => [`₩${value.toLocaleString()}`, 'Price']}
              labelStyle={{ display: 'none' }}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke={color} 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
