import React from 'react';
import forumsHorizon from '../assets/forums-horizon.png';

const ForumsHorizonBanner: React.FC = () => (
  <div
    aria-hidden="true"
    className="relative z-10 mt-20 h-[clamp(180px,28.5vw,430px)] overflow-hidden border-y border-neon-cyan/20 bg-[#05051a] shadow-[0_0_70px_rgba(0,243,255,0.08)]"
    style={{
      backgroundImage: `linear-gradient(90deg, rgba(2, 6, 23, 0.88) 0%, rgba(2, 6, 23, 0.2) 45%, rgba(2, 6, 23, 0.84) 100%), url(${forumsHorizon})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}
  >
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 right-0 h-36 pointer-events-none mix-blend-overlay bg-gradient-to-b from-cyber-bg/80 via-cyber-bg/20 to-transparent"
    />
  </div>
);

export default ForumsHorizonBanner;
