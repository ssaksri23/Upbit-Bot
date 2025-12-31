import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { TrendingUp, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  const { t } = useTranslation();

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-50" />

      <div className="container px-4 text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center justify-center p-3 mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 ring-1 ring-white/10 shadow-2xl">
            <TrendingUp className="w-12 h-12 text-primary" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            {t('dashboard.welcome')}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('dashboard.subtitle')}
          </p>

          <Button 
            size="lg" 
            onClick={handleLogin}
            className="text-lg px-8 py-6 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-1"
          >
            {t('dashboard.login')}
          </Button>
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-3 gap-8 mt-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {[
            { icon: Zap, title: "Fast Execution", desc: "Real-time market monitoring and instant trade execution." },
            { icon: ShieldCheck, title: "Secure", desc: "Your keys are encrypted. We prioritize security first." },
            { icon: TrendingUp, title: "Automated", desc: "Set your strategy and let the bot do the work 24/7." }
          ].map((item, i) => (
            <div key={i} className="p-6 rounded-2xl bg-card/50 border border-white/5 backdrop-blur-sm hover:bg-card/80 transition-colors">
              <item.icon className="w-8 h-8 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
