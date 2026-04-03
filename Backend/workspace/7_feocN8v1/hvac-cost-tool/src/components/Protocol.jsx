import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Protocol = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.stack-card');
      
      cards.forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top top",
          pin: true,
          pinSpacing: false,
          end: "+=100%",
          animation: gsap.to(card, {
            scale: 0.9,
            opacity: 0.5,
            filter: "blur(20px)",
            ease: "none",
          }),
          scrub: true,
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const steps = [
    {
      num: "01",
      title: "INPUT SPECIFICATIONS",
      desc: "Define the fundamental physics of your environment. Airflow, static pressure, and thermal loads map to an internal algorithmic bounds check.",
      svg: (
        <svg viewBox="0 0 100 100" className="w-full h-full animate-[spin_15s_linear_infinite]">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 8" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
        </svg>
      )
    },
    {
      num: "02",
      title: "COMPONENT MODELLING",
      desc: "Architect the handling unit layer-by-layer. Our system instantly syncs your configurations against cost databases and cross-compatibility rules.",
      svg: (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path d="M10,50 Q25,10 50,50 T90,50" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="100" className="animate-[dash_3s_ease-in-out_infinite_alternate]" />
        </svg>
      )
    },
    {
      num: "03",
      title: "ACTIVATE SYSTEM",
      desc: "Lock in the telemetry. Generate the bill of materials, approve architectural margins, and dispatch the engineering specification to procurement.",
      svg: (
        <svg viewBox="0 0 100 100" className="w-full h-full relative">
          <rect x="20" y="20" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="2" className="animate-pulse" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="1" className="animate-bounce" />
        </svg>
      )
    }
  ];

  return (
    <section ref={containerRef} id="protocol" className="relative w-full bg-background">
      <div className="absolute top-8 left-8 z-50 font-mono text-sm tracking-widest text-dark/50">PROTOCOL.SEQ</div>
      {steps.map((step, i) => (
        <div key={i} className={`stack-card w-full h-[100dvh] flex items-center justify-center p-8 md:p-16 relative ${i % 2 === 0 ? 'bg-background' : 'bg-[#E0DDD6]'} border-b border-dark/10`}>
          <div className="max-w-6xl w-full flex flex-col md:flex-row gap-16 items-center">
            <div className="flex-1 text-dark">
              <span className="font-mono text-6xl md:text-8xl font-black text-accent mb-4 block">{step.num}</span>
              <h2 className="font-sans font-bold text-4xl md:text-5xl uppercase tracking-tighter mb-6">{step.title}</h2>
              <p className="font-mono text-lg text-dark/80 max-w-lg">{step.desc}</p>
            </div>
            <div className="flex-1 flex justify-center items-center w-full max-w-sm text-accent opacity-80">
              {step.svg}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
};

export default Protocol;
