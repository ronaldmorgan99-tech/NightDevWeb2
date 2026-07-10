import React, { useEffect, useRef } from 'react';

const NavBarGlowCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const symbolSet = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ3456789!?@#$%^&*<>[]{}-=+';
    const fontFamily = '"JetBrains Mono", monospace';
    const layers = [
      { fontSize: 12, speedMin: 0.32, speedMax: 0.48, opacity: 0.16, blur: 0.5, density: 0.82 },
      { fontSize: 14, speedMin: 0.2, speedMax: 0.34, opacity: 0.24, blur: 1.2, density: 0.92 },
      { fontSize: 16, speedMin: 0.08, speedMax: 0.18, opacity: 0.34, blur: 2.8, density: 1.0 },
    ] as const;

    type LayerState = {
      columns: number[];
      speeds: number[];
      count: number;
    };

    const layerStates: LayerState[] = layers.map(() => ({ columns: [], speeds: [], count: 0 }));
    let width = 0;
    let height = 0;
    let frame = 0;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      layers.forEach((layer, layerIndex) => {
        const state = layerStates[layerIndex];
        const count = Math.max(Math.floor(width / layer.fontSize), 1);
        state.count = count;
        state.columns.length = count;
        state.speeds.length = count;
        for (let i = 0; i < count; i += 1) {
          state.columns[i] = Math.floor(Math.random() * (height / layer.fontSize));
          state.speeds[i] = layer.speedMin + Math.random() * (layer.speedMax - layer.speedMin);
        }
      });
    };

    updateSize();

    if (!reduceMotion && typeof ResizeObserver !== 'undefined') {
      resizeObserver.current = new ResizeObserver(updateSize);
      resizeObserver.current.observe(canvas);
    }

    const draw = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(5, 10, 18, 0.28)';
      ctx.fillRect(0, 0, width, height);

      const phase = (Math.sin(frame * 0.018) + 1) / 2;
      const hue = 215 + phase * 55;
      const saturation = 88;
      const baseLightness = 40 + phase * 12;
      const glowHue = (hue + 20) % 360;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      layers.forEach((layer, layerIndex) => {
        const state = layerStates[layerIndex];
        ctx.font = `${layer.fontSize}px ${fontFamily}`;
        ctx.shadowColor = `hsla(${glowHue}, 100%, 85%, ${layer.opacity * 0.95})`;
        ctx.shadowBlur = layer.blur;

        for (let i = 0; i < state.count; i += 1) {
          if (Math.random() > layer.density) continue;

          const x = i * layer.fontSize + layer.fontSize * 0.5;
          const y = state.columns[i] * layer.fontSize;
          const char = symbolSet.charAt(Math.floor(Math.random() * symbolSet.length));
          const layerHue = (hue + layerIndex * 10) % 360;
          const layerLight = baseLightness + layerIndex * 4;
          const baseColor = `hsla(${layerHue}, ${saturation}%, ${layerLight}%, ${layer.opacity})`;
          const highlightColor = `hsla(${layerHue}, ${Math.min(100, saturation + 5)}%, ${Math.min(96, layerLight + 20)}%, ${Math.min(1, layer.opacity * 1.15)})`;

          ctx.fillStyle = baseColor;
          ctx.fillText(char, x, y);

          if (Math.random() < 0.08) {
            ctx.fillStyle = highlightColor;
            ctx.fillText(char, x, y - layer.fontSize * 0.16);
          }

          state.columns[i] += state.speeds[i];
          if (y > height + layer.fontSize * 2) {
            state.columns[i] = Math.random() * -18;
          }
        }
      });

      const fade = ctx.createLinearGradient(0, height * 0.55, 0, height);
      fade.addColorStop(0, 'rgba(5, 10, 18, 0)');
      fade.addColorStop(1, 'rgba(5, 10, 18, 0.8)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, height * 0.55, width, height * 0.45);

      frame += 1;
      animationRef.current = requestAnimationFrame(draw);
    };

    if (!reduceMotion) {
      animationRef.current = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none block w-full h-28 opacity-90"
      style={{ display: 'block' }}
      aria-hidden="true"
    />
  );
};

export default NavBarGlowCanvas;
