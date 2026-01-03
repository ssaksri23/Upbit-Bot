import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertBotSettingsSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const formSchema = insertBotSettingsSchema.extend({
  buyThreshold: z.coerce.string(),
  sellThreshold: z.coerce.string(),
  targetAmount: z.coerce.string(),
  stopLossPercent: z.coerce.string(),
  takeProfitPercent: z.coerce.string(),
});

type SettingsFormValues = z.infer<typeof formSchema>;

interface SettingsFormProps {
  initialData?: SettingsFormValues;
  onSubmit: (data: Partial<SettingsFormValues>) => void;
  isPending: boolean;
}

export function SettingsForm({ initialData, onSubmit, isPending }: SettingsFormProps) {
  const { toast } = useToast();
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      market: "KRW-BTC",
      buyThreshold: "0.5",
      sellThreshold: "0.5",
      targetAmount: "10000",
      stopLossPercent: "5",
      takeProfitPercent: "10",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  const handleSubmit = (data: SettingsFormValues) => {
    onSubmit(data);
    toast({
      title: "Settings Saved",
      description: "Bot configuration has been updated successfully.",
    });
  };

  return (
    <div className="glass-card p-6 rounded-2xl h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Strategy Configuration</h3>
        <p className="text-sm text-muted-foreground">Configure your trading parameters</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 flex-1 flex flex-col">
          <FormField
            control={form.control}
            name="market"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Target Market</FormLabel>
                <FormControl>
                  <Input {...field} className="glass-input h-12 text-lg font-mono" placeholder="KRW-BTC" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="buyThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-green-400/80 font-semibold">Buy Drop %</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} type="number" step="0.1" className="glass-input h-12 font-mono pr-8" data-testid="input-buy-threshold" />
                      <span className="absolute right-3 top-3 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sellThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-red-400/80 font-semibold">Sell Rise %</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} type="number" step="0.1" className="glass-input h-12 font-mono pr-8" data-testid="input-sell-threshold" />
                      <span className="absolute right-3 top-3 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="stopLossPercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-red-500/80 font-semibold">Stop-Loss %</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} type="number" step="0.5" className="glass-input h-12 font-mono pr-8" data-testid="input-stop-loss" />
                      <span className="absolute right-3 top-3 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="takeProfitPercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-green-500/80 font-semibold">Take-Profit %</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} type="number" step="0.5" className="glass-input h-12 font-mono pr-8" data-testid="input-take-profit" />
                      <span className="absolute right-3 top-3 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="targetAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Trade Amount (KRW)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-muted-foreground">₩</span>
                    <Input {...field} type="number" step="1000" className="glass-input h-12 font-mono pl-8" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="mt-auto pt-6">
            <Button 
              type="submit" 
              disabled={isPending}
              className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 shadow-lg shadow-primary/20"
            >
              {isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Update Strategy
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
