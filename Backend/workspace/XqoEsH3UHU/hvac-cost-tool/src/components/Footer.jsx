import React from 'react';

const Footer = () => {
  return (
    <footer className="w-full bg-dark px-8 py-12 flex justify-center mt-[-1px]">
      <div className="max-w-7xl w-full bg-[#0A0A0A] rounded-t-[4rem] px-8 md:px-16 pt-24 pb-12 flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-24">
          <div className="col-span-1 md:col-span-2">
            <div className="font-sans font-bold text-3xl tracking-tight text-primary mb-4">
              HVAC COMMAND
            </div>
            <p className="font-mono text-xs text-primary/40 max-w-sm">
              The precision estimation layer for commercial air handling units. Structural pricing minus the guesswork.
            </p>
          </div>
          <div className="flex flex-col gap-4 font-mono text-sm text-primary/60">
            <span className="text-primary font-bold uppercase tracking-widest mb-2">Navigation</span>
            <a href="#features" className="hover:text-accent transition-colors">Systems</a>
            <a href="#protocol" className="hover:text-accent transition-colors">Protocol</a>
            <a href="#pricing" className="hover:text-accent transition-colors">Access</a>
          </div>
          <div className="flex flex-col gap-4 font-mono text-sm text-primary/60">
            <span className="text-primary font-bold uppercase tracking-widest mb-2">Legal</span>
            <a href="#" className="hover:text-accent transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-accent transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-accent transition-colors">System Data</a>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center border-t border-primary/10 pt-8 gap-4">
          <span className="font-mono text-xs text-primary/40">© 2026 HVAC Command. All rights reserved.</span>
          <div className="flex items-center gap-3 font-mono text-xs text-primary/60">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></div>
            SYSTEM OPERATIONAL
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
