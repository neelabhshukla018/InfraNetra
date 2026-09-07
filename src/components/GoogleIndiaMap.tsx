import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Compass,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Project } from '../types';
import {
  getProjectLocation,
  INDIA_CENTER,
  INDIA_DEFAULT_ZOOM,
} from '../data/projectCoordinates';

interface GoogleIndiaMapProps {
  projects: any[];
  selectedProjectCode: string | null;
  onSelectProject: (code: string) => void;
  isNormalUser?: boolean;
}

export type MapTheme = 'roadmap' | 'satellite';

const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  'AIzaSyDIrfTGCLMWD7TGU8BfqwcHiuDLliyhUws';

// Module-level singleton loader promise to avoid duplicate script injection or race conditions across remounts
let googleMapsInitPromise: Promise<boolean> | null = null;

async function checkGoogleMapsReady(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const g = (window as any).google;

  // If google.maps.Map is already a constructor function, it is 100% ready
  if (typeof g?.maps?.Map === 'function') {
    return true;
  }

  // Modern Google Maps API importLibrary support
  if (typeof g?.maps?.importLibrary === 'function') {
    try {
      const mapsLib = await g.maps.importLibrary('maps');
      if (mapsLib?.Map && typeof g.maps.Map !== 'function') {
        g.maps.Map = mapsLib.Map;
      }
      if (typeof g?.maps?.Map === 'function') {
        return true;
      }
    } catch (e) {
      console.warn('[Google Maps] importLibrary("maps") attempt:', e);
    }
  }

  return typeof g?.maps?.Map === 'function';
}

function ensureGoogleMapsLoaded(apiKey: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  // If already ready, resolve immediately
  const g = (window as any).google;
  if (typeof g?.maps?.Map === 'function') {
    return Promise.resolve(true);
  }

  // If already in flight, reuse the same promise
  if (googleMapsInitPromise) {
    return googleMapsInitPromise;
  }

  googleMapsInitPromise = new Promise<boolean>((resolve) => {
    // Check immediately in case it just became ready
    checkGoogleMapsReady().then((ready) => {
      if (ready) {
        resolve(true);
        return;
      }

      // Check if script tag is already in DOM (e.g. from index.html)
      let script = document.getElementById('google-maps-js-sdk') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'google-maps-js-sdk';
        script.type = 'text/javascript';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
          apiKey
        )}&libraries=places,geometry&callback=__infranetraGMapReady`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      // Hook into global callback
      const existingCallback = (window as any).__infranetraGMapReady;
      (window as any).__infranetraGMapReady = async () => {
        if (typeof existingCallback === 'function') {
          try {
            existingCallback();
          } catch {}
        }
        const isReady = await checkGoogleMapsReady();
        if (isReady) {
          clearInterval(pollInterval);
          resolve(true);
        }
      };

      script.onerror = () => {
        clearInterval(pollInterval);
        console.error('[Google Maps] Script network loading error.');
        googleMapsInitPromise = null;
        resolve(false);
      };

      // Poll every 80ms for up to 15s to catch async library initialization smoothly on refresh
      const startTime = Date.now();
      const pollInterval = setInterval(async () => {
        const isReady = await checkGoogleMapsReady();
        if (isReady) {
          clearInterval(pollInterval);
          resolve(true);
          return;
        }

        if ((window as any).__GOOGLE_MAPS_AUTH_FAILED__) {
          clearInterval(pollInterval);
          googleMapsInitPromise = null;
          resolve(false);
          return;
        }

        if (Date.now() - startTime > 15000) {
          clearInterval(pollInterval);
          console.warn('[Google Maps] Initialization timed out after 15 seconds.');
          googleMapsInitPromise = null;
          resolve(false);
        }
      }, 80);
    });
  });

  return googleMapsInitPromise;
}

export const GoogleIndiaMap: React.FC<GoogleIndiaMapProps> = ({
  projects,
  selectedProjectCode,
  onSelectProject,
  isNormalUser = false,
}) => {
  const googleMapContainerRef = useRef<HTMLDivElement | null>(null);
  const googleMapInstanceRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const googleInfoWindowRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  const [activeTheme, setActiveTheme] = useState<MapTheme>('roadmap');
  const [googleReady, setGoogleReady] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const initGoogleMap = useCallback(async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    setLoadError(null);

    try {
      const isReady = await ensureGoogleMapsLoaded(GOOGLE_MAPS_API_KEY);

      if (!isMountedRef.current) return;

      if (!isReady) {
        setLoading(false);
        setLoadError(
          'Unable to connect to Google Maps. Please check your network connection or API configuration.'
        );
        return;
      }

      // If the map instance is already created on this canvas, mark ready and exit
      if (googleMapInstanceRef.current) {
        setGoogleReady(true);
        setLoading(false);
        return;
      }

      // If container ref isn't available yet in DOM, retry in 60ms
      if (!googleMapContainerRef.current) {
        setTimeout(() => {
          if (isMountedRef.current) {
            initGoogleMap();
          }
        }, 60);
        return;
      }

      const g = (window as any).google;
      if (typeof g?.maps?.Map !== 'function') {
        const doubleCheck = await checkGoogleMapsReady();
        if (!doubleCheck || typeof g?.maps?.Map !== 'function') {
          throw new Error('Google Maps Map constructor is not available.');
        }
      }

      const map = new g.maps.Map(googleMapContainerRef.current, {
        center: { lat: INDIA_CENTER.lat, lng: INDIA_CENTER.lng },
        zoom: INDIA_DEFAULT_ZOOM,
        minZoom: 4,
        maxZoom: 19,
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        scaleControl: true,
        mapTypeId: activeTheme === 'satellite' ? 'hybrid' : 'roadmap',
      });

      googleMapInstanceRef.current = map;
      if (isMountedRef.current) {
        setGoogleReady(true);
        setLoading(false);
      }
    } catch (mapErr: any) {
      console.warn('[Google Maps] Initialization error:', mapErr);
      if (isMountedRef.current) {
        setLoading(false);
        setLoadError(mapErr?.message || 'Failed to initialize map canvas.');
      }
    }
  }, [activeTheme]);

  // 1. Initialize Google Maps Engine
  useEffect(() => {
    isMountedRef.current = true;
    initGoogleMap();
    return () => {
      isMountedRef.current = false;
    };
  }, [initGoogleMap]);

  // Handle Google Maps authentication failure
  useEffect(() => {
    const prevAuthHandler = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps authentication failed or key restricted.');
      setLoadError(
        'Google Maps Authentication Notice: The Google Maps API reported an authentication error. Please verify VITE_GOOGLE_MAPS_API_KEY in .env.'
      );
      if (typeof prevAuthHandler === 'function') {
        prevAuthHandler();
      }
    };
  }, []);

  // 2. Update Theme on Google Maps
  useEffect(() => {
    if (!googleMapInstanceRef.current) return;
    const gMap = googleMapInstanceRef.current;
    if (activeTheme === 'satellite') {
      gMap.setMapTypeId('hybrid');
    } else {
      gMap.setMapTypeId('roadmap');
    }
  }, [activeTheme]);

  // 3. Update Markers on Google Maps
  useEffect(() => {
    const g = (window as any).google;
    const gMap = googleMapInstanceRef.current;
    if (!g || !g.maps || !gMap || !googleReady) return;

    // Clear old markers
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];

    if (googleInfoWindowRef.current) {
      googleInfoWindowRef.current.close();
    }

    const tierColors: Record<string, string> = {
      critical: '#DC2626',
      high: '#EA580C',
      medium: '#D97706',
      low: '#16A34A',
    };

    const newMarkers: any[] = [];

    projects.forEach((proj) => {
      const loc = getProjectLocation(proj.project_code, proj.state);
      if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;

      const isSelected = proj.project_code === selectedProjectCode;
      const pinColor = isNormalUser
        ? '#0F9D8C'
        : tierColors[proj.latest_snapshot.risk_tier] || '#0F9D8C';
      const size = isSelected ? 38 : 26;

      const svgPin = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          ${
            isSelected
              ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${pinColor}" opacity="0.4"/>`
              : ''
          }
          <circle cx="${size / 2}" cy="${size / 2}" r="${isSelected ? 11 : 8}" fill="#101A3D" stroke="${pinColor}" stroke-width="${isSelected ? 3 : 2}"/>
          <circle cx="${size / 2}" cy="${size / 2}" r="${isSelected ? 5 : 3.5}" fill="${pinColor}"/>
        </svg>
      `;

      const marker = new g.maps.Marker({
        position: { lat: loc.lat, lng: loc.lng },
        map: gMap,
        title: proj.name,
        zIndex: isSelected ? 1000 : 10,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgPin)}`,
          scaledSize: new g.maps.Size(size, size),
          anchor: new g.maps.Point(size / 2, size / 2),
        },
      });

      const popupHtml = `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; min-width: 230px; padding: 4px; color: #1E293B;">
          <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px;">
            ${proj.sector} · ${proj.state}
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #101A3D; line-height: 1.25; margin-bottom: 6px;">
            ${proj.name}
          </div>
          <div style="background: #F8FAFC; padding: 6px 8px; border-radius: 6px; border: 1px solid #E2E8F0; font-size: 11px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="color: #64748B;">Physical Progress:</span>
              <strong style="color: #0F9D8C;">${proj.latest_snapshot.physical_progress_pct}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">Approved Outlay:</span>
              <strong>₹${proj.approved_cost} Cr</strong>
            </div>
            ${
              !isNormalUser
                ? `<div style="display: flex; justify-content: space-between; margin-top: 3px;">
                    <span style="color: #64748B;">Risk Tier:</span>
                    <strong style="color: ${pinColor}; text-transform: uppercase;">${proj.latest_snapshot.risk_tier}</strong>
                   </div>`
                : ''
            }
          </div>
          <button
            id="btn-inspect-gmap-${proj.project_code}"
            style="width: 100%; background: #101A3D; color: white; border: none; padding: 7px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;"
          >
            Inspect Corridor Details →
          </button>
        </div>
      `;

      marker.addListener('click', () => {
        onSelectProject(proj.project_code);
        if (!googleInfoWindowRef.current) {
          googleInfoWindowRef.current = new g.maps.InfoWindow();
        }
        googleInfoWindowRef.current.setContent(popupHtml);
        googleInfoWindowRef.current.open(gMap, marker);

        g.maps.event.addListenerOnce(googleInfoWindowRef.current, 'domready', () => {
          const btn = document.getElementById(`btn-inspect-gmap-${proj.project_code}`);
          if (btn) {
            btn.onclick = () => onSelectProject(proj.project_code);
          }
        });
      });

      newMarkers.push(marker);
    });

    googleMarkersRef.current = newMarkers;

    // Pan smoothly if selected project changes
    if (selectedProjectCode) {
      const found = projects.find((p) => p.project_code === selectedProjectCode);
      if (found) {
        const loc = getProjectLocation(found.project_code, found.state);
        if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
          try {
            gMap.panTo({ lat: loc.lat, lng: loc.lng });
          } catch (e) {
            console.warn('Google Map pan error:', e);
          }
        }
      }
    }
  }, [projects, selectedProjectCode, googleReady, isNormalUser, onSelectProject]);

  // View Action: Reset India View
  const handleResetIndia = () => {
    if (googleMapInstanceRef.current) {
      try {
        googleMapInstanceRef.current.panTo({ lat: INDIA_CENTER.lat, lng: INDIA_CENTER.lng });
        googleMapInstanceRef.current.setZoom(INDIA_DEFAULT_ZOOM);
      } catch (e) {
        console.warn('Reset India Google Maps error:', e);
      }
    }
  };

  const handleZoomIn = () => {
    if (googleMapInstanceRef.current) {
      const z = googleMapInstanceRef.current.getZoom() || INDIA_DEFAULT_ZOOM;
      googleMapInstanceRef.current.setZoom(z + 1);
    }
  };

  const handleZoomOut = () => {
    if (googleMapInstanceRef.current) {
      const z = googleMapInstanceRef.current.getZoom() || INDIA_DEFAULT_ZOOM;
      googleMapInstanceRef.current.setZoom(z - 1);
    }
  };

  return (
    <div className="relative w-full h-[620px] rounded-xl overflow-hidden border border-[#E2E8F0] shadow-xs bg-slate-100">
      {/* Top Map Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-sm border border-[#E2E8F0] text-xs font-semibold text-[#101A3D]">
          <Compass className="w-3.5 h-3.5 text-[#0F9D8C]" />
          <span>National Infrastructure Map</span>
          <span className="text-[11px] font-mono-code bg-[#0F9D8C]/15 text-[#0F9D8C] px-1.5 py-0.2 rounded font-bold">
            {projects.length} Corridors
          </span>
        </div>

        {/* Clean Theme Switcher (Roads & Satellite only) & Reset View */}
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1 rounded-lg shadow-sm border border-[#E2E8F0]">
          <button
            type="button"
            id="btn-theme-roadmap"
            onClick={() => setActiveTheme('roadmap')}
            title="Road Map View"
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              activeTheme === 'roadmap'
                ? 'bg-[#101A3D] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Roads
          </button>
          <button
            type="button"
            id="btn-theme-satellite"
            onClick={() => setActiveTheme('satellite')}
            title="Satellite Imagery View"
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
              activeTheme === 'satellite'
                ? 'bg-[#101A3D] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Satellite
          </button>

          <div className="w-[1px] h-4 bg-slate-200 mx-1" />

          <button
            type="button"
            id="btn-reset-india"
            onClick={handleResetIndia}
            title="Reset to whole India View"
            className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3 text-[#0F9D8C]" />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* Primary Google Maps Canvas Container */}
      <div
        id="google-maps-canvas"
        ref={googleMapContainerRef}
        className="w-full h-full absolute inset-0"
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center text-[#101A3D] z-20 gap-3">
          <div className="w-8 h-8 border-3 border-[#0F9D8C] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-slate-600">
            Loading Map...
          </span>
        </div>
      )}

      {/* Load Error State */}
      {loadError && (
        <div className="absolute inset-0 bg-[#101A3D]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white z-20 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="max-w-md space-y-1">
            <h4 className="text-sm font-bold text-white">Map Connection Notice</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              googleMapsInitPromise = null;
              initGoogleMap();
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F9D8C] hover:bg-[#0d8778] text-white shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Map</span>
          </button>
        </div>
      )}

      {/* Floating Zoom Controls */}
      <div className="absolute right-4 bottom-14 z-10 flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg shadow-md border border-[#E2E8F0]">
        <button
          type="button"
          id="btn-google-zoom-in"
          onClick={handleZoomIn}
          className="p-1.5 text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          id="btn-google-zoom-out"
          onClick={handleZoomOut}
          className="p-1.5 text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Clean Corridor Risk Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2.5 bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg shadow-md border border-[#E2E8F0] text-xs">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Risk Tier:
        </span>
        <div className="flex items-center gap-2.5 text-[11px]">
          {isNormalUser ? (
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F9D8C]" />
              <span className="text-slate-700 font-medium">Monitored Corridor</span>
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
                <span className="text-slate-700 font-medium">Critical</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
                <span className="text-slate-700 font-medium">High</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                <span className="text-slate-700 font-medium">Medium</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                <span className="text-slate-700 font-medium">Low</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
