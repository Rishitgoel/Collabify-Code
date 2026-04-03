import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const navRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 rounded-[2rem] px-8 py-3 flex items-center gap-8 ${scrolled ? 'bg-background/80 backdrop-blur-xl border border-dark/10 shadow-lg' : 'bg-transparent text-primary'}`}>
      <div className={`font-sans font-bold text-xl tracking-tight ${scrolled ? 'text-dark' : 'text-primary'}`}>
        HVAC COMMAND
      </div>
      <div className="flex items-center gap-6 font-mono text-sm tracking-widest hidden md:flex">
        <a href="#features" className={`link-hover ${scrolled ? 'text-dark/70 hover:text-dark' : 'text-primary/70 hover:text-primary'}`}>SYSTEMS</a>
        <a href="#protocol" className={`link-hover ${scrolled ? 'text-dark/70 hover:text-dark' : 'text-primary/70 hover:text-primary'}`}>PROTOCOL</a>
        <a href="#pricing" className={`link-hover ${scrolled ? 'text-dark/70 hover:text-dark' : 'text-primary/70 hover:text-primary'}`}>ACCESS</a>
      </div>
      <Link to="/app" className="magnetic-btn relative overflow-hidden group bg-accent text-primary px-6 py-2 rounded-[2rem] font-sans font-bold text-sm tracking-wide">
        <span className="relative z-10 transition-colors duration-300 group-hover:text-dark">ESTIMATE APP</span>
        <span className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"></span>
      </Link>
    </div>
  );
};

export default Navbar;
