import React from 'react';
import { Link } from 'react-router-dom';

const Pricing = () => {
  return (
    <section id="pricing" className="w-full bg-dark text-primary py-32 px-8 flex justify-center items-center border-t border-primary/10">
      <div className="max-w-4xl w-full flex flex-col items-center text-center gap-8">
        <h2 className="font-serif italic text-6xl md:text-8xl text-primary tracking-tighter">
          Ready to <span className="text-accent underline decoration-1 underline-offset-[12px]">Configure?</span>
        </h2>
        <p className="font-mono text-primary/60 max-w-xl text-sm md:text-base leading-relaxed">
          The HVAC AHU Cost Estimation Tool provides immediate access to professional quoting, exact component selection, and structural pricing margins. Start estimating raw costs instantly.
        </p>
        <Link to="/app" className="magnetic-btn mt-8 bg-accent text-primary px-12 py-6 rounded-[3rem] font-sans font-black uppercase text-xl md:text-2xl tracking-[0.2em] shadow-[0_0_40px_rgba(230,59,46,0.3)] hover:shadow-[0_0_60px_rgba(230,59,46,0.6)]">
          Launch Interface
        </Link>
      </div>
    </section>
  );
};

export default Pricing;
