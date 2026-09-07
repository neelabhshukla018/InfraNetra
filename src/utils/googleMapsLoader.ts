/**
 * Google Maps JavaScript API Loader Utility
 * Reads VITE_GOOGLE_MAPS_API_KEY directly from environment configuration (.env)
 */

// Clean up any legacy localStorage key from previous sessions
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('infranetra_google_maps_api_key');
    localStorage.removeItem('infrax_google_maps_api_key');
  }
} catch (e) {
  // Ignore localStorage errors
}

export function getGoogleMapsApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  return '';
}

export function isValidGoogleMapsKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed.length >= 20 &&
    trimmed !== 'YOUR_GOOGLE_MAPS_API_KEY' &&
    trimmed !== 'MY_GOOGLE_MAPS_API_KEY' &&
    !trimmed.includes(' ')
  );
}

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: any;
  }
}

let googleMapsPromise: Promise<any> | null = null;
let authFailureListeners: Array<() => void> = [];

export function onGoogleMapsAuthFailure(callback: () => void): () => void {
  authFailureListeners.push(callback);
  return () => {
    authFailureListeners = authFailureListeners.filter((cb) => cb !== callback);
  };
}

export async function loadGoogleMapsScript(apiKey?: string): Promise<any> {
  const activeKey = apiKey || getGoogleMapsApiKey() || 'AIzaSyDIrfTGCLMWD7TGU8BfqwcHiuDLliyhUws';

  if (typeof window !== 'undefined' && typeof window.google?.maps?.Map === 'function') {
    return window.google.maps;
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  // Intercept Google Maps authentication failure to avoid unhandled browser errors
  (window as any).gm_authFailure = () => {
    console.warn('[Google Maps] Authentication failed. Google Maps API key may be invalid or restricted.');
    authFailureListeners.forEach((cb) => cb());
  };

  googleMapsPromise = new Promise(async (resolve, reject) => {
    const checkReady = async (): Promise<boolean> => {
      const g = (window as any).google;
      if (typeof g?.maps?.Map === 'function') return true;
      if (typeof g?.maps?.importLibrary === 'function') {
        try {
          const mapsLib = await g.maps.importLibrary('maps');
          if (mapsLib?.Map) {
            g.maps.Map = mapsLib.Map;
            return true;
          }
        } catch {
          // ignore
        }
      }
      return typeof g?.maps?.Map === 'function';
    };

    if (await checkReady()) {
      resolve(window.google.maps);
      return;
    }

    let script = document.getElementById('google-maps-js-sdk') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'google-maps-js-sdk';
      script.type = 'text/javascript';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        activeKey
      )}&libraries=places,geometry&callback=__infranetraGMapReady`;
      document.head.appendChild(script);
    }

    (window as any).__infranetraGMapReady = async () => {
      if (await checkReady()) {
        clearInterval(pollInterval);
        resolve(window.google.maps);
      }
    };

    const startTime = Date.now();
    const pollInterval = setInterval(async () => {
      if (await checkReady()) {
        clearInterval(pollInterval);
        resolve(window.google.maps);
        return;
      }
      if (Date.now() - startTime > 15000) {
        clearInterval(pollInterval);
        googleMapsPromise = null;
        reject(new Error('Google Maps SDK took too long to initialize'));
      }
    }, 80);

    script.onerror = () => {
      clearInterval(pollInterval);
      googleMapsPromise = null;
      reject(new Error('Failed to download Google Maps JavaScript API script.'));
    };
  });

  return googleMapsPromise;
}

// Executive Dark Theme Styling matching InfraNetra Navy/Slate command center
export const INFRANETRA_MAP_DARK_STYLES: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#D1D5DB' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0F9D8C' }, { weight: 1.5 }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6B7280' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1F2937' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1F2937' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#374151' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#111827' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E5E7EB' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1E2A5E' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0B132B' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3E5C76' }],
  },
];

export const INFRAX_MAP_DARK_STYLES = INFRANETRA_MAP_DARK_STYLES;
