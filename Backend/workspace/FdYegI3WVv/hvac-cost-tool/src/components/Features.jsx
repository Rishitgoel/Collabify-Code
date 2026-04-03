import React, { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { Database, Zap, FileJson } from 'lucide-react';

const Features = () => {
  // Card 1 Shuffler
  const [shufflerData, setShufflerData] = useState([
    { id: 1, text: "Select Fan Modules", cost: "₹ 2,400" },
    { id: 2, text: "Add Filtration Stages", cost: "₹   850" },
    { id: 3, text: "Specify Coil Ratings", cost: "₹ 4,120" }
  ]);

  useEffect(() => {
    const int = setInterval(() => {
      setShufflerData(prev => {
        const arr = [...prev];
        arr.unshift(arr.pop());
        return arr;
      });
    }, 3000);
    return () => clearInterval(int);
  }, []);

  // Card 2 Typewriter
  const originalFeed = [
    "[INFO] Load calculation triggered...",
    "[CALC] Static pressure = 2.05 in H2O",
    "[WARN] High dust load detected -> Upsize fan motor",
    "[EXEC] Applying baseline margin: 15%",
    "[SUCCESS] Quote generation ready."
  ];
  const [typedLines, setTypedLines] = useState([]);
  
  useEffect(() => {
    let charIndex = 0;
    let lineIndex = 0;
    let currentLine = "";
    
    const typeWriter = setInterval(() => {
      if (lineIndex >= originalFeed.length) {
        clearInterval(typeWriter);
        return;
      }
      
      const targetString = originalFeed[lineIndex];
      if (charIndex < targetString.length) {
        currentLine += targetString[charIndex];
        setTypedLines(prev => {
          const newLines = [...prev];
          newLines[lineIndex] = currentLine;
          return newLines;
        });
        charIndex++;
      } else {
        lineIndex++;
        charIndex = 0;
        currentLine = "";
      }
    }, 40);
    return () => clearInterval(typeWriter);
  }, []);

  return (
    <section id="features" className="w-full bg-background py-32 px-8 md:px-16 text-dark flex justify-center">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Card 1: Diagnostic Shuffler */}
        <div className="bg-primary border border-dark/10 rounded-[2rem] p-8 shadow-sm flex flex-col h-[450px]">
          <div className="flex items-center gap-4 mb-6">
            <Database className="text-accent" size={24} />
            <h3 className="font-sans font-bold text-xl uppercase tracking-tighter">Instant Modular Config</h3>
          </div>
          <p className="font-mono text-sm text-dark/70 mb-12">Build units from the casing to the heat wheel in seconds.</p>
          <div className="relative flex-1 flex flex-col items-center justify-end pb-8">
            {shufflerData.map((item, i) => (
              <div 
                key={item.id} 
                className="absolute w-full px-6 py-4 bg-background border border-dark/10 shadow-lg rounded-2xl flex justify-between items-center font-mono text-sm"
                style={{
                  transform: `translateY(-${i * 1.5}rem) scale(${1 - i * 0.05})`,
                  opacity: 1 - i * 0.25,
                  zIndex: 10 - i,
                  transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                <span className="text-dark font-bold">{item.text}</span>
                <span className="text-accent font-bold">{item.cost}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Telemetry Typewriter */}
        <div className="bg-dark text-primary border border-white/10 rounded-[2rem] p-8 shadow-xl flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Zap className="text-accent" size={24} />
              <h3 className="font-sans font-bold text-xl uppercase tracking-tighter text-primary">Dynamic Rules Engine</h3>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-accent">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div> Live Feed
            </div>
          </div>
          <p className="font-mono text-sm text-primary/50 mb-8">Algorithms instantly flag engineering incompatibilities and calculate costs.</p>
          <div className="flex-1 bg-black/50 rounded-xl p-4 font-mono text-xs overflow-hidden flex flex-col gap-2">
            {typedLines.map((line, idx) => (
              <div key={idx} className={`${line.includes('[WARN]') ? 'text-accent' : 'text-primary/80'}`}>{line}</div>
            ))}
            <div className="animate-pulse w-2 h-4 bg-accent mt-1"></div>
          </div>
        </div>

        {/* Card 3: Cursor Protocol Scheduler */}
        <div className="bg-primary border border-dark/10 rounded-[2rem] p-8 shadow-sm flex flex-col h-[450px] overflow-hidden group">
          <div className="flex items-center gap-4 mb-6">
            <FileJson className="text-accent" size={24} />
            <h3 className="font-sans font-bold text-xl uppercase tracking-tighter">Professional PDF Quoting</h3>
          </div>
          <p className="font-mono text-sm text-dark/70 mb-8">Export production-ready itemized bills of materials with engineered margins.</p>
          
          <div className="relative flex-1 bg-background rounded-xl p-4 border border-dark/5 flex flex-col items-center justify-center">
            {/* Mock Quote layout */}
            <div className="w-full flex justify-between font-mono text-[10px] text-dark/40 border-b border-dark/10 pb-2 mb-2">
              <span>Item #001: SUPPLY FAN ECM</span> <span>₹2,400.00</span>
            </div>
            <div className="w-full flex justify-between font-mono text-[10px] text-dark/40 border-b border-dark/10 pb-2 mb-2">
              <span>Item #002: HEPA M13 STAGE</span> <span>₹1,100.00</span>
            </div>
            
            <div className="mt-auto w-full group-hover:bg-accent group-hover:text-primary transition-colors bg-dark text-primary px-4 py-3 rounded-lg flex justify-between items-center font-sans font-black uppercase text-sm">
              <span>Save & Export PDF</span>
              <span>Total: ₹3,500</span>
            </div>
            
            {/* Animated Cursor */}
            <svg 
              className="absolute z-20 text-accent transition-all duration-[2000ms] ease-in-out -bottom-10 -right-10 group-hover:translate-x-[-120px] group-hover:translate-y-[-60px]" 
              width="36" height="36" viewBox="0 0 24 24" fill="currentColor"
            >
              <path d="M4 2.82823L20 11.5147L12.4497 13.065L14.7929 19.3283L11.0208 20.7425L8.67767 14.4792L4 17.5147V2.82823Z" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
