export interface ProjectLocationInfo {
  lat: number;
  lng: number;
  locationName: string;
  region: string;
  state?: string;
}

// Precise geo-coordinates for all monitored infrastructure mega projects across India
export const PROJECT_COORDINATES: Record<string, ProjectLocationInfo> = {
  'MORTH-NH44-PKG4': {
    lat: 21.60,
    lng: 79.30,
    locationName: 'Jabalpur-Nagpur Corridor (Pench Buffer)',
    region: 'Central India',
    state: 'Maharashtra',
  },
  'MOR-USBRL-PKG7': {
    lat: 33.25,
    lng: 74.90,
    locationName: 'Chenab Bridge & Katra-Banihal Section',
    region: 'North India',
    state: 'Jammu & Kashmir',
  },
  'MOR-USBRL-TUNNEL': {
    lat: 33.25,
    lng: 74.90,
    locationName: 'Chenab Bridge & Katra-Banihal Section (Tunnel T-49)',
    region: 'North India',
    state: 'Jammu & Kashmir',
  },
  'MOR-WDFC-JNPT': {
    lat: 19.12,
    lng: 73.15,
    locationName: 'Dadri to JNPT Port Package 3 (Surat-Palghar-JNPT)',
    region: 'West India',
    state: 'Maharashtra',
  },
  'MOCA-NMIA-PH1': {
    lat: 18.99,
    lng: 73.07,
    locationName: 'Navi Mumbai International Airport (Ulwe)',
    region: 'West India',
    state: 'Maharashtra',
  },
  'MORTH-DHUBRI-PHULBARI': {
    lat: 25.98,
    lng: 89.98,
    locationName: 'Brahmaputra River Crossing (Dhubri-Phulbari)',
    region: 'North East India',
    state: 'Assam',
  },
  'MOHUA-RRTS-DEL-MEE': {
    lat: 28.75,
    lng: 77.45,
    locationName: 'Delhi-Ghaziabad-Meerut Rapid Rail Corridor',
    region: 'North India',
    state: 'Uttar Pradesh',
  },
  'MOWR-POLAVARAM-IRR': {
    lat: 17.25,
    lng: 81.65,
    locationName: 'Godavari River Basin, Eluru',
    region: 'South India',
    state: 'Andhra Pradesh',
  },
  'MCGM-MCR-SOUTH-PKG1': {
    lat: 18.98,
    lng: 72.82,
    locationName: 'Marine Drive to Worli Sea Face (Mumbai Coastal Road)',
    region: 'West India',
    state: 'Maharashtra',
  },
  'MOHUA-CMRL-PH2-CORR3': {
    lat: 13.05,
    lng: 80.20,
    locationName: 'Madhavaram to SIPCOT Corridor, Chennai',
    region: 'South India',
    state: 'Tamil Nadu',
  },
  'MOPSW-PPT-OUTER-PH1': {
    lat: 20.26,
    lng: 86.67,
    locationName: 'Paradip Port Western Dock Basin',
    region: 'East India',
    state: 'Odisha',
  },
  'MOR-BSRP-CORR2': {
    lat: 13.02,
    lng: 77.58,
    locationName: 'Baiyappanahalli to Chikkabanavara Corridor, Bengaluru',
    region: 'South India',
    state: 'Karnataka',
  },
  'MOP-SUBANSIRI-LOWER': {
    lat: 27.556,
    lng: 94.261,
    locationName: 'Subansiri Lower Hydro Dam (Gerukamukh)',
    region: 'North East India',
    state: 'Assam',
  },
  'MOHUA-DELMET-P4': {
    lat: 28.635,
    lng: 77.100,
    locationName: 'Janakpuri West to RK Ashram Marg Corridor, Delhi',
    region: 'North India',
    state: 'Delhi',
  },
  'MOS-VIZAG-BERTH5': {
    lat: 17.688,
    lng: 83.298,
    locationName: 'Visakhapatnam Outer Harbour Berth 5 & 6',
    region: 'South India',
    state: 'Andhra Pradesh',
  },
  'MORTH-DME-PKG12': {
    lat: 19.015,
    lng: 73.045,
    locationName: 'Delhi-Mumbai Expressway JNPT Spur (Package 12)',
    region: 'West India',
    state: 'Maharashtra',
  },
  'MOP-HVDC-RAIGARH': {
    lat: 11.025,
    lng: 77.980,
    locationName: 'Pugalur HVDC Converter Substation, Karur',
    region: 'South India',
    state: 'Tamil Nadu',
  },
  'MOC-TALCHER-FERT': {
    lat: 20.950,
    lng: 85.220,
    locationName: 'Talcher Coal Gasification Complex, Angul',
    region: 'East India',
    state: 'Odisha',
  },
  'MORTH-BBD-EXPRSS': {
    lat: 12.990,
    lng: 78.020,
    locationName: 'Bengaluru-Chennai Expressway (Malur-Bangarpet)',
    region: 'South India',
    state: 'Karnataka',
  },
};

// Fallback state centers in India
export const STATE_CENTERS: Record<string, { lat: number; lng: number; region: string }> = {
  'Maharashtra': { lat: 19.7515, lng: 75.7139, region: 'West India' },
  'Jammu & Kashmir': { lat: 33.7782, lng: 76.5762, region: 'North India' },
  'Jammu and Kashmir': { lat: 33.7782, lng: 76.5762, region: 'North India' },
  'J&K': { lat: 33.7782, lng: 76.5762, region: 'North India' },
  'Delhi': { lat: 28.7041, lng: 77.1025, region: 'North India' },
  'Delhi NCR': { lat: 28.7041, lng: 77.1025, region: 'North India' },
  'Uttar Pradesh': { lat: 26.8467, lng: 80.9462, region: 'North India' },
  'Assam': { lat: 26.2006, lng: 92.9376, region: 'North East India' },
  'Andhra Pradesh': { lat: 15.9129, lng: 79.7400, region: 'South India' },
  'Tamil Nadu': { lat: 11.1271, lng: 78.6569, region: 'South India' },
  'Karnataka': { lat: 15.3173, lng: 75.7139, region: 'South India' },
  'Odisha': { lat: 20.9517, lng: 85.0985, region: 'East India' },
  'Gujarat': { lat: 22.2587, lng: 71.1924, region: 'West India' },
  'West Bengal': { lat: 22.9868, lng: 87.8550, region: 'East India' },
  'Madhya Pradesh': { lat: 22.9734, lng: 78.6569, region: 'Central India' },
  'Rajasthan': { lat: 27.0238, lng: 74.2179, region: 'North India' },
  'Bihar': { lat: 25.0961, lng: 85.3131, region: 'East India' },
  'Punjab': { lat: 31.1471, lng: 75.3412, region: 'North India' },
  'Haryana': { lat: 29.0588, lng: 76.0856, region: 'North India' },
  'Kerala': { lat: 10.8505, lng: 76.2711, region: 'South India' },
  'Telangana': { lat: 18.1124, lng: 79.0193, region: 'South India' },
};

// Geographic center of India
export const INDIA_CENTER = {
  lat: 22.5937,
  lng: 78.9629,
};

export const INDIA_DEFAULT_ZOOM = 5;

// Restrict Google Maps to India viewport bounds
export const INDIA_MAP_BOUNDS = {
  north: 37.6,
  south: 6.5,
  west: 68.0,
  east: 97.5,
};

export function getProjectLocation(projectCode?: string, stateName?: string): ProjectLocationInfo {
  if (projectCode && PROJECT_COORDINATES[projectCode]) {
    const coord = PROJECT_COORDINATES[projectCode];
    if (Number.isFinite(coord.lat) && Number.isFinite(coord.lng)) {
      return coord;
    }
  }

  if (stateName) {
    const trimmedState = stateName.trim();
    if (STATE_CENTERS[trimmedState]) {
      const center = STATE_CENTERS[trimmedState];
      if (Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
        return {
          lat: center.lat,
          lng: center.lng,
          locationName: `${trimmedState} Infrastructure Corridor`,
          region: center.region,
          state: trimmedState,
        };
      }
    }
  }

  return {
    lat: INDIA_CENTER.lat,
    lng: INDIA_CENTER.lng,
    locationName: 'National Infrastructure Corridor',
    region: 'Central India',
    state: stateName || 'India',
  };
}
