import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SurveyCase } from "@shared/schema";

interface CaseMapProps {
  cases: SurveyCase[];
  onCaseClick?: (caseItem: SurveyCase) => void;
  selectedCaseId?: string | null;
  className?: string;
  dimPastCases?: boolean;
}

const customIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="
    background-color: hsl(var(--primary));
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  "><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

const selectedIcon = L.divIcon({
  className: "custom-marker-selected",
  html: `<div style="
    background-color: hsl(var(--destructive));
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 3px 6px rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  "><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const dimIcon = L.divIcon({
  className: "custom-marker-dim",
  html: `<div style="
    background-color: #aaa;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid #ccc;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    opacity: 0.45;
    display: flex;
    align-items: center;
    justify-content: center;
  "><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -20],
});


function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  
  return null;
}

const todayStr = new Date().toISOString().split("T")[0];

export function CaseMap({ cases, onCaseClick, selectedCaseId, className, dimPastCases }: CaseMapProps) {
  const casesWithCoords = cases.filter(
    (c) => c.longitude && c.latitude && c.coordinateStatus === "success"
  );

  if (casesWithCoords.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-md ${className}`}>
        <div className="text-center p-6">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">目前沒有具有座標的案件</p>
        </div>
      </div>
    );
  }

  const defaultCenter: [number, number] = (() => {
    if (casesWithCoords.length === 0) return [24.5, 120.8];
    
    const selected = casesWithCoords.find(c => c.id === selectedCaseId);
    if (selected && selected.longitude && selected.latitude) {
      return [selected.latitude, selected.longitude];
    }
    
    const firstCase = casesWithCoords[0];
    if (firstCase.longitude && firstCase.latitude) {
      return [firstCase.latitude, firstCase.longitude];
    }
    
    return [24.5, 120.8];
  })();

  return (
    <div className={`rounded-md overflow-hidden ${className}`}>
      <MapContainer
        center={defaultCenter}
        zoom={14}
        style={{ height: "100%", width: "100%", minHeight: "400px" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {selectedCaseId && (
          <MapController center={defaultCenter} zoom={15} />
        )}
        {casesWithCoords.map((caseItem) => {
          const lat = caseItem.latitude!;
          const lng = caseItem.longitude!;
          const isSelected = caseItem.id === selectedCaseId;
          const isPast = dimPastCases && caseItem.surveyDate < todayStr;
          
          return (
            <Marker
              key={caseItem.id}
              position={[lat, lng]}
              icon={isSelected ? selectedIcon : (isPast ? dimIcon : customIcon)}
              eventHandlers={{
                click: () => onCaseClick?.(caseItem),
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <p className="font-semibold mb-1">{caseItem.caseNumber}</p>
                  <p className="text-sm text-muted-foreground mb-1">{caseItem.landParcel}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">{caseItem.caseType}</Badge>
                    <span className="text-xs text-muted-foreground">{caseItem.surveyor}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {caseItem.surveyDate} {caseItem.scheduledTime}
                  </p>
                  {onCaseClick && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-primary"
                      onClick={() => onCaseClick(caseItem)}
                      data-testid={`button-view-case-${caseItem.id}`}
                    >
                      查看詳情
                    </Button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
