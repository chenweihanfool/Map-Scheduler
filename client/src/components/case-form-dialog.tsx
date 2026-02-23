import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Loader2, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { CASE_TYPES, type SurveyCase, type Surveyor, type SystemSettings, type SurveyorLeave, type CaseTypeRecord } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Star, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const formSchema = z.object({
  caseNumber: z.string().min(1, "案號為必填"),
  caseType: z.string().min(1, "案件類型為必填"),
  section: z.string().min(1, "地段為必填"),
  lotNumber: z.string().min(1, "地號為必填"),
  owner: z.string().optional(),
  surveyor: z.string().min(1, "測量員為必填"),
  surveyDate: z.string().min(1, "日期為必填"),
  scheduledTime: z.string().min(1, "排件時間為必填"),
  notes: z.string().optional(),
  longitude: z.number().optional().nullable(),
  latitude: z.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const LAND_SECTIONS = [
  { township: "苑裡鎮", sections: [
    "苑裡段北勢小段", "苑裡段苑裡小段", "苑裡坑段水柳坡小段", "貓盂段貓盂小段",
    "田寮段", "舊社段", "山腳段", "大埔段青埔小段", "大埔段大埔小段", "芎蕉坑段",
    "石頭坑段石頭坑小段", "石頭坑段新厝子小段", "南勢林段", "社苓段公館子小段", "社苓段社苓小段",
    "山柑段山柑小段", "山柑段山柑尾小段", "房裡段", "苑港段", "西海段", "房南段",
    "苑東段", "苑西段", "苑南段", "苑北段", "苑中段", "新興段", "福田段", "中正段",
    "房北段", "泰田段", "社柑段", "田中段", "田心段", "鎮安段", "玉山段", "玉豐段",
    "文山段", "新復北段", "新復南段", "新復東段", "啟心段", "上館段", "火炎山段",
    "慈護段", "致民段", "十股段", "蕉埔段", "藍田段", "興隆段", "苑坑段", "中溝段",
    "南山段", "順天段"
  ]},
  { township: "通霄鎮", sections: [
    "白沙屯段", "內湖島段", "新埔段", "上坪段", "北勢窩段", "烏眉坑段", "楓樹窩段", "內湖段",
    "圳頭段", "北勢段", "梅樹腳段", "土城段", "南和段", "福興段", "大坪頂段",
    "五里牌段隘口寮小段", "五里牌段五里牌小段", "五里牌段羊寮小段", "五里牌段五福小段",
    "通東段", "通西段", "通南段", "通北段", "竹林段", "平元段", "海濱段", "南華段",
    "白沙段", "白東段", "內島段", "雲天段", "通灣段", "通平段", "保安林段",
    "內湖東段", "內湖西段", "北梅段", "中山段", "五南段"
  ]},
];

interface CaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCase?: SurveyCase | null;
  defaultDate?: Date;
}

const TIME_SLOTS = ["09:00", "14:00"];

const CASE_TYPE_PREFERRED_SLOTS: Record<string, string[]> = {
  "鑑界": ["09:00"],
  "再鑑界": ["09:00"],
};

const getPreferredSlotsForCaseType = (caseType: string): string[] => {
  return CASE_TYPE_PREFERRED_SLOTS[caseType] || TIME_SLOTS;
};

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const findNextAvailableDate = (
  caseType: string,
  existingCases: SurveyCase[],
  startDate: Date = new Date()
): { date: string; timeSlot: string } => {
  const preferredSlots = getPreferredSlotsForCaseType(caseType);
  let checkDate = new Date(startDate);
  checkDate.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < 365; i++) {
    if (!isWeekend(checkDate)) {
      const dateStr = format(checkDate, "yyyy-MM-dd");
      const casesOnDate = existingCases.filter(c => c.surveyDate === dateStr);
      const bookedSlots = casesOnDate.map(c => c.scheduledTime);
      
      for (const slot of preferredSlots) {
        if (!bookedSlots.includes(slot)) {
          return { date: dateStr, timeSlot: slot };
        }
      }
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }
  
  return { date: format(new Date(), "yyyy-MM-dd"), timeSlot: preferredSlots[0] };
};

interface SurveyorRecommendation {
  surveyor: string;
  score: number;
  reasons: string[];
}

export function CaseFormDialog({ open, onOpenChange, editCase, defaultDate }: CaseFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!editCase;
  const [suggestedSurveyor, setSuggestedSurveyor] = useState<Surveyor | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<string>("sequential");
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

  const { data: allCases = [] } = useQuery<SurveyCase[]>({
    queryKey: ["/api/cases"],
    enabled: open,
  });

  const { data: dynamicCaseTypes = [] } = useQuery<CaseTypeRecord[]>({
    queryKey: ["/api/case-types"],
    enabled: open,
  });

  const getDefaultSurveyDate = () => {
    if (editCase?.surveyDate) return editCase.surveyDate;
    if (defaultDate) return format(defaultDate, "yyyy-MM-dd");
    return "";
  };

  const parseLandParcel = (landParcel: string) => {
    // Try to match format with "地號" suffix first (e.g., "苑裡鎮苑東段184地號")
    const matchWithSuffix = landParcel.match(/^(.+段)(\d+地號.*)$/);
    if (matchWithSuffix) {
      return { section: matchWithSuffix[1], lotNumber: matchWithSuffix[2] };
    }
    // Try to match format without "地號" suffix (e.g., "苑裡鎮芎蕉坑段1", "通霄鎮上坪段100")
    const matchWithoutSuffix = landParcel.match(/^(.+段)(\d+.*)$/);
    if (matchWithoutSuffix) {
      return { section: matchWithoutSuffix[1], lotNumber: matchWithoutSuffix[2] };
    }
    // Try to match township + section format (e.g., "通霄鎮上坪段")
    const matchTownshipSection = landParcel.match(/^([\u4e00-\u9fa5]+[鎮鄉市區][\u4e00-\u9fa5]+段)(.*)$/);
    if (matchTownshipSection) {
      return { section: matchTownshipSection[1], lotNumber: matchTownshipSection[2] };
    }
    // Fallback: if it contains digits at end, try to split there
    const fallbackMatch = landParcel.match(/^(.+?)(\d+.*)$/);
    if (fallbackMatch && fallbackMatch[1].length > 0) {
      return { section: fallbackMatch[1], lotNumber: fallbackMatch[2] };
    }
    // Final fallback: return the full string as section if no match
    return { section: landParcel, lotNumber: "" };
  };

  const getDefaultSection = () => {
    if (editCase?.landParcel) {
      return parseLandParcel(editCase.landParcel).section;
    }
    return "";
  };

  const getDefaultLotNumber = () => {
    if (editCase?.landParcel) {
      return parseLandParcel(editCase.landParcel).lotNumber;
    }
    return "";
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      caseNumber: editCase?.caseNumber ?? "",
      caseType: editCase?.caseType ?? "鑑界",
      section: getDefaultSection(),
      lotNumber: getDefaultLotNumber(),
      surveyor: editCase?.surveyor ?? "",
      surveyDate: getDefaultSurveyDate(),
      scheduledTime: editCase?.scheduledTime ?? "",
      notes: editCase?.notes ?? "",
      longitude: editCase?.longitude ?? null,
      latitude: editCase?.latitude ?? null,
    },
  });

  const watchedSurveyDate = form.watch("surveyDate");
  const watchedSurveyor = form.watch("surveyor");
  const watchedScheduledTime = form.watch("scheduledTime");
  const watchedSection = form.watch("section");
  const watchedLotNumber = form.watch("lotNumber");

  const caseTypeOptions = dynamicCaseTypes.length > 0 
    ? dynamicCaseTypes.map(t => t.name) 
    : [...CASE_TYPES];

  const { data: recommendationData } = useQuery<{ recommendations: SurveyorRecommendation[] }>({
    queryKey: ["/api/cases/recommend-surveyor", watchedSection, watchedLotNumber],
    queryFn: async () => {
      if (!watchedSection || !watchedLotNumber) return { recommendations: [] };
      const params = new URLSearchParams({ section: watchedSection, lotNumber: watchedLotNumber });
      const res = await fetch(`/api/cases/recommend-surveyor?${params}`);
      if (!res.ok) return { recommendations: [] };
      return res.json();
    },
    enabled: open && !!watchedSection && !!watchedLotNumber,
    staleTime: 5000,
  });

  const recommendations = recommendationData?.recommendations ?? [];

  const { data: leavesOnDate = [] } = useQuery<SurveyorLeave[]>({
    queryKey: ["/api/leaves/date", watchedSurveyDate],
    queryFn: async () => {
      if (!watchedSurveyDate) return [];
      const res = await fetch(`/api/leaves/date/${watchedSurveyDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!watchedSurveyDate,
  });

  const isSurveyorOnLeave = !!(watchedSurveyor && leavesOnDate.some(l => l.surveyorName === watchedSurveyor));
  
  // Check if the same surveyor already has a case at the same time slot
  // Different surveyors CAN have cases in the same time slot
  const isTimeSlotFull = !!(watchedSurveyDate && watchedScheduledTime && watchedSurveyor &&
    allCases.filter(c => 
      c.surveyDate === watchedSurveyDate && 
      c.scheduledTime === watchedScheduledTime &&
      c.surveyor === watchedSurveyor &&
      (!isEditing || c.id !== editCase?.id)
    ).length > 0);

  const hasValidationWarnings = isSurveyorOnLeave || isTimeSlotFull;

  const { data: suggestedData, refetch: refetchSuggested } = useQuery<{ surveyor: Surveyor | null; mode: string }>({
    queryKey: ["/api/surveyors/next/suggested", watchedSurveyDate],
    queryFn: async () => {
      const url = watchedSurveyDate 
        ? `/api/surveyors/next/suggested?date=${watchedSurveyDate}`
        : "/api/surveyors/next/suggested";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch suggested surveyor");
      return res.json();
    },
    enabled: open && !isEditing,
    staleTime: 0,
  });

  const hasSmartRecommendations = recommendations.length > 0;

  useEffect(() => {
    if (suggestedData) {
      setSuggestedSurveyor(suggestedData.surveyor);
      setAssignmentMode(suggestedData.mode);
      if (!isEditing && suggestedData.surveyor && isInitialLoad && !hasSmartRecommendations) {
        form.setValue("surveyor", suggestedData.surveyor.name);
      }
    }
  }, [suggestedData, isEditing, isInitialLoad, hasSmartRecommendations]);

  useEffect(() => {
    if (!isEditing && hasSmartRecommendations && recommendations[0]) {
      form.setValue("surveyor", recommendations[0].surveyor);
    }
  }, [hasSmartRecommendations, recommendations, isEditing]);

  useEffect(() => {
    if (open) {
      setIsInitialLoad(true);
      const defaultSurveyor = isEditing 
        ? (editCase?.surveyor ?? "") 
        : "";
      
      const parsed = editCase?.landParcel ? parseLandParcel(editCase.landParcel) : { section: "", lotNumber: "" };
      
      const fallbackType = caseTypeOptions.length > 0 ? caseTypeOptions[0] : "鑑界";
      const defaultCaseType = editCase?.caseType ?? fallbackType;
      let surveyDate = getDefaultSurveyDate();
      let scheduledTime = editCase?.scheduledTime ?? "";
      
      // Only use suggested date/time if NOT editing AND no defaultDate is provided
      if (!isEditing && !defaultDate && allCases.length >= 0) {
        const suggested = findNextAvailableDate(defaultCaseType, allCases);
        surveyDate = suggested.date;
        scheduledTime = suggested.timeSlot;
      } else if (!isEditing && defaultDate && !scheduledTime) {
        // When clicking a calendar day, default to morning slot
        scheduledTime = "上午 09:00";
      }
      
      form.reset({
        caseNumber: editCase?.caseNumber ?? "",
        caseType: defaultCaseType,
        section: parsed.section,
        lotNumber: parsed.lotNumber,
        owner: editCase?.owner ?? "",
        surveyor: defaultSurveyor,
        surveyDate,
        scheduledTime,
        notes: editCase?.notes ?? "",
        longitude: editCase?.longitude ?? null,
        latitude: editCase?.latitude ?? null,
      });
      
      if (!isEditing) {
        refetchSuggested();
      }
      
      setTimeout(() => setIsInitialLoad(false), 100);
    }
  }, [open, editCase, defaultDate]);

  const watchedCaseType = form.watch("caseType");

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
    enabled: open && !isEditing,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { section, lotNumber, ...rest } = data;
      const landParcel = `${section}${lotNumber}`;
      const response = await apiRequest("POST", "/api/cases", { ...rest, landParcel });
      const result = await response.json();
      
      const selectedSurveyor = surveyorsList.find(s => s.name === data.surveyor);
      if (selectedSurveyor && selectedSurveyor.businessAttribute === "複丈組") {
        await apiRequest("PATCH", "/api/settings", {
          lastAssignedSurveyorId: selectedSurveyor.id,
        });
        
        if (assignmentMode === "points" && settings?.caseTypeWeights) {
          const weights = settings.caseTypeWeights as Record<string, number>;
          const weight = weights[data.caseType] ?? 1;
          await apiRequest("POST", `/api/surveyors/${selectedSurveyor.id}/add-points`, {
            points: weight,
          });
        }
      }
      
      return result as { coordinateWarning?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/surveyors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/surveyors/next/suggested"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      
      if (data.coordinateWarning) {
        toast({
          title: "案件已新增（無座標）",
          description: data.coordinateWarning,
          variant: "default",
        });
      } else {
        toast({
          title: "案件已新增",
          description: "測量案件已成功建立，座標已自動取得",
        });
      }
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "新增失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { section, lotNumber, ...rest } = data;
      const landParcel = `${section}${lotNumber}`;
      const response = await apiRequest("PATCH", `/api/cases/${editCase?.id}`, { ...rest, landParcel });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "案件已更新",
        description: "測量案件資料已成功更新",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "更新失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {isEditing ? "編輯測量案件" : "新增測量案件"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "修改測量案件資料，系統會自動重新查詢座標位置" 
              : "填寫測量案件資料，系統會自動從地政資料服務查詢座標位置"
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="caseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>案號 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="例: 114-0001" 
                        {...field} 
                        data-testid="input-case-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="caseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>案件類型 <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-case-type">
                          <SelectValue placeholder="選擇類型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {caseTypeOptions.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>地段 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="例: 苑裡鎮苑東段" 
                          {...field}
                          list="section-list"
                          data-testid="input-section"
                        />
                        <datalist id="section-list">
                          {LAND_SECTIONS.map((group) =>
                            group.sections.map((section) => (
                              <option key={`${group.township}-${section}`} value={`${group.township}${section}`} />
                            ))
                          )}
                        </datalist>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lotNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>地號 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="例: 184地號" 
                        {...field}
                        data-testid="input-lot-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="owner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>所有權人</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="例: 王大明" 
                      {...field}
                      value={field.value || ""}
                      data-testid="input-owner"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {recommendations.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 space-y-2" data-testid="recommendation-panel">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    智慧推薦承辦人
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[280px] text-xs leading-relaxed">
                        <p className="font-medium mb-1">推薦邏輯說明：</p>
                        <p>• 相同地號：+10 分</p>
                        <p>• 鄰近地號（±10號）：+5 分</p>
                        <p>• 需同時填寫地段與地號才會觸發</p>
                        <p className="mt-1 text-muted-foreground">無匹配時回退至順序/積分模式</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-xs text-amber-700/70 dark:text-amber-400/60">
                  依相同地號(+10分)及鄰近±10號(+5分)歷史紀錄推薦
                </div>
                {recommendations.map((rec, idx) => (
                  <div 
                    key={rec.surveyor} 
                    className="flex items-start gap-2 text-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded p-1.5 -mx-1.5 transition-colors"
                    onClick={() => form.setValue("surveyor", rec.surveyor)}
                    data-testid={`recommendation-${idx}`}
                  >
                    <Badge variant={idx === 0 ? "default" : "outline"} className="shrink-0 mt-0.5">
                      {idx === 0 ? "最佳" : `#${idx + 1}`}
                    </Badge>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rec.surveyor}</span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">{rec.score}分</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {rec.reasons.slice(0, 3).map((reason, i) => (
                          <div key={i}>• {reason}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="surveyor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      測量員 <span className="text-destructive">*</span>
                      {!isEditing && hasSmartRecommendations && (
                        <Badge variant="outline" className="text-xs font-normal text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                          <Star className="h-3 w-3 mr-1 fill-amber-500 text-amber-500" />
                          地段推薦
                        </Badge>
                      )}
                      {!isEditing && !hasSmartRecommendations && suggestedSurveyor && (
                        <Badge variant="outline" className="text-xs font-normal">
                          <Sparkles className="h-3 w-3 mr-1" />
                          {assignmentMode === "sequential" ? "順序建議" : "積分建議"}
                        </Badge>
                      )}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-surveyor">
                          <SelectValue placeholder="選擇測量員" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {surveyorsList.map((s) => {
                          const rec = recommendations.find(r => r.surveyor === s.name);
                          return (
                            <SelectItem key={s.id} value={s.name}>
                              <div className="flex items-center gap-2">
                                {rec && (
                                  <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />
                                )}
                                {s.name}
                                {s.businessAttribute !== "複丈組" && (
                                  <span className="text-xs text-muted-foreground">({s.businessAttribute})</span>
                                )}
                                {suggestedSurveyor?.id === s.id && !rec && (
                                  <Sparkles className="h-3 w-3 text-primary" />
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {!isEditing && hasSmartRecommendations && (
                      <p className="text-xs text-muted-foreground">
                        依據地段歷史自動推薦，可手動變更
                      </p>
                    )}
                    {!isEditing && !hasSmartRecommendations && suggestedSurveyor && (
                      <p className="text-xs text-muted-foreground">
                        無地段歷史，依{assignmentMode === "sequential" ? "順序" : "積分"}模式推薦
                      </p>
                    )}
                    {!isEditing && !hasSmartRecommendations && suggestedData && !suggestedData.surveyor && (
                      <p className="text-xs text-muted-foreground">
                        當日所有複丈組測量員皆請假，請手動選擇
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="surveyDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>日期 <span className="text-destructive">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-date-picker"
                          >
                            {field.value ? (
                              format(new Date(field.value), "yyyy/MM/dd")
                            ) : (
                              <span>選擇日期</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[1100]" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="scheduledTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>排件時間 <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input 
                      type="time"
                      placeholder="例: 09:00" 
                      {...field}
                      data-testid="input-time"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">常用時間：09:00（上午）、14:00（下午）</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="其他備註事項..."
                      className="resize-none"
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasValidationWarnings && (
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-1">
                  {isSurveyorOnLeave && (
                    <p>所選測量員 ({watchedSurveyor}) 在該日期請假，請重新選擇</p>
                  )}
                  {isTimeSlotFull && (
                    <p>該測量員在此時段 ({watchedScheduledTime}) 已有案件，請選擇其他時段或測量員</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                取消
              </Button>
              <Button 
                type="submit" 
                disabled={isPending || hasValidationWarnings}
                data-testid="button-submit"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "更新案件" : "新增案件"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
