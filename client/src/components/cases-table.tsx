import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  Edit2,
  Trash2,
  MapPin,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SurveyCase } from "@shared/schema";

interface CasesTableProps {
  cases: SurveyCase[];
  isLoading: boolean;
  onEdit: (surveyCase: SurveyCase) => void;
}

function CoordinateStatusBadge({ status, longitude, latitude }: { 
  status: string | null; 
  longitude: number | null; 
  latitude: number | null;
}) {
  if (status === "success" && longitude && latitude) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Badge variant="default" className="bg-green-600 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              成功
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>經度: {longitude.toFixed(6)}</p>
          <p>緯度: {latitude.toFixed(6)}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        處理中
      </Badge>
    );
  }
  
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        失敗
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Clock className="h-3 w-3" />
      待查詢
    </Badge>
  );
}

type SortField = "caseNumber" | "surveyor" | "surveyDate" | null;
type SortDirection = "asc" | "desc";

export function CasesTable({ cases, isLoading, onEdit }: CasesTableProps) {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        // Reset sorting
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedCases = useMemo(() => {
    if (!sortField) return cases;
    
    return [...cases].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "caseNumber":
          comparison = a.caseNumber.localeCompare(b.caseNumber, "zh-TW", { numeric: true });
          break;
        case "surveyor":
          comparison = (a.surveyor || "").localeCompare(b.surveyor || "", "zh-TW");
          break;
        case "surveyDate":
          comparison = a.surveyDate.localeCompare(b.surveyDate);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [cases, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "案件已刪除",
        description: "測量案件已成功刪除",
      });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const refreshCoordinatesMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/cases/${id}/refresh-coordinates`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "座標查詢中",
        description: "系統正在重新查詢座標資訊",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "查詢失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">尚無測量案件</h3>
        <p className="text-muted-foreground text-sm">
          點擊「新增案件」按鈕建立第一筆測量案件
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead 
                className="font-semibold w-[100px] cursor-pointer hover:bg-muted/80 select-none"
                onClick={() => handleSort("caseNumber")}
                data-testid="header-sort-case-number"
              >
                <span className="flex items-center">
                  案號
                  <SortIcon field="caseNumber" />
                </span>
              </TableHead>
              <TableHead className="font-semibold w-[80px]">類型</TableHead>
              <TableHead className="font-semibold min-w-[180px]">地段地號</TableHead>
              <TableHead 
                className="font-semibold w-[100px] cursor-pointer hover:bg-muted/80 select-none"
                onClick={() => handleSort("surveyor")}
                data-testid="header-sort-surveyor"
              >
                <span className="flex items-center">
                  測量員
                  <SortIcon field="surveyor" />
                </span>
              </TableHead>
              <TableHead 
                className="font-semibold w-[100px] cursor-pointer hover:bg-muted/80 select-none"
                onClick={() => handleSort("surveyDate")}
                data-testid="header-sort-date"
              >
                <span className="flex items-center">
                  日期
                  <SortIcon field="surveyDate" />
                </span>
              </TableHead>
              <TableHead className="font-semibold w-[80px]">時間</TableHead>
              <TableHead className="font-semibold w-[100px]">座標狀態</TableHead>
              <TableHead className="font-semibold w-[100px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCases.map((surveyCase, index) => (
              <TableRow 
                key={surveyCase.id} 
                className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                data-testid={`row-case-${surveyCase.id}`}
              >
                <TableCell className="font-medium" data-testid={`text-case-number-${surveyCase.id}`}>
                  {surveyCase.caseNumber}
                </TableCell>
                <TableCell data-testid={`text-case-type-${surveyCase.id}`}>
                  <Badge variant="outline" className="text-xs">
                    {surveyCase.caseType}
                  </Badge>
                </TableCell>
                <TableCell data-testid={`text-land-parcel-${surveyCase.id}`}>
                  {surveyCase.landParcel}
                </TableCell>
                <TableCell data-testid={`text-surveyor-${surveyCase.id}`}>
                  {surveyCase.surveyor}
                </TableCell>
                <TableCell data-testid={`text-date-${surveyCase.id}`}>
                  {surveyCase.surveyDate ? format(new Date(surveyCase.surveyDate), "yyyy/MM/dd", { locale: zhTW }) : "-"}
                </TableCell>
                <TableCell data-testid={`text-time-${surveyCase.id}`}>
                  {surveyCase.scheduledTime}
                </TableCell>
                <TableCell>
                  <CoordinateStatusBadge 
                    status={surveyCase.coordinateStatus} 
                    longitude={surveyCase.longitude}
                    latitude={surveyCase.latitude}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => refreshCoordinatesMutation.mutate(surveyCase.id)}
                          disabled={refreshCoordinatesMutation.isPending}
                          data-testid={`button-refresh-${surveyCase.id}`}
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshCoordinatesMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>重新查詢座標</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(surveyCase)}
                          data-testid={`button-edit-${surveyCase.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>編輯</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(surveyCase.id)}
                          data-testid={`button-delete-${surveyCase.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>刪除</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此測量案件嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "刪除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
