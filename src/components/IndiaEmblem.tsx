import React from 'react';

interface IndiaEmblemProps {
  className?: string;
  height?: number | string;
  width?: number | string;
}

export const IndiaEmblem: React.FC<IndiaEmblemProps> = ({
  className = 'h-14 w-auto',
  height = 56,
  width = 36,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 156"
      height={height}
      width={width}
      className={className}
      aria-label="State Emblem of India - Satyameva Jayate"
      role="img"
    >
      <g fill="#2B394A">
        {/* Top Crowns / Lion Ears & Heads */}
        {/* Center Lion Head */}
        <path d="M46 14 C46 9 54 9 54 14 C54 18 46 18 46 14 Z" />
        <path d="M41 18 C41 12 59 12 59 18 C61 24 61 30 50 32 C39 30 39 24 41 18 Z" />
        {/* Center Lion Mane details */}
        <path d="M37 28 C34 32 37 39 44 42 C41 45 35 48 37 53 C38 57 43 59 47 62 C50 62 53 62 53 62 C57 59 62 57 63 53 C65 48 59 45 56 42 C63 39 66 32 63 28 C61 32 58 35 50 35 C42 35 39 32 37 28 Z" />
        {/* Center Lion Face / Snout / Eyes */}
        <ellipse cx="46" cy="24" rx="2" ry="1.5" fill="#FFFFFF" />
        <ellipse cx="54" cy="24" rx="2" ry="1.5" fill="#FFFFFF" />
        <ellipse cx="46" cy="24" rx="1" ry="1" fill="#2B394A" />
        <ellipse cx="54" cy="24" rx="1" ry="1" fill="#2B394A" />
        <path d="M48 27 L52 27 L50 30 Z" />
        <path d="M47 31 Q50 33 53 31" stroke="#2B394A" strokeWidth="1" fill="none" />

        {/* Left Lion Head & Mane */}
        <path d="M22 22 C22 17 28 16 31 20 C34 24 33 28 29 30 C24 30 22 26 22 22 Z" />
        <path d="M19 30 C16 35 18 43 25 45 C23 49 18 53 20 58 C22 62 28 64 34 65 C32 60 30 54 32 48 C31 43 32 37 35 33 C28 32 21 34 19 30 Z" />
        <ellipse cx="25" cy="24" rx="1.5" ry="1" fill="#FFFFFF" />
        <ellipse cx="25" cy="24" rx="0.8" ry="0.8" fill="#2B394A" />
        <path d="M22 27 L26 27 L24 29 Z" />

        {/* Right Lion Head & Mane */}
        <path d="M78 22 C78 17 72 16 69 20 C66 24 67 28 71 30 C76 30 78 26 78 22 Z" />
        <path d="M81 30 C84 35 82 43 75 45 C77 49 82 53 80 58 C78 62 72 64 66 65 C68 60 70 54 68 48 C69 43 68 37 65 33 C72 32 79 34 81 30 Z" />
        <ellipse cx="75" cy="24" rx="1.5" ry="1" fill="#FFFFFF" />
        <ellipse cx="75" cy="24" rx="0.8" ry="0.8" fill="#2B394A" />
        <path d="M74 27 L78 27 L76 29 Z" />

        {/* Chests, Front Legs & Paws */}
        {/* Left Lion Paws */}
        <path d="M24 66 C23 72 25 78 27 82 L34 82 C34 76 33 71 33 66 Z" />
        <path d="M25 82 C25 85 35 85 35 82 Z" />

        {/* Center Lion Front Legs & Paws */}
        <path d="M43 65 L41 82 L47 82 L48 65 Z" />
        <path d="M52 65 L53 82 L59 82 L57 65 Z" />
        <path d="M39 82 C39 85 49 85 49 82 Z" />
        <path d="M51 82 C51 85 61 85 61 82 Z" />

        {/* Right Lion Paws */}
        <path d="M76 66 C77 72 75 78 73 82 L66 82 C66 76 67 71 67 66 Z" />
        <path d="M65 82 C65 85 75 85 75 82 Z" />

        {/* Capital Platform / Abacus */}
        <rect x="14" y="87" width="72" height="4" rx="1" />

        {/* Abacus Frieze with Ashoka Chakra, Horse (Galloping), and Bull */}
        <rect x="16" y="91" width="68" height="18" rx="1" fill="#F1F5F9" stroke="#2B394A" strokeWidth="1.5" />

        {/* Center Ashoka Chakra (Dharma Wheel) */}
        <circle cx="50" cy="100" r="7" fill="none" stroke="#2B394A" strokeWidth="1.2" />
        <circle cx="50" cy="100" r="2" fill="#2B394A" />
        {/* 24 spokes (clean representations) */}
        <line x1="50" y1="93" x2="50" y2="107" stroke="#2B394A" strokeWidth="0.8" />
        <line x1="43" y1="100" x2="57" y2="100" stroke="#2B394A" strokeWidth="0.8" />
        <line x1="45.05" y1="95.05" x2="54.95" y2="104.95" stroke="#2B394A" strokeWidth="0.8" />
        <line x1="45.05" y1="104.95" x2="54.95" y2="95.05" stroke="#2B394A" strokeWidth="0.8" />
        <line x1="47.3" y1="93.35" x2="52.7" y2="106.65" stroke="#2B394A" strokeWidth="0.7" />
        <line x1="52.7" y1="93.35" x2="47.3" y2="106.65" stroke="#2B394A" strokeWidth="0.7" />
        <line x1="43.35" y1="97.3" x2="56.65" y2="102.7" stroke="#2B394A" strokeWidth="0.7" />
        <line x1="43.35" y1="102.7" x2="56.65" y2="97.3" stroke="#2B394A" strokeWidth="0.7" />

        {/* Galloping Horse (Left of Chakra) */}
        <path
          d="M23 99 C25 96 28 95 31 96 C33 97 34 100 35 102 C33 103 31 102 30 104 C28 106 25 106 24 104 C23 102 24 100 23 99 Z"
          fill="#2B394A"
        />
        <path d="M22 101 L20 105 L22 105 L24 102 Z" fill="#2B394A" />
        <path d="M30 104 L31 107 L33 107 L32 103 Z" fill="#2B394A" />

        {/* Walking Bull (Right of Chakra) */}
        <path
          d="M77 100 C75 97 72 96 69 97 C67 98 66 101 65 103 C67 104 69 103 70 105 C72 107 75 107 76 105 C77 103 76 101 77 100 Z"
          fill="#2B394A"
        />
        <path d="M78 102 L80 106 L78 106 L76 103 Z" fill="#2B394A" />
        <path d="M70 105 L69 108 L67 108 L68 104 Z" fill="#2B394A" />

        {/* Lower Inverted Lotus Base */}
        <rect x="12" y="109" width="76" height="3" rx="0.5" fill="#2B394A" />
        <path
          d="M16 112 C18 120 25 125 50 125 C75 125 82 120 84 112 Z"
          fill="#2B394A"
        />
        {/* Lotus Petal Highlights */}
        <path d="M25 113 C29 119 35 122 39 122 C37 118 34 115 32 113 Z" fill="#FFFFFF" opacity="0.3" />
        <path d="M43 113 C46 120 54 120 57 113 C54 115 46 115 43 113 Z" fill="#FFFFFF" opacity="0.3" />
        <path d="M75 113 C71 119 65 122 61 122 C63 118 66 115 68 113 Z" fill="#FFFFFF" opacity="0.3" />

        <rect x="14" y="125" width="72" height="3" rx="0.5" fill="#2B394A" />
      </g>

      {/* National Motto: सत्यमेव जयते (Satyameva Jayate) */}
      <text
        x="50"
        y="144"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fill="#2B394A"
        fontFamily="'Inter', 'Noto Sans Devanagari', 'Mangal', 'Kohinoor Devanagari', sans-serif"
        letterSpacing="0.05em"
      >
        सत्यमेव जयते
      </text>
    </svg>
  );
};
