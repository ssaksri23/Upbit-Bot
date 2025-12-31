import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { TrendingUp, ShieldCheck, Zap, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const { t } = useTranslation();
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, password, displayName });
      }
    } catch (error: any) {
      toast({
        title: mode === "login" ? t("auth.loginFailed") : t("auth.registerFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isLoading = isLoggingIn || isRegistering;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-50" />

      <div className="container px-4 z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center justify-center p-3 mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 ring-1 ring-white/10 shadow-2xl">
              <TrendingUp className="w-12 h-12 text-primary" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text">
              {t("dashboard.welcome")}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-xl">
              {t("dashboard.subtitle")}
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              {[
                { icon: Zap, title: t("landing.fast"), desc: t("landing.fastDesc") },
                { icon: ShieldCheck, title: t("landing.secure"), desc: t("landing.secureDesc") },
                { icon: TrendingUp, title: t("landing.auto"), desc: t("landing.autoDesc") }
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
                  <item.icon className="w-6 h-6 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="backdrop-blur-sm bg-card/80">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">
                  {mode === "login" ? t("auth.login") : t("auth.register")}
                </CardTitle>
                <CardDescription>
                  {mode === "login" ? t("auth.loginDesc") : t("auth.registerDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "register" && (
                    <div className="space-y-2">
                      <Label htmlFor="displayName">{t("auth.displayName")}</Label>
                      <Input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t("auth.displayNamePlaceholder")}
                        data-testid="input-display-name"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("auth.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.emailPlaceholder")}
                      required
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("auth.passwordPlaceholder")}
                      required
                      minLength={6}
                      data-testid="input-password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-submit-auth"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {mode === "login" ? t("auth.loginButton") : t("auth.registerButton")}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm">
                  {mode === "login" ? (
                    <p className="text-muted-foreground">
                      {t("auth.noAccount")}{" "}
                      <button
                        type="button"
                        onClick={() => setMode("register")}
                        className="text-primary hover:underline"
                        data-testid="link-register"
                      >
                        {t("auth.registerLink")}
                      </button>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      {t("auth.hasAccount")}{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="text-primary hover:underline"
                        data-testid="link-login"
                      >
                        {t("auth.loginLink")}
                      </button>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
