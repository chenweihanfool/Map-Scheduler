import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Loader2, MapPin } from "lucide-react";
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
import type { SurveyCase } from "@shared/schema";

const formSchema = z.object({
  caseNumber: z.string().min(1, "案號為必填"),
  landParcel: z.string().min(1, "地段地號為必填"),
  surveyor: z.string().min(1, "測量員為必填"),
  surveyDate: z.string().min(1, "日期為必填"),
  scheduledTime: z.string().min(1, "排件時間為必填"),
  notes: z.string().optional(),
  longitude: z.number().optional().nullable(),
  latitude: z.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface CaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCase?: SurveyCase | null;
}

const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00"
];

const surveyors = [
  "王小明", "李大華", "張文雄", "陳志偉", "林美玲"
];

export function CaseFormDialog({ open, onOpenChange, editCase }: CaseFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!editCase;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      caseNumber: editCase?.caseNumber ?? "",
      landParcel: editCase?.landParcel ?? "",
      surveyor: editCase?.surveyor ?? "",
      surveyDate: editCase?.surveyDate ?? "",
      scheduledTime: editCase?.scheduledTime ?? "",
      notes: editCase?.notes ?? "",
      longitude: editCase?.longitude ?? null,
      latitude: editCase?.latitude ?? null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/cases", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
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
      const response = await apiRequest("PATCH", `/api/cases/${editCase?.id}`, data);
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
                name="landParcel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>地段地號 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="例: 苗栗市中正段123地號" 
                        {...field}
                        data-testid="input-land-parcel"
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
                    <FormLabel>測量員 <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-surveyor">
                          <SelectValue placeholder="選擇測量員" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {surveyors.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>排件時間 <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-time">
                        <SelectValue placeholder="選擇時間" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
