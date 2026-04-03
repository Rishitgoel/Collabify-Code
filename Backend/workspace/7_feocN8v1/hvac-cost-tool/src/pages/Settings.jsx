import React, { useState } from 'react';
import { useConfig, CATEGORY_LABELS } from '../context/ConfigContext';
import { Settings2, ArrowLeft, RefreshCw, Trash2, Plus, Sliders } from 'lucide-react';
import { Link } from 'react-router-dom';

const Settings = () => {
  const { config, updateGlobal, updateComponent, addComponent, removeComponent, resetToDefault } = useConfig();
  const [activeTab, setActiveTab] = useState('global');
  const [activeCategory, setActiveCategory] = useState('internal');

  return (
    <div className="min-h-screen bg-background text-dark font-sans flex flex-col pb-24">
      
      {/* Settings Header */}
      <header className="w-full bg-dark text-primary px-8 py-4 flex justify-between items-center fixed top-0 z-50 shadow-md">
        <Link to="/" className="font-bold tracking-widest hover:text-accent transition-colors flex items-center gap-2">
          <ArrowLeft size={16} /> HVAC COMMAND :: Settings
        </Link>
        <div className="flex items-center gap-4 text-sm font-mono">
           <Link to="/app" className="text-dark bg-primary px-4 py-1.5 rounded-full hover:bg-accent hover:text-primary transition-colors font-bold uppercase">Back to Estimator</Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl mt-24 px-4 md:px-8 mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="sticky top-24 space-y-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-dark/40 mb-4 px-4">Configuration</h3>
            <button 
              onClick={() => setActiveTab('global')}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold uppercase transition-colors flex items-center gap-3 ${activeTab === 'global' ? 'bg-dark text-primary' : 'hover:bg-dark/5 text-dark/70'}`}
            >
              <Settings2 size={18} /> Global Parameters
            </button>
            <button 
              onClick={() => setActiveTab('components')}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold uppercase transition-colors flex items-center gap-3 ${activeTab === 'components' ? 'bg-dark text-primary' : 'hover:bg-dark/5 text-dark/70'}`}
            >
              <Sliders size={18} /> Component Math
            </button>
            
            {activeTab === 'components' && (
              <div className="pl-8 pr-4 py-2 space-y-1 animate-in slide-in-from-top-2 duration-300">
                {Object.keys(CATEGORY_LABELS).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`block w-full text-left text-xs uppercase font-bold tracking-wider py-2 transition-colors ${activeCategory === cat ? 'text-accent' : 'text-dark/40 hover:text-dark/80'}`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-12 pt-6 border-t border-dark/10 px-4">
              <button 
                onClick={resetToDefault}
                className="text-accent/80 hover:text-accent font-bold uppercase text-xs flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={14} /> Reset Engine Defaults
              </button>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'global' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white border border-dark/10 rounded-2xl p-8">
              <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">Global Parameters</h2>
              <p className="font-mono text-sm text-dark/60 mb-8 border-b border-dark/10 pb-4">Define formulas and rules for overhead calculation.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Base Casing Cost (Fixed)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-dark/40">₹</span>
                    <input 
                      type="number" 
                      value={config.global.baseCasingCost} 
                      onChange={e => updateGlobal('baseCasingCost', e.target.value)}
                      className="w-full bg-background border border-dark/20 rounded-lg pl-8 pr-4 py-3 font-mono focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" 
                    />
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Casing CFM Scaling Multiplier</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-dark/40">x</span>
                    <input 
                      type="number" 
                      step="0.1"
                      value={config.global.casingMultiplier} 
                      onChange={e => updateGlobal('casingMultiplier', e.target.value)}
                      className="w-full bg-background border border-dark/20 rounded-lg pl-8 pr-4 py-3 font-mono focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Assembly Labor Rate</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-dark/40">%</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={config.global.laborRate} 
                      onChange={e => updateGlobal('laborRate', e.target.value)}
                      className="w-full bg-background border border-dark/20 rounded-lg pl-8 pr-4 py-3 font-mono focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" 
                    />
                  </div>
                  <span className="text-xs font-mono text-dark/40">Ex: 0.15 = 15% of Subtotal</span>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Structural Margin Rate</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-dark/40">%</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={config.global.marginRate} 
                      onChange={e => updateGlobal('marginRate', e.target.value)}
                      className="w-full bg-background border border-dark/20 rounded-lg pl-8 pr-4 py-3 font-mono focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" 
                    />
                  </div>
                  <span className="text-xs font-mono text-dark/40">Ex: 0.20 = 20% of (Subtotal + Labor)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'components' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="bg-white border border-dark/10 rounded-2xl p-8">
                <div className="flex justify-between items-center border-b border-dark/10 pb-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold uppercase tracking-tight">{CATEGORY_LABELS[activeCategory]}</h2>
                    <p className="font-mono text-sm text-dark/60 mt-1">Configure pricing arrays</p>
                  </div>
                  <button onClick={() => addComponent(activeCategory)} className="text-accent hover:bg-accent/10 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold uppercase transition-colors"><Plus size={16}/> Add Unit</button>
                </div>
                
                <div className="space-y-4">
                  {config.components[activeCategory]?.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-end gap-6 p-6 bg-background border border-dark/10 rounded-xl relative group">
                      {Object.keys(item).filter(k => k !== 'id').map(key => {
                        const isString = typeof item[key] === 'string' && key !== 'price';
                        const isBoolean = typeof item[key] === 'boolean';
                        return (
                          <div key={key} className={key === 'model' ? "flex-1 min-w-[250px]" : "w-32"}>
                            <label className="text-[10px] uppercase font-bold text-dark/60 mb-2 block tracking-widest">{key}</label>
                            {isBoolean ? (
                              <input 
                                type="checkbox" 
                                checked={item[key]} 
                                onChange={e => updateComponent(activeCategory, item.id, key, e.target.checked, true)} 
                                className="w-5 h-5 accent-accent" 
                              />
                            ) : (
                              <input 
                                type={isString ? "text" : "number"} 
                                step={isString ? undefined : "0.01"}
                                value={item[key]} 
                                onChange={e => updateComponent(activeCategory, item.id, key, e.target.value)} 
                                className={`w-full bg-transparent border-b border-dark/20 pb-1 focus:outline-none focus:border-accent transition-colors ${isString ? 'font-bold' : 'font-mono'}`} 
                              />
                            )}
                          </div>
                        )
                      })}
                      <button onClick={() => removeComponent(activeCategory, item.id)} className="absolute top-4 right-4 text-accent/40 hover:text-accent p-2 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  
                  {(!config.components[activeCategory] || config.components[activeCategory].length === 0) && (
                    <div className="py-8 text-center text-dark/40 font-mono text-sm border-2 border-dashed border-dark/10 rounded-xl">
                      No components defined in this category.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Settings;
