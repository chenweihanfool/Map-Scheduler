import { format } from "date-fns";
import { CalendarIcon, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import type { Surveyor } from "@shared/schema";

interface SearchFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  surveyorFilter: string;
  onSurveyorFilterChange: (value: string) => void;
  dateFilter: Date | undefined;
  onDateFilterChange: (date: Date | undefined) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

export function SearchFilters({
  searchQuery,
  onSearchChange,
  surveyorFilter,
  onSurveyorFilterChange,
  dateFilter,
  onDateFilterChange,
  statusFilter,
  onStatusFilterChange,
  onClearFilters,
}: SearchFiltersProps) {
  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

  const hasActiveFilters = searchQuery || surveyorFilter || dateFilter || statusFilter;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋案號、地段地號..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <Select value={surveyorFilter} onValueChange={onSurveyorFilterChange}>
          <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-filter-surveyor">
            <SelectValue placeholder="測量員" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部測量員</SelectItem>
            {surveyorsList.map((s) => (
              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[160px] justify-start text-left font-normal",
                !dateFilter && "text-muted-foreground"
              )}
              data-testid="button-filter-date"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFilter ? format(dateFilter, "yyyy/MM/dd") : "選擇日期"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={onDateFilterChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-filter-status">
            <SelectValue placeholder="座標狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failed">失敗</SelectItem>
            <SelectItem value="pending">待查詢</SelectItem>
            <SelectItem value="processing">處理中</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearFilters}
            className="shrink-0"
            data-testid="button-clear-filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onDateFilterChange(new Date())}
          data-testid="badge-filter-today"
        >
          今日
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            onDateFilterChange(weekStart);
          }}
          data-testid="badge-filter-this-week"
        >
          本週
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onStatusFilterChange("pending")}
          data-testid="badge-filter-pending"
        >
          待查詢座標
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onStatusFilterChange("failed")}
          data-testid="badge-filter-failed"
        >
          查詢失敗
        </Button>
      </div>
    </div>
  );
}
