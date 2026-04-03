import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRight, ArrowLeft, Save, FileText, ChevronDown, Plus, Download, Settings, AlertTriangle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { useConfig, CATEGORY_LABELS } from '../context/ConfigContext';
import { evaluateRules, calculateCost } from '../utils/rulesEngine';

const GROUPS = [
  { id: 'structural', label: 'Casing & Structure', keys: ['profile', 'pufPanels', 'internal', 'hardware'] },
  { id: 'air', label: 'Air Movement', keys: ['fans', 'motors', 'dampers'] },
  { id: 'thermal', label: 'Thermodynamics', keys: ['coils', 'pads', 'eliminators'] },
  { id: 'quality', label: 'Filtration & Quality', keys: ['filters'] },
  { id: 'ops', label: 'Operational Params', keys: ['electricity'] }
];

const AppConfigurator = () => {
  const { config } = useConfig();
  const DB_COMPONENTS = config.components;
  
  const [view, setView] = useState(() => localStorage.getItem('hvacView') || 'dashboard');
  const [quotes, setQuotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hvacQuotes')) || []; } catch(e) { return []; }
  });
  
  const [specs, setSpecs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hvacSpecs')) || { airflow: '7500', pressure: '2.0', app: 'Commercial' }; } catch(e) { return { airflow: '7500', pressure: '2.0', app: 'Commercial' }; }
  });
  
  const [selection, setSelection] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hvacSelection')) || {}; } catch(e) { return {}; }
  });

  const [activeAccordion, setActiveAccordion] = useState('structural');

  useEffect(() => {
    localStorage.setItem('hvacView', view);
    localStorage.setItem('hvacQuotes', JSON.stringify(quotes));
    localStorage.setItem('hvacSpecs', JSON.stringify(specs));
    localStorage.setItem('hvacSelection', JSON.stringify(selection));
  }, [view, quotes, specs, selection]);

  // Run Engine
  const engineResults = useMemo(() => evaluateRules(specs, selection, config), [specs, selection, config]);

  // Get Individual Line Item Cost
  const getLineCost = (category) => {
    const selectedId = selection[category];
    if (!selectedId) return 0;
    const item = DB_COMPONENTS[category]?.find(x => x.id === selectedId);
    if (!item) return 0;
    return calculateCost(category, item, specs, engineResults.dynamicProps);
  };

  // Calculating total
  const getSubtotal = () => {
    let total = config.global.baseCasingCost + (parseInt(specs.airflow) * config.global.casingMultiplier);
    Object.keys(CATEGORY_LABELS).forEach(cat => {
      total += getLineCost(cat);
    });
    return total;
  };

  const calculateGrandTotal = () => {
    const sub = getSubtotal();
    const labor = sub * config.global.laborRate;
    const margin = (sub + labor) * config.global.marginRate;
    return sub + labor + margin;
  };

  const handleSaveQuote = () => {
    const newQuote = {
      id: `QTE-${Math.floor(Math.random() * 90000) + 10000}`,
      date: new Date().toLocaleDateString(),
      total: calculateGrandTotal(),
      specs: {...specs},
      selection: {...selection}
    };
    setQuotes([newQuote, ...quotes]);
    setView('dashboard');
  };

  const handleExportPDF = () => {
    const element = document.getElementById('quote-summary-content');
    const opt = {
      margin:       10,
      filename:     `HVAC-Quote-${new Date().getTime()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="min-h-screen bg-background text-dark font-sans flex flex-col items-center pb-24">
      {/* App Header */}
      <header className="w-full bg-dark text-primary px-8 py-4 flex justify-between items-center fixed top-0 z-50 shadow-md">
        <Link to="/" className="font-bold tracking-widest hover:text-accent transition-colors">HVAC COMMAND :: Estimator</Link>
        <div className="flex items-center gap-4 text-sm font-mono">
          <Link to="/settings" className="hover:text-accent font-bold uppercase flex items-center gap-2 transition-colors"><Settings size={14}/> Engine Settings</Link>
          <span className="text-accent ml-4 hidden md:inline">User: Sales_Engineering</span>
          <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center">SE</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-6xl mt-24 px-4 md:px-8">
        
        {view !== 'dashboard' && (
          <div className="w-full mb-12 max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="flex justify-between font-mono text-xs font-bold uppercase tracking-widest text-dark/40 mb-3">
              <span className={view === 'step1' ? 'text-accent' : 'text-dark'}>1. Physics</span>
              <span className={view === 'step2' ? 'text-accent' : (view === 'step3' ? 'text-dark' : '')}>2. Architecture</span>
              <span className={view === 'step3' ? 'text-accent' : ''}>3. Summary</span>
            </div>
            <div className="w-full h-1.5 bg-dark/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]" 
                style={{ width: view === 'step1' ? '33.33%' : view === 'step2' ? '66.66%' : '100%' }}
              />
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end mb-8 border-b border-dark/10 pb-4">
              <div>
                <h1 className="text-3xl font-bold uppercase tracking-tight">Project Dashboard</h1>
                <p className="font-mono text-sm text-dark/60 mt-2">Manage AHU quotations and project specifications.</p>
              </div>
              <button onClick={() => setView('step1')} className="magnetic-btn bg-accent text-primary px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                <Plus size={16} /> New Quote
              </button>
            </div>
            
            {quotes.length === 0 ? (
              <div className="w-full bg-white border border-dark/10 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
                <FileText className="text-dark/20 mb-4" size={48} />
                <h3 className="text-xl font-bold">No Quotes Generated</h3>
                <p className="text-dark/60 mt-2 max-w-sm mb-6">Start a new project workflow to calculate structural costs for air handling units.</p>
              </div>
            ) : (
              <div className="w-full bg-white border border-dark/10 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left font-mono text-sm">
                  <thead className="bg-[#E0DDD6] text-dark">
                    <tr>
                      <th className="py-4 px-6 font-bold uppercase">Quote ID</th>
                      <th className="py-4 px-6 font-bold uppercase">Date</th>
                      <th className="py-4 px-6 font-bold uppercase">Airflow Config</th>
                      <th className="py-4 px-6 font-bold uppercase text-right">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map(q => (
                      <tr key={q.id} className="border-b border-dark/5 hover:bg-dark/5 transition-colors cursor-pointer">
                        <td className="py-4 px-6 text-accent font-bold">{q.id}</td>
                        <td className="py-4 px-6">{q.date}</td>
                        <td className="py-4 px-6">{q.specs.airflow} CFM</td>
                        <td className="py-4 px-6 text-right font-bold">₹{q.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'step1' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">Step 1: System Physics</h2>
            <p className="font-mono text-sm text-dark/60 mb-8 border-b border-dark/10 pb-4">Define operating parameters for baseline unit scaling.</p>
            
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="font-bold text-sm uppercase">Airflow Requirement (CFM)</label>
                <input type="number" value={specs.airflow} onChange={e => setSpecs({...specs, airflow: e.target.value})} className="w-full bg-white border border-dark/20 rounded-lg px-4 py-3 font-mono focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-bold text-sm uppercase">External Static Pressure (in. H₂O)</label>
                <input type="number" step="0.1" value={specs.pressure} onChange={e => setSpecs({...specs, pressure: e.target.value})} className="w-full bg-white border border-dark/20 rounded-lg px-4 py-3 font-mono focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-bold text-sm uppercase">Application Environment</label>
                <select value={specs.app} onChange={e => setSpecs({...specs, app: e.target.value})} className="w-full bg-white border border-dark/20 rounded-lg px-4 py-3 font-mono focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all">
                  <option value="Commercial">Commercial Office</option>
                  <option value="Hospital">Hospital / Clinical</option>
                  <option value="Industrial">Industrial Manufacturing</option>
                </select>
              </div>
            </div>

            <div className="mt-12 flex justify-end">
              <button onClick={() => setView('step2')} className="magnetic-btn bg-dark text-primary px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                Configure Assembly <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {view === 'step2' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">Step 2: Architecture Setup</h2>
              <p className="font-mono text-sm text-dark/60 mb-6 border-b border-dark/10 pb-4">Select thermal and mechanical modules.</p>
              
              {/* Rules Engine Notifications */}
              {(engineResults.warnings.length > 0 || engineResults.suggestions.length > 0) && (
                <div className="mb-6 space-y-3">
                  {engineResults.warnings.map((w, i) => (
                    <div key={i} className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 text-sm">
                      <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                      <div className="font-mono">{w}</div>
                    </div>
                  ))}
                  {engineResults.suggestions.map((s, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-start gap-3 text-sm">
                      <Info className="shrink-0 mt-0.5" size={18} />
                      <div className="font-mono">{s}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {GROUPS.map(group => (
                  <div key={group.id} className="bg-white border border-dark/10 rounded-xl overflow-hidden">
                    <button 
                      onClick={() => setActiveAccordion(activeAccordion === group.id ? null : group.id)}
                      className="w-full px-6 py-4 flex items-center justify-between bg-[#F5F3EE] hover:bg-[#E8E4DD] transition-colors"
                    >
                      <h3 className="font-bold uppercase tracking-widest text-sm">{group.label}</h3>
                      <ChevronDown size={16} className={`transition-transform duration-300 ${activeAccordion === group.id ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <div className={`transition-all duration-300 overflow-hidden ${activeAccordion === group.id ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="p-6 space-y-8">
                        {group.keys.map(catKey => (
                          <div key={catKey}>
                            <h4 className="font-mono text-xs uppercase text-dark/40 font-bold mb-3 tracking-widest">{CATEGORY_LABELS[catKey]}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <label className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${!selection[catKey] ? 'border-accent bg-accent/5' : 'border-dark/10 hover:border-dark/30'}`}>
                                <input type="radio" name={catKey} className="mt-1" checked={!selection[catKey]} onChange={() => setSelection({...selection, [catKey]: null})} />
                                <div className="font-bold">None / Not Required</div>
                              </label>
                              {DB_COMPONENTS[catKey]?.map(item => (
                                <label key={item.id} className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${selection[catKey] === item.id ? 'border-accent bg-accent/5' : 'border-dark/10 hover:border-dark/30'}`}>
                                  <input type="radio" name={catKey} className="mt-1" checked={selection[catKey] === item.id} onChange={() => setSelection({...selection, [catKey]: item.id})} />
                                  <div className="flex-1">
                                    <div className="font-bold leading-tight">{item.model}</div>
                                    <div className="font-mono text-xs text-dark/50 mt-1 flex flex-wrap gap-1">
                                      {Object.keys(item).filter(k => !['id','model'].includes(k)).map(k => (
                                        <span key={k} className="bg-dark/5 px-1.5 py-0.5 border border-dark/10 rounded">
                                          {k}: {typeof item[k] === 'boolean' ? (item[k] ? 'Yes':'No') : item[k]}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-between">
                <button onClick={() => setView('step1')} className="px-6 py-3 font-bold uppercase text-dark/60 hover:text-dark flex flex-row items-center justify-center gap-2"><ArrowLeft size={16}/> Back</button>
                <button onClick={() => setView('step3')} className="magnetic-btn bg-dark text-primary px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm flex flex-row items-center justify-center gap-2">Review Quote <ArrowRight size={16}/></button>
              </div>
            </div>

            {/* Sidebar Pricing Engine */}
            <div className="w-full lg:w-80 shrink-0">
              <div className="sticky top-24 bg-dark text-primary rounded-[2rem] p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-6 text-accent">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                  <span className="font-mono text-xs uppercase tracking-widest font-bold">Live Engine Active</span>
                </div>
                
                <h4 className="font-bold mb-4 uppercase">Accumulator Feed</h4>
                <div className="space-y-2 font-mono text-[11px] border-b border-primary/20 pb-4 mb-4 h-64 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex justify-between text-primary/60">
                    <span>Base Casing</span>
                    <span>₹{(config.global.baseCasingCost + (specs.airflow * config.global.casingMultiplier)).toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
                  
                  {Object.keys(CATEGORY_LABELS).map(cat => {
                    if (selection[cat]) {
                      const cost = getLineCost(cat);
                      const model = DB_COMPONENTS[cat].find(x => x.id === selection[cat])?.model;
                      // Don't accumulate operational costs like electricity into standard subtotal display, just show it
                      if(cat === 'electricity') return (
                        <div key={cat} className="flex flex-col text-accent/60 pt-1 pb-1 border-t border-primary/10">
                           <span className="truncate pr-4 leading-tight">{CATEGORY_LABELS[cat]}: {model}</span>
                           <span className="text-right">[OpEx Calc Only]</span>
                        </div>
                      );
                      
                      return (
                         <div key={cat} className="flex flex-col text-accent pt-1 pb-1 border-t border-primary/10">
                           <span className="truncate pr-4 leading-tight">{model}</span>
                           <span className="text-right">+ ₹{cost.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                         </div>
                      );
                    }
                    return null;
                  })}
                </div>
                
                <div className="flex justify-between font-bold text-xl items-end">
                  <span>Est Price:</span>
                  <span className="font-sans text-accent">₹{getSubtotal().toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                </div>
                <div className="text-right font-mono text-[10px] text-primary/40 mt-1">*Excludes overhead/margin</div>
              </div>
            </div>
          </div>
        )}

        {view === 'step3' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <div id="quote-summary-content" className="bg-white border border-dark/10 shadow-lg rounded-2xl overflow-hidden mb-8">
              {/* Invoice Header */}
              <div className="bg-dark text-primary p-8 md:p-12">
                <div className="flex justify-between items-start border-b border-primary/20 pb-8 mb-8">
                  <div>
                    <h2 className="font-serif italic text-4xl mb-2">Quotation Summary</h2>
                    <p className="font-mono text-sm text-primary/60">HVAC COMMAND SYSTEMS</p>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-accent text-xl font-bold mb-1">QTE-PROFORMA</div>
                    <div className="text-primary/60 text-sm">Date: {new Date().toLocaleDateString()}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-8 font-mono text-sm">
                  <div>
                    <span className="block text-primary/50 mb-1 uppercase text-xs">Project Specs</span>
                    <ul className="text-primary/90 space-y-1">
                      <li>Airflow: {specs.airflow} CFM</li>
                      <li>Static Pressure: {specs.pressure} in. H2O</li>
                      <li>Environment: {specs.app}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Invoice Body */}
              <div className="p-8 md:p-12">
                <table className="w-full text-left font-mono text-sm">
                  <thead className="border-b border-dark/20 text-dark/50">
                    <tr>
                      <th className="pb-4 font-bold uppercase">Component Architecture Breakdown</th>
                      <th className="pb-4 font-bold uppercase text-right">Ext. Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark/5">
                    <tr>
                      <td className="py-4 font-bold">Cabinet Casing Foundation</td>
                      <td className="py-4 text-right">₹{(config.global.baseCasingCost + (specs.airflow * config.global.casingMultiplier)).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                    </tr>
                    
                    {Object.keys(CATEGORY_LABELS).map(cat => {
                      if (selection[cat] && cat !== 'electricity') {
                         const cost = getLineCost(cat);
                         const model = DB_COMPONENTS[cat].find(x => x.id === selection[cat])?.model;
                         return (
                           <tr key={cat}>
                             <td className="py-4">
                               <div className="text-xs text-dark/40 uppercase mb-0.5">{CATEGORY_LABELS[cat]}</div>
                               <div className="font-bold">{model}</div>
                             </td>
                             <td className="py-4 text-right align-bottom">₹{cost.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                           </tr>
                         )
                      }
                      return null;
                    })}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="mt-8 pt-8 border-t border-dark/20 flex flex-col items-end font-mono gap-2 text-sm">
                  <div className="w-72 flex justify-between text-dark/60">
                    <span>Mfg. Subtotal:</span>
                    <span>₹{getSubtotal().toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
                  <div className="w-72 flex justify-between text-dark/60">
                    <span>Assembly Labor ({(config.global.laborRate * 100).toFixed(0)}%):</span>
                    <span>+ ₹{(getSubtotal() * config.global.laborRate).toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
                  <div className="w-72 flex justify-between text-dark/60">
                    <span>Margin Builder ({(config.global.marginRate * 100).toFixed(0)}%):</span>
                    <span>+ ₹{((getSubtotal() + getSubtotal() * config.global.laborRate) * config.global.marginRate).toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
                  <div className="w-full max-w-sm flex justify-between items-end border-t border-dark mt-4 pt-4">
                    <span className="font-sans font-bold text-xl uppercase tracking-tighter">Grand Total</span>
                    <span className="font-sans font-black text-3xl text-accent">₹{calculateGrandTotal().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                </div>
                
                {/* OpEx Banner */}
                {selection.electricity && (
                  <div className="mt-12 p-6 bg-dark/5 border border-dark/10 rounded-xl font-mono text-sm border-l-4 border-l-accent">
                    <h4 className="font-bold uppercase tracking-widest mb-1">OpEx Estimation (Electricity)</h4>
                    <p className="text-dark/60">Selected Tariff: <strong>{DB_COMPONENTS.electricity.find(x => x.id === selection.electricity)?.model}</strong> @ ₹{DB_COMPONENTS.electricity.find(x => x.id === selection.electricity)?.rate}/kWh</p>
                    <p className="text-xs text-dark/40 mt-2">*Operational expenses are calculated dynamically based on running hours and selected Drive Motor HP efficiency. This is a separate metric from the Capital Expenditure Grand Total above.</p>
                  </div>
                )}
                
              </div>
            </div>

            <div className="flex justify-between items-center bg-white border border-dark/10 p-6 rounded-2xl shadow-sm mb-12">
               <button onClick={() => setView('step2')} className="px-6 py-3 font-bold uppercase text-dark/60 hover:text-dark flex flex-row items-center justify-center gap-2"><ArrowLeft size={16}/> Edit Architecture</button>
               <div className="flex gap-4">
                 <button onClick={handleExportPDF} className="magnetic-btn bg-dark text-primary px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                   <Download size={18} /> Export PDF
                 </button>
                 <button onClick={handleSaveQuote} className="magnetic-btn bg-accent text-primary px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                   <Save size={18} /> Save & Finalize
                 </button>
               </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Required Internal Global Styles to fix component scrolling */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
      `}}/>
    </div>
  );
};

export default AppConfigurator;
