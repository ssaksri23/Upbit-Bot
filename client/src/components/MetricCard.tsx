import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
  isLoading?: boolean;
  className?: string;
}

export function MetricCard({ 
  label, 
  value, 
  subValue, 
  icon, 
  trend, 
  isLoading,
  className 
}: MetricCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass-card p-6 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-colors",
        className
      )}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
        {icon}
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 text-muted-foreground mb-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary ring-1 ring-primary/20">
            {icon}
          </div>
          <span className="text-sm font-medium font-mono uppercase tracking-wider">{label}</span>
        </div>
        
        {isLoading ? (
          <div className="h-8 w-32 bg-white/5 animate-pulse rounded my-2" />
        ) : (
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              {value}
            </h3>
            {subValue && (
              <span className={cn(
                "text-sm font-medium font-mono",
                trend === "up" ? "text-green-400" : 
                trend === "down" ? "text-red-400" : 
                "text-muted-foreground"
              )}>
                {subValue}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Decorative gradient blob */}
      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-primary/20 blur-[50px] rounded-full group-hover:bg-primary/30 transition-colors" />
    </motion.div>
  );
}
