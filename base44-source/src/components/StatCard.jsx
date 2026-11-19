import React, { useEffect, useRef, useState } from "react";

const DOTS = [
  [14, 14, 0.54], [38, 14, 0.36], [62, 14, 0.18], [86, 14, 0],
  [38, 38, 0.54], [62, 38, 0.36], [86, 38, 0.18],
  [62, 62, 0.54], [86, 62, 0.36], [86, 86, 0.54],
];

const ACCENTS = {
  navy: "30,64,140",
  red: "190,35,50",
  amber: "202,138,4",
  green: "22,128,80",
};

export default function StatCard({ title, value = 0, details = [], tone = "navy", loading }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(0);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.2 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || loading) return;
    let raf, start;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 900, 1);
      setShown(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, loading]);

  const rgb = ACCENTS[tone];
  return (
    <div
      ref={ref}
      className="relative flex min-h-[200px] flex-col justify-between gap-8 overflow-hidden rounded-[2rem] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_18px_40px_-24px_rgba(0,0,0,0.25)]"
      style={{
        backgroundColor: "#EEF1F6",
        backgroundImage: `radial-gradient(125% 125% at 100% 0%, rgba(${rgb},0.38) 0%, rgba(${rgb},0.14) 30%, rgba(${rgb},0) 62%)`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-xl font-medium tracking-tight text-slate-900">{title}</h3>
        <svg className="h-12 w-12 shrink-0" viewBox="0 0 100 100" aria-hidden="true" fill={`rgb(${rgb})`}>
          {DOTS.map(([cx, cy, d], i) => (
            <circle
              key={i} cx={cx} cy={cy} r="9"
              style={{
                transformBox: "fill-box", transformOrigin: "center",
                opacity: seen ? 1 : 0.3, transform: seen ? "scale(1)" : "scale(0.82)",
                transition: `all 0.5s cubic-bezier(0.22,1,0.36,1) ${d}s`,
              }}
            />
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="text-6xl font-bold leading-none tracking-tighter tabular-nums text-slate-900">
          {loading ? "–" : shown.toLocaleString()}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {details.map((d) => (
            <div key={d.label}>
              <dt className="text-sm text-slate-600">{d.label}</dt>
              <dd className="text-base font-medium text-slate-900">{d.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
