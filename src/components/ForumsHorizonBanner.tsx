import React from 'react';
import forumsHorizon from '../assets/forums-horizon.png';

const ForumsHorizonBanner: React.FC = () => (
  <div
    aria-hidden="true"
    className="relative z-10 mt-20 h-[clamp(180px,28.5vw,430px)] overflow-hidden border-y border-neon-cyan/20 bg-[#05051a] shadow-[0_0_70px_rgba(0,243,255,0.08)]"
  >
    <img
      src={forumsHorizon}
      alt=""
      loading="lazy"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover object-center"
    />
  </div>
);

export default ForumsHorizonBanner;
