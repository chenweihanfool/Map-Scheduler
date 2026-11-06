import { Switch, Route } from "wouter";
import { useDateStyle } from "@/lib/date-style";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import MobileHome from "@/pages/mobile-home";
import { useEffect, useState } from "react";

// 手機（寬度 767px 以下）預設用 App 式的手機版；可在手機版「更多」切換到電腦版畫面（記在這台手機）
function useIsPhone() {
  const q = "(max-width: 767px)";
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q), on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}
function HomeSwitch() {
  const phone = useIsPhone();
  let desktop = false;
  try { desktop = localStorage.getItem("ms-view") === "desktop"; } catch { /* 無痕視窗 */ }
  return phone && !desktop ? <MobileHome /> : <Home />;
}
import SettingsPage from "@/pages/settings";
import SurveyorsPage from "@/pages/surveyors";
import LeavesPage from "@/pages/leaves";
import ReportsPage from "@/pages/reports";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeSwitch} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/surveyors" component={SurveyorsPage} />
      <Route path="/leaves" component={LeavesPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [dateStyle] = useDateStyle();   // 切換民國／西元時重新繪製所有畫面
  return (
    <ThemeProvider defaultTheme="light" storageKey="survey-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router key={dateStyle} />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
