import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { MapPin, Calendar, Clock, User, FileText, CheckCircle, XCircle, Loader2, Edit, CalendarClock, ArrowRight, ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { isPostponed, isPostponePending, type SurveyCase } from "@shared/schema";
import { caseLabel, formatRocDate, applicantText } from "@/lib/receive";

interface CaseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: SurveyCase | null;
  onEdit?: (caseData: SurveyCase) => void;
  onPostpone?: (caseData: SurveyCase) => void;
  onOpenCase?: (id: string) => void;
}

export function CaseDetailDialog({ open, onOpenChange, caseData, onEdit, onPostpone, onOpenCase }: CaseDetailDialogProps) {
  const { toast } = useToast();
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/cases/${id}/postpone/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({ title: "已取消延期" });
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: "取消失敗", description: error.message, variant: "destructive" }),
  });
  if (!caseData) return null;
  const postponed = isPostponed(caseData), pending = isPostponePending(caseData);

  const getCoordinateStatusBadge = () => {
    switch (caseData.coordinateStatus) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            座標已取得
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            座標取得失敗
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            座標查詢中
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            等待查詢
          </Badge>
        );
    }
  };

  const formattedDate = caseData.surveyDate
    ? format(new Date(caseData.surveyDate), "yyyy年MM月dd日 (EEEE)", { locale: zhTW })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-xl">{caseLabel(caseData)}</DialogTitle>
              {(caseData.receiveDate || caseData.receiveWord) && (
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-receive-info">
                  收件 {[formatRocDate(caseData.receiveDate, "long"), caseData.receiveWord].filter(Boolean).join("・")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
            {onPostpone && (!postponed || pending) && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                onClick={() => {
                  onOpenChange(false);
                  onPostpone(caseData);
                }}
                data-testid="button-postpone-case"
              >
                <CalendarClock className="h-4 w-4 mr-1" />
                {pending ? "排定延期日期" : "延期"}
              </Button>
            )}
            {onEdit && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(caseData);
                }}
                data-testid="button-edit-case"
              >
                <Edit className="h-4 w-4 mr-1" />
                編輯
              </Button>
            )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{caseData.caseType}</Badge>
            {postponed && (
              <Badge className="bg-amber-500 hover:bg-amber-500 text-white" data-testid="badge-postponed">
                {pending ? "延期・未排日期" : "延期"}
              </Badge>
            )}
            {getCoordinateStatusBadge()}
          </div>

          {(postponed || caseData.postponedFromId) && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-sm space-y-1.5" data-testid="postpone-info">
              {postponed && <div><span className="font-medium">延期理由：</span>{caseData.postponeReason || "（未填）"}</div>}
              {caseData.postponedToId && (
                <button type="button" className="flex items-center gap-1 text-amber-700 dark:text-amber-400 hover:underline" onClick={() => onOpenCase?.(caseData.postponedToId!)}>
                  已延期至 {caseData.postponedToDate} {caseData.postponedToTime}<ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              {pending && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-700 dark:text-amber-400">尚未排定延期日期</span>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => cancelMutation.mutate(caseData.id)} disabled={cancelMutation.isPending} data-testid="button-cancel-postpone">
                    取消延期
                  </Button>
                </div>
              )}
              {caseData.postponedFromId && (
                <button type="button" className="flex items-center gap-1 text-amber-700 dark:text-amber-400 hover:underline" onClick={() => onOpenCase?.(caseData.postponedFromId!)}>
                  <ArrowLeft className="h-3.5 w-3.5" />由 {caseData.postponedFromDate} {caseData.postponedFromTime} 延期而來
                </button>
              )}
            </div>
          )}

          <Separator />

          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">地段地號</p>
                <p className="text-sm text-muted-foreground">{caseData.landParcel}</p>
              </div>
            </div>

            {applicantText(caseData) && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">申請人</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-applicant">{applicantText(caseData)}</p>
                </div>
              </div>
            )}

            {caseData.agent && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">代理人</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-agent">{caseData.agent}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">預定日期</p>
                <p className="text-sm text-muted-foreground">{formattedDate}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">排件時間</p>
                <p className="text-sm text-muted-foreground">{caseData.scheduledTime}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">測量員</p>
                <p className="text-sm text-muted-foreground">{caseData.surveyor}</p>
              </div>
            </div>

            {(caseData.longitude && caseData.latitude) && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">座標 (TWD97)</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    E {caseData.longitude?.toFixed(2)} / N {caseData.latitude?.toFixed(2)}
                  </p>
                  {caseData.coordinateSource && (
                    <p className="text-xs text-muted-foreground">
                      來源: {caseData.coordinateSource === "nlsc" ? "NLSC 國土測繪中心" : "苗栗縣 GIS"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {caseData.notes && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">備註</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{caseData.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
