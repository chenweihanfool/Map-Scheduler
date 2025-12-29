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

function twd97ToWgs84(e: number, n: number): [number, number] {
  const a = 6378137.0;
  const b = 6356752.314245;
  const lng0 = 121.0 * Math.PI / 180;
  const k0 = 0.9999;
  const dx = 250000;
  const dy = 0;
  
  const e2 = 1 - (b / a) * (b / a);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  
  const x = e - dx;
  const y = n - dy;
  
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
  
  const phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
    + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);
  
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const C1 = (e2 / (1 - e2)) * Math.cos(phi1) * Math.cos(phi1);
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = x / (N1 * k0);
  
  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e2 / (1 - e2)) * Math.pow(D, 4) / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e2 / (1 - e2) - 3 * C1 * C1) * Math.pow(D, 6) / 720
  );
  
  const lon = lng0 + (
    D
    - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e2 / (1 - e2) + 24 * T1 * T1) * Math.pow(D, 5) / 120
  ) / Math.cos(phi1);
  
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  
  return null;
}

export function CaseMap({ cases, onCaseClick, selectedCaseId, className }: CaseMapProps) {
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
      return twd97ToWgs84(selected.longitude, selected.latitude);
    }
    
    const firstCase = casesWithCoords[0];
    if (firstCase.longitude && firstCase.latitude) {
      return twd97ToWgs84(firstCase.longitude, firstCase.latitude);
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
          const [lat, lng] = twd97ToWgs84(caseItem.longitude!, caseItem.latitude!);
          const isSelected = caseItem.id === selectedCaseId;
          
          return (
            <Marker
              key={caseItem.id}
              position={[lat, lng]}
              icon={isSelected ? selectedIcon : customIcon}
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
