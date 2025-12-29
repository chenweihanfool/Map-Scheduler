import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import type { SurveyCase } from "@shared/schema";

interface CaseSearchProps {
  onCaseSelect: (caseItem: SurveyCase) => void;
}

export function CaseSearch({ onCaseSelect }: CaseSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResults = [], isLoading } = useQuery<SurveyCase[]>({
    queryKey: ["/api/cases/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const response = await fetch(`/api/cases/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const handleSelect = (caseItem: SurveyCase) => {
    onCaseSelect(caseItem);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋案件（案號、地段、所有權人、測量員）"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length >= 2) {
                setOpen(true);
              }
            }}
            onFocus={() => {
              if (searchQuery.length >= 2) {
                setOpen(true);
              }
            }}
            className="pl-9 pr-8"
            data-testid="input-case-search"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => {
                setSearchQuery("");
                setOpen(false);
              }}
              data-testid="button-clear-search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandList>
            {isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                搜尋中...
              </div>
            )}
            {!isLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <CommandEmpty>找不到符合的案件</CommandEmpty>
            )}
            {!isLoading && searchQuery.length < 2 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                請輸入至少 2 個字元
              </div>
            )}
            {searchResults.length > 0 && (
              <CommandGroup heading={`找到 ${searchResults.length} 筆案件`}>
                {searchResults.map((caseItem) => (
                  <CommandItem
                    key={caseItem.id}
                    value={caseItem.caseNumber}
                    onSelect={() => handleSelect(caseItem)}
                    className="cursor-pointer"
                    data-testid={`search-result-${caseItem.id}`}
                  >
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{caseItem.caseNumber}</span>
                        <Badge variant="secondary" className="text-xs">
                          {caseItem.caseType}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {caseItem.landParcel}
                        {caseItem.owner && ` | ${caseItem.owner}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {caseItem.surveyor} | {caseItem.surveyDate} {caseItem.scheduledTime}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
