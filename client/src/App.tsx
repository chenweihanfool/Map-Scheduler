import { Switch, Route } from "wouter";
import { useDateStyle } from "@/lib/date-style";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SettingsPage from "@/pages/settings";
import SurveyorsPage from "@/pages/surveyors";
import LeavesPage from "@/pages/leaves";
import ReportsPage from "@/pages/reports";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
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
