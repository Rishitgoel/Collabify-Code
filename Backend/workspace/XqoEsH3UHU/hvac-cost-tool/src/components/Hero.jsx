import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Link } from 'react-router-dom';

const Hero = () => {
  const heroRef = useRef(null);
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-text', 
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, stagger: 0.08, ease: 'power3.out', delay: 0.2 }
      );
      gsap.fromTo('.hero-cta',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.6 }
      );
    }, heroRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} className="relative w-full h-[100dvh] overflow-hidden flex items-end pb-24 px-8 md:px-16">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1518002054494-3a6f94352e9d?q=80&w=2574&auto=format&fit=crop" 
          alt="Concrete Brutalist Architecture" 
          className="w-full h-full object-cover grayscale opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/80 to-transparent"></div>
      </div>
      
      <div className="relative z-10 max-w-5xl flex flex-col gap-4">
        <h1 className="flex flex-col gap-1">
          <span className="hero-text block font-sans font-bold text-3xl md:text-5xl lg:text-6xl text-primary tracking-tight uppercase">
            Quantify the
          </span>
          <span className="hero-text block font-serif italic text-6xl md:text-8xl lg:text-[9rem] leading-[0.85] text-accent tracking-tighter pr-4">
            Infrastructure.
          </span>
        </h1>
        <p className="hero-text text-primary/70 font-mono max-w-xl text-sm md:text-base mt-4 leading-relaxed">
          Industrial-grade AHU configuration. Raw parameter inputs mapped precisely to commercial cost outputs. Zero speculation.
        </p>
        <div className="hero-cta mt-8">
          <Link to="/app" className="magnetic-btn inline-block bg-accent px-8 py-4 rounded-[2rem] text-primary font-sans font-bold tracking-widest text-sm hover:bg-primary hover:text-dark transition-colors duration-300">
            LAUNCH ESTIMATOR
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Hero;
