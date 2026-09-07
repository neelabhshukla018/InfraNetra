import React from 'react';

interface SwachhBharatLogoProps {
  className?: string;
  height?: number | string;
  width?: number | string;
}

export const SwachhBharatLogo: React.FC<SwachhBharatLogoProps> = ({
  className = 'h-11 w-auto',
  height = 46,
  width = 110,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 85"
      height={height}
      width={width}
      className={className}
      aria-label="Swachh Bharat - Ek Kadam Swachhata Ki Ore"
      role="img"
    >
      {/* Left Spectacle Lens Frame */}
      <circle
        cx="54"
        cy="34"
        r="24"
        fill="#FFFFFF"
        stroke="#232B38"
        strokeWidth="3.2"
      />

      {/* Right Spectacle Lens Frame */}
      <circle
        cx="120"
        cy="34"
        r="24"
        fill="#FFFFFF"
        stroke="#232B38"
        strokeWidth="3.2"
      />

      {/* Left Temple (Spectacle Arm) */}
      <path
        d="M30 32 C20 28 8 36 6 42"
        fill="none"
        stroke="#232B38"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Right Temple (Spectacle Arm extending with loop) */}
      <path
        d="M144 32 C156 24 176 18 188 26 C194 30 196 42 192 46 C186 52 178 44 176 38"
        fill="none"
        stroke="#232B38"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Tricolor Nose Bridge (Saffron, White, Green) */}
      <path
        d="M78 30 C87 23 93 23 100 30"
        fill="none"
        stroke="#FF9933"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M78 33 C87 26 93 26 100 33"
        fill="none"
        stroke="#232B38"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M78 36 C87 29 93 29 100 36"
        fill="none"
        stroke="#138808"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Text inside Left Lens: 'स्वच्छ' */}
      <text
        x="54"
        y="39"
        textAnchor="middle"
        fontSize="14"
        fontWeight="bold"
        fill="#1E293B"
        fontFamily="'Noto Sans Devanagari', 'Inter', 'Mangal', sans-serif"
      >
        स्वच्छ
      </text>

      {/* Text inside Right Lens: 'भारत' */}
      <text
        x="120"
        y="39"
        textAnchor="middle"
        fontSize="14"
        fontWeight="bold"
        fill="#1E293B"
        fontFamily="'Noto Sans Devanagari', 'Inter', 'Mangal', sans-serif"
      >
        भारत
      </text>

      {/* Slogan Text Underneath: 'एक कदम स्वच्छता की ओर' */}
      <text
        x="88"
        y="74"
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="#475569"
        fontFamily="'Noto Sans Devanagari', 'Inter', 'Mangal', sans-serif"
        letterSpacing="0.04em"
      >
        एक कदम स्वच्छता की ओर
      </text>
    </svg>
  );
};
