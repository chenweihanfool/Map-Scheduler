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
import { CASE_TYPES, type SurveyCase, type Surveyor, type SystemSettings } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  caseNumber: z.string().min(1, "案號為必填"),
  caseType: z.string().min(1, "案件類型為必填"),
  section: z.string().min(1, "地段為必填"),
  lotNumber: z.string().min(1, "地號為必填"),
  surveyor: z.string().min(1, "測量員為必填"),
  surveyDate: z.string().min(1, "日期為必填"),
  scheduledTime: z.string().min(1, "排件時間為必填"),
  notes: z.string().optional(),
  longitude: z.number().optional().nullable(),
  latitude: z.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const LAND_SECTIONS = [
  { township: "苑裡鎮", sections: ["苑裡段", "苑東段", "苑西段", "苑南段", "苑北段", "房裡段", "山腳段", "舊社段", "社苓段", "蕉埔段", "石鎮段", "田寮段", "新復段", "山柑段", "水坡段"] },
  { township: "通霄鎮", sections: ["通霄段", "城北段", "城南段", "五里牌段", "圳頭段", "楓樹窩段", "南和段", "烏眉段", "福興段", "白沙屯段", "新埔段", "內湖段", "坪頂段", "梅樹坑段"] },
];

interface CaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCase?: SurveyCase | null;
  defaultDate?: Date;
}

const TIME_SLOTS = ["09:00", "14:00"];

const CASE_TYPE_ALLOWED_SLOTS: Record<string, string[]> = {
  "鑑界": ["09:00"],
  "再鑑界": ["09:00"],
};

const getAllowedSlotsForCaseType = (caseType: string): string[] => {
  return CASE_TYPE_ALLOWED_SLOTS[caseType] || TIME_SLOTS;
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
  const allowedSlots = getAllowedSlotsForCaseType(caseType);
  let checkDate = new Date(startDate);
  checkDate.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < 365; i++) {
    if (!isWeekend(checkDate)) {
      const dateStr = format(checkDate, "yyyy-MM-dd");
      const casesOnDate = existingCases.filter(c => c.surveyDate === dateStr);
      const bookedSlots = casesOnDate.map(c => c.scheduledTime);
      
      for (const slot of allowedSlots) {
        if (!bookedSlots.includes(slot)) {
          return { date: dateStr, timeSlot: slot };
        }
      }
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }
  
  return { date: format(new Date(), "yyyy-MM-dd"), timeSlot: allowedSlots[0] };
};

export function CaseFormDialog({ open, onOpenChange, editCase, defaultDate }: CaseFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!editCase;
  const [suggestedSurveyor, setSuggestedSurveyor] = useState<Surveyor | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<string>("sequential");

  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

  const { data: allCases = [] } = useQuery<SurveyCase[]>({
    queryKey: ["/api/cases"],
    enabled: open,
  });

  const { data: suggestedData } = useQuery<{ surveyor: Surveyor | null; mode: string }>({
    queryKey: ["/api/surveyors/next/suggested"],
    enabled: open && !isEditing,
  });

  const getDefaultSurveyDate = () => {
    if (editCase?.surveyDate) return editCase.surveyDate;
    if (defaultDate) return format(defaultDate, "yyyy-MM-dd");
    return "";
  };

  const parseLandParcel = (landParcel: string) => {
    const match = landParcel.match(/^(.+?)(\d+地號.*)$/);
    if (match) {
      return { section: match[1], lotNumber: match[2] };
    }
    return { section: "", lotNumber: "" };
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

  useEffect(() => {
    if (suggestedData) {
      setSuggestedSurveyor(suggestedData.surveyor);
      setAssignmentMode(suggestedData.mode);
    }
  }, [suggestedData]);

  useEffect(() => {
    if (open) {
      const defaultSurveyor = isEditing 
        ? (editCase?.surveyor ?? "") 
        : (suggestedData?.surveyor?.name ?? "");
      
      const parsed = editCase?.landParcel ? parseLandParcel(editCase.landParcel) : { section: "", lotNumber: "" };
      
      const defaultCaseType = editCase?.caseType ?? "鑑界";
      let surveyDate = getDefaultSurveyDate();
      let scheduledTime = editCase?.scheduledTime ?? "";
      
      if (!isEditing && allCases.length >= 0) {
        const suggested = findNextAvailableDate(defaultCaseType, allCases);
        surveyDate = suggested.date;
        scheduledTime = suggested.timeSlot;
      }
      
      form.reset({
        caseNumber: editCase?.caseNumber ?? "",
        caseType: defaultCaseType,
        section: parsed.section,
        lotNumber: parsed.lotNumber,
        surveyor: defaultSurveyor,
        surveyDate,
        scheduledTime,
        notes: editCase?.notes ?? "",
        longitude: editCase?.longitude ?? null,
        latitude: editCase?.latitude ?? null,
      });
    }
  }, [open, editCase, defaultDate, suggestedData, allCases]);

  const watchedCaseType = form.watch("caseType");
  
  useEffect(() => {
    if (open && !isEditing && watchedCaseType) {
      const suggested = findNextAvailableDate(watchedCaseType, allCases);
      const allowedSlots = getAllowedSlotsForCaseType(watchedCaseType);
      const currentTime = form.getValues("scheduledTime");
      
      form.setValue("surveyDate", suggested.date);
      if (!allowedSlots.includes(currentTime)) {
        form.setValue("scheduledTime", suggested.timeSlot);
      }
    }
  }, [watchedCaseType]);

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
    enabled: open && !isEditing,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { section, lotNumber, ...rest } = data;
      const landParcel = `${section}${lotNumber}`;
      const response = await apiRequest("POST", "/api/cases", { ...rest, landParcel });
      
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
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/surveyors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/surveyors/next/suggested"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "案件已新增",
        description: "測量案件已成功建立，系統將自動查詢座標資訊",
      });
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
      <DialogContent className="sm:max-w-[600px]">
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
                        {CASE_TYPES.map((type) => (
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
                          {LAND_SECTIONS.map((group) =>
                            group.sections.map((section) => (
                              <option key={section} value={section} />
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="surveyor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      測量員 <span className="text-destructive">*</span>
                      {!isEditing && suggestedSurveyor && (
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
                        {surveyorsList.map((s) => (
                          <SelectItem key={s.id} value={s.name}>
                            <div className="flex items-center gap-2">
                              {s.name}
                              {s.businessAttribute !== "複丈組" && (
                                <span className="text-xs text-muted-foreground">({s.businessAttribute})</span>
                              )}
                              {suggestedSurveyor?.id === s.id && (
                                <Sparkles className="h-3 w-3 text-primary" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <PopoverContent className="w-auto p-0" align="start">
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
              render={({ field }) => {
                const allowedSlots = getAllowedSlotsForCaseType(watchedCaseType || "鑑界");
                return (
                  <FormItem>
                    <FormLabel>排件時間 <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-time">
                          <SelectValue placeholder="選擇時間" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allowedSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time === "09:00" ? "上午 09:00" : "下午 14:00"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
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
                disabled={isPending}
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
