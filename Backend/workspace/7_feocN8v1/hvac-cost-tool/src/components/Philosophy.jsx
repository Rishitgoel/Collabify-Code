import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Philosophy = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      // Parallax Background
      gsap.to('.bg-parallax', {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        }
      });

      // Text Reveal
      gsap.fromTo('.reveal-text',
        { y: 50, opacity: 0 },
        { 
          y: 0, opacity: 1, 
          duration: 1, 
          stagger: 0.15, 
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.text-container',
            start: 'top 75%',
          }
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative w-full min-h-[80vh] bg-dark flex items-center justify-center overflow-hidden py-32 border-y border-primary/10">
      {/* Background with noise and low opacity */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1542282088-fe8426682b8f?q=80&w=2574&auto=format&fit=crop" 
          alt="Raw concrete texture" 
          className="bg-parallax w-full h-[130%] object-cover grayscale opacity-20 -top-[15%]"
        />
        <div className="absolute inset-0 bg-dark/80 backdrop-blur-[2px]"></div>
      </div>

      <div className="text-container relative z-10 max-w-6xl w-full px-8 md:px-16 flex flex-col gap-12">
        <div className="reveal-text">
          <p className="font-mono text-primary/60 text-lg md:text-xl uppercase tracking-widest mb-2">Most estimation focuses on:</p>
          <p className="font-sans text-primary text-3xl md:text-5xl font-bold tracking-tight">Manual spreadsheet lookups combined with guesswork.</p>
        </div>
        
        <div className="reveal-text mt-8 md:mt-16 ml-0 md:ml-32">
          <p className="font-mono text-accent text-lg md:text-xl uppercase tracking-widest mb-2">We focus on:</p>
          <h2 className="font-serif italic text-5xl md:text-7xl lg:text-8xl text-primary leading-tight">
            Algorithm-driven <span className="text-accent underline decoration-1 underline-offset-8"> structural pricing.</span>
          </h2>
        </div>
      </div>
    </section>
  );
};

export default Philosophy;
