import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { MapPin, Calendar, Clock, User, FileText, CheckCircle, XCircle, Loader2, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SurveyCase } from "@shared/schema";

interface CaseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: SurveyCase | null;
  onEdit?: (caseData: SurveyCase) => void;
}

export function CaseDetailDialog({ open, onOpenChange, caseData, onEdit }: CaseDetailDialogProps) {
  if (!caseData) return null;

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
            <DialogTitle className="text-xl">{caseData.caseNumber}</DialogTitle>
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
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{caseData.caseType}</Badge>
            {getCoordinateStatusBadge()}
          </div>

          <Separator />

          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">地段地號</p>
                <p className="text-sm text-muted-foreground">{caseData.landParcel}</p>
              </div>
            </div>

            {caseData.owner && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">所有權人</p>
                  <p className="text-sm text-muted-foreground">{caseData.owner}</p>
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
