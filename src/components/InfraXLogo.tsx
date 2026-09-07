import React from 'react';

export interface InfraNetraLogoProps {
  className?: string;
  size?: number | string;
}

export type InfraXLogoProps = InfraNetraLogoProps;

export const InfraNetraLogo: React.FC<InfraNetraLogoProps> = ({ className = 'w-9 h-9', size }) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-[10px] shadow-md shadow-teal-950/40 select-none ${className}`}
      style={style}
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full block"
      >
        <defs>
          {/* Tile Background Gradient */}
          <linearGradient id="infranetra-bg" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0a3d36" />
            <stop offset="35%" stopColor="#0d5249" />
            <stop offset="70%" stopColor="#07332d" />
            <stop offset="100%" stopColor="#031e1a" />
          </linearGradient>

          {/* Glowing Outer Border Gradient */}
          <linearGradient id="infranetra-border" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#0f9d8c" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.85" />
          </linearGradient>

          {/* Sky / Atmospheric Glow */}
          <radialGradient id="sky-glow" cx="60" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#0f766e" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#042f2e" stopOpacity="0" />
          </radialGradient>

          {/* Metallic Silver 3D X Surfaces */}
          <linearGradient id="metal-facet-light" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#e2e8f0" />
            <stop offset="70%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>

          <linearGradient id="metal-facet-dark" x1="100" y1="20" x2="20" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="45%" stopColor="#64748b" />
            <stop offset="85%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Cyan Energy Glow behind X */}
          <linearGradient id="cyan-glow-edge" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#0f9d8c" />
          </linearGradient>

          {/* Orbital Swoosh Gradient */}
          <linearGradient id="swoosh-grad" x1="25" y1="75" x2="105" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#e0f2fe" stopOpacity="1" />
            <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0f9d8c" stopOpacity="0.8" />
          </linearGradient>

          {/* Waterfall Gradient */}
          <linearGradient id="water-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#0e7490" stopOpacity="0.85" />
          </linearGradient>

          {/* Filter for glowing elements */}
          <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Base Tile Background */}
        <rect width="120" height="120" rx="26" fill="url(#infranetra-bg)" />
        <rect width="120" height="120" rx="26" fill="url(#sky-glow)" />

        {/* 2. Delicate Outer Glowing Border */}
        <rect
          x="2"
          y="2"
          width="116"
          height="116"
          rx="24"
          fill="none"
          stroke="url(#infranetra-border)"
          strokeWidth="2.5"
        />

        {/* Inner thin highlight border */}
        <rect
          x="5"
          y="5"
          width="110"
          height="110"
          rx="21"
          fill="none"
          stroke="#5eead4"
          strokeWidth="0.8"
          strokeOpacity="0.25"
        />

        {/* 3. Background Infrastructure Elements */}
        {/* Left: Cable Suspension Bridge */}
        <g opacity="0.38">
          {/* Bridge Pylons */}
          <path d="M22 62 L26 35 L28 35 L32 62 Z" fill="#94a3b8" />
          <path d="M11 62 L14 38 L16 38 L19 62 Z" fill="#64748b" />
          {/* Cross braces */}
          <rect x="25" y="44" width="4" height="2" fill="#cbd5e1" />
          {/* Main Cables */}
          <path d="M6 46 Q 15 54 27 35 Q 38 52 46 62" stroke="#e2e8f0" strokeWidth="0.8" fill="none" />
          {/* Stay cables */}
          <line x1="27" y1="36" x2="16" y2="62" stroke="#cbd5e1" strokeWidth="0.5" strokeOpacity="0.6" />
          <line x1="27" y1="36" x2="20" y2="62" stroke="#cbd5e1" strokeWidth="0.5" strokeOpacity="0.6" />
          <line x1="27" y1="36" x2="35" y2="62" stroke="#cbd5e1" strokeWidth="0.5" strokeOpacity="0.6" />
          <line x1="27" y1="36" x2="40" y2="62" stroke="#cbd5e1" strokeWidth="0.5" strokeOpacity="0.6" />
          {/* Bridge Deck */}
          <line x1="4" y1="62" x2="48" y2="62" stroke="#cbd5e1" strokeWidth="1.8" />
        </g>

        {/* Center/Top: City Skyline & Construction Crane */}
        <g opacity="0.42">
          {/* Towers */}
          <rect x="58" y="24" width="8" height="26" fill="#334155" />
          <rect x="68" y="19" width="10" height="31" fill="#475569" />
          <rect x="80" y="27" width="9" height="23" fill="#334155" />
          {/* Window dots on main tower */}
          <line x1="70" y1="23" x2="76" y2="23" stroke="#94a3b8" strokeWidth="1" strokeDasharray="1.5 1.5" />
          <line x1="70" y1="27" x2="76" y2="27" stroke="#94a3b8" strokeWidth="1" strokeDasharray="1.5 1.5" />
          <line x1="70" y1="31" x2="76" y2="31" stroke="#94a3b8" strokeWidth="1" strokeDasharray="1.5 1.5" />
          {/* Crane */}
          <line x1="91" y1="25" x2="91" y2="44" stroke="#e2e8f0" strokeWidth="0.9" />
          <line x1="84" y1="25" x2="99" y2="25" stroke="#e2e8f0" strokeWidth="0.9" />
          <line x1="91" y1="22" x2="84" y2="25" stroke="#e2e8f0" strokeWidth="0.6" />
          <line x1="91" y1="22" x2="96" y2="25" stroke="#e2e8f0" strokeWidth="0.6" />
        </g>

        {/* Right: Hydro Dam with cascading water */}
        <g opacity="0.45">
          {/* Concrete Dam Wall */}
          <path d="M78 54 L112 54 L108 72 L78 72 Z" fill="#475569" />
          <rect x="82" y="52" width="4" height="4" fill="#64748b" />
          <rect x="90" y="52" width="4" height="4" fill="#64748b" />
          <rect x="98" y="52" width="4" height="4" fill="#64748b" />
          <rect x="104" y="52" width="4" height="4" fill="#64748b" />
          {/* Water chute spillways */}
          <path d="M83 56 L83 72 L87 72 L87 56 Z" fill="url(#water-grad)" />
          <path d="M91 56 L91 72 L95 72 L95 56 Z" fill="url(#water-grad)" />
          <path d="M99 56 L99 72 L103 72 L103 56 Z" fill="url(#water-grad)" />
          {/* Water reservoir / spray at base */}
          <ellipse cx="94" cy="73" rx="14" ry="3.5" fill="#38bdf8" opacity="0.75" />
        </g>

        {/* Bottom Left: Aerodynamic High-Speed Bullet Train */}
        <g opacity="0.8">
          {/* Rails */}
          <path d="M8 88 Q 24 80 44 76" stroke="#64748b" strokeWidth="1.5" fill="none" />
          <path d="M12 92 Q 28 84 46 79" stroke="#475569" strokeWidth="1.5" fill="none" />
          {/* Train Body */}
          <path
            d="M14 83 Q 22 74 38 72 L 48 71 L 46 76 L 22 79 Q 15 81 14 83 Z"
            fill="#f8fafc"
          />
          {/* Train nose / windshield */}
          <path d="M15 82 Q 18 78 24 77 L 24 79 Z" fill="#0f766e" />
          {/* Train turquoise stripe */}
          <path d="M22 78 L 47 73" stroke="#0f9d8c" strokeWidth="1" />
        </g>

        {/* Bottom Center / Right: Curved Expressway / Highway with cars */}
        <g opacity="0.6">
          <path
            d="M48 76 Q 64 78 76 86 Q 88 94 114 98 L 110 106 Q 82 102 68 93 Q 54 84 44 80 Z"
            fill="#1e293b"
          />
          {/* Road center line */}
          <path
            d="M50 78 Q 66 82 78 90 Q 90 98 112 102"
            stroke="#94a3b8"
            strokeWidth="0.8"
            strokeDasharray="2.5 2.5"
            fill="none"
          />
          {/* Tiny car lights */}
          <circle cx="72" cy="85" r="1" fill="#f8fafc" />
          <circle cx="94" cy="94" r="1.2" fill="#f8fafc" />
        </g>

        {/* 4. THE PROMINENT 3D METALLIC LETTER "X" */}
        {/* Glow halo behind the X */}
        <g filter="url(#glow-filter)" opacity="0.55">
          {/* Bar 1 (Top-Left to Bottom-Right) */}
          <polygon points="26,27 48,27 94,87 72,87" fill="#2dd4bf" />
          {/* Bar 2 (Top-Right to Bottom-Left) */}
          <polygon points="74,27 96,27 48,87 26,87" fill="#38bdf8" />
        </g>

        {/* Main 3D Metallic X Construction */}
        {/* Bar 1 Base/Bevel (dark metallic) */}
        <polygon points="25,26 49,26 95,88 71,88" fill="url(#metal-facet-dark)" />
        {/* Bar 1 Top Face (gleaming silver) */}
        <polygon points="27,27 47,27 93,86 73,86" fill="url(#metal-facet-light)" />
        {/* Bar 1 Bright Center Highlight Crease */}
        <line x1="37" y1="27" x2="83" y2="86" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.8" />

        {/* Bar 2 Base/Bevel (dark metallic) */}
        <polygon points="73,26 97,26 49,88 25,88" fill="url(#metal-facet-dark)" />
        {/* Bar 2 Top Face (gleaming silver) */}
        <polygon points="75,27 95,27 47,86 27,86" fill="url(#metal-facet-light)" />
        {/* Bar 2 Bright Center Highlight Crease */}
        <line x1="85" y1="27" x2="37" y2="86" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.8" />

        {/* Cyan/Neon Bevel Accent on Lower Right Edge of X */}
        <line x1="48" y1="87" x2="94" y2="28" stroke="url(#cyan-glow-edge)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="26" y1="87" x2="72" y2="28" stroke="url(#cyan-glow-edge)" strokeWidth="1" strokeLinecap="round" opacity="0.7" />

        {/* 5. 3D ORBITAL GLOWING SWOOSH (Circling through the X) */}
        {/* Back portion shadow/glow */}
        <path
          d="M 32 68 Q 50 62 76 44 Q 94 32 103 33"
          stroke="#0f9d8c"
          strokeWidth="4"
          fill="none"
          opacity="0.5"
          filter="url(#glow-filter)"
        />
        {/* Front glowing elliptical swoosh ribbon */}
        <path
          d="M 30 73 C 44 65, 78 52, 102 34 C 94 38, 56 62, 30 73 Z"
          fill="url(#swoosh-grad)"
        />
        {/* Bright core streak in swoosh */}
        <path
          d="M 33 71 Q 62 56 99 35"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Subtle bottom InfraNetra glowing tech bar */}
        <rect x="36" y="104" width="48" height="2" rx="1" fill="#2dd4bf" opacity="0.75" />
        <line x1="44" y1="105" x2="76" y2="105" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export const InfraXLogo = InfraNetraLogo;
