import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Filter, X } from "lucide-react";
import { CASE_TYPES, type Surveyor } from "@shared/schema";

interface CalendarFiltersProps {
  surveyorFilter: string;
  onSurveyorFilterChange: (value: string) => void;
  caseTypeFilter: string;
  onCaseTypeFilterChange: (value: string) => void;
  showVacantOnly: boolean;
  onShowVacantOnlyChange: (value: boolean) => void;
  onClearFilters: () => void;
}

export function CalendarFilters({
  surveyorFilter,
  onSurveyorFilterChange,
  caseTypeFilter,
  onCaseTypeFilterChange,
  showVacantOnly,
  onShowVacantOnlyChange,
  onClearFilters,
}: CalendarFiltersProps) {
  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

  const hasActiveFilters = surveyorFilter || caseTypeFilter || showVacantOnly;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">篩選：</span>
      </div>

      <Select value={surveyorFilter} onValueChange={onSurveyorFilterChange}>
        <SelectTrigger className="w-[140px]" data-testid="filter-surveyor">
          <SelectValue placeholder="全部測量員" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部測量員</SelectItem>
          {surveyorsList.map((s) => (
            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={caseTypeFilter} onValueChange={onCaseTypeFilterChange}>
        <SelectTrigger className="w-[140px]" data-testid="filter-case-type">
          <SelectValue placeholder="全部類型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部類型</SelectItem>
          {CASE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>{type}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Switch
          id="show-vacant"
          checked={showVacantOnly}
          onCheckedChange={onShowVacantOnlyChange}
          data-testid="switch-vacant"
        />
        <Label htmlFor="show-vacant" className="text-sm">
          僅顯示空白時段
        </Label>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} data-testid="button-clear-filters">
          <X className="h-4 w-4 mr-1" />
          清除篩選
        </Button>
      )}
    </div>
  );
}
