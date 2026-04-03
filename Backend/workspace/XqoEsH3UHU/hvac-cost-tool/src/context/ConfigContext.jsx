import React, { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext();

export const useConfig = () => useContext(ConfigContext);

// Dictionary mapping category to its default structural shape for new items
export const COMPONENT_SCHEMAS = {
  internal: { model: 'New Internal Frame', price: 0, insulation: false },
  profile: { model: 'New Profile', price: 0, lengthRate: 0 },
  hardware: { model: 'New Hardware Set', price: 0 },
  fans: { model: 'New Blower', price: 0, mult: 0, type: 'Centrifugal', staticFactor: 1.0 },
  motors: { model: 'New Motor', price: 0, hp: 0, efficiency: 1.0 },
  filters: { model: 'New Filter', price: 0, stage: 'Pre-filter' },
  pads: { model: 'New Cooling Pad', price: 0, areaRate: 0 },
  eliminators: { model: 'New Eliminator', price: 0, rowMult: 1.0 },
  dampers: { model: 'New Damper', price: 0, actuatorPrice: 0 },
  coils: { model: 'New Coil', price: 0, type: 'Chilled Water', rows: 4, areaFactor: 1.0 },
  electricity: { model: 'New Tariff', rate: 0 },
  pufPanels: { model: 'New PUF Panel', price: 0, areaRate: 0, density: 40 }
};

export const CATEGORY_LABELS = {
  internal: "Internal Structure",
  profile: "Casing Profile",
  pufPanels: "PUF Panels",
  hardware: "Hardware & Fittings",
  fans: "Fan / Blower Array",
  motors: "Drive Motors",
  filters: "Filtration",
  coils: "Cooling / Heating Coils",
  pads: "Evaporative Pads",
  eliminators: "Moisture Eliminators",
  dampers: "Air Volume Dampers",
  electricity: "Power Tariffs"
};

const DEFAULT_CONFIG = {
  global: {
    baseCasingCost: 1000,
    casingMultiplier: 0.5,
    laborRate: 0.15,
    marginRate: 0.20
  },
  components: {
    internal: [ { id: 'int1', model: 'Aluminum Frame + Drain Pan', price: 800, insulation: true } ],
    profile: [ { id: 'pro1', model: 'Heavy-duty 50mm GI', price: 0, lengthRate: 15 } ],
    hardware: [ { id: 'hw1', model: 'Premium Latches & Nylon Hinges', price: 350 } ],
    fans: [
      { id: 'f1', model: 'Standard Centrifugal', price: 1200, mult: 0.15, type: 'Centrifugal', staticFactor: 1.0 },
      { id: 'f2', model: 'ECM Plug Fan Array', price: 2500, mult: 0.25, type: 'Plug', staticFactor: 1.2 },
    ],
    motors: [
      { id: 'm1', model: '5HP IE2 Motor', price: 600, hp: 5, efficiency: 1.0 },
      { id: 'm2', model: '7.5HP IE3 Premium', price: 1100, hp: 7.5, efficiency: 1.2 }
    ],
    filters: [
      { id: 'fl1', model: 'MERV 8 Pre-filter', price: 150, stage: 'Pre-filter' },
      { id: 'fl2', model: 'HEPA M13 Final Stage', price: 900, stage: 'HEPA' },
    ],
    pads: [ { id: 'pad1', model: '100mm Celdek Evaporative Pad', price: 0, areaRate: 35 } ],
    eliminators: [ { id: 'elm1', model: 'PVC 2-Pass Drift Eliminator', price: 400, rowMult: 1.2 } ],
    dampers: [ { id: 'dmp1', model: 'GI Opposed Blade + Belimo Actuator', price: 600, actuatorPrice: 200 } ],
    coils: [
      { id: 'c1', model: 'Chilled Water Coil (4 Row)', price: 800, type: 'Chilled Water', rows: 4, areaFactor: 1.0 },
      { id: 'c2', model: 'DX Cooling Coil (6 Row)', price: 1300, type: 'DX', rows: 6, areaFactor: 1.2 },
    ],
    electricity: [ { id: 'elec1', model: 'Standard Industrial Tariff', rate: 8.5 } ],
    pufPanels: [ { id: 'puf1', model: '40mm 40kg/m3 Extruded PUF', price: 0, areaRate: 55, density: 40 } ]
  }
};

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('hvacCommandConfig_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure all components exist to avoid crashes if migrating from old version
        if (!parsed.components.internal) return DEFAULT_CONFIG;
        return parsed;
      } catch (e) {
        console.error("Error parsing config", e);
      }
    }
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('hvacCommandConfig_v2', JSON.stringify(config));
  }, [config]);

  const updateGlobal = (key, value) => {
    setConfig(prev => ({
      ...prev,
      global: {
        ...prev.global,
        [key]: parseFloat(value) || 0
      }
    }));
  };

  const updateComponent = (category, id, key, value, isBoolean = false) => {
    setConfig(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [category]: prev.components[category].map(item => {
          if (item.id === id) {
            let parsedValue = value;
            if (!isBoolean && key !== 'model' && key !== 'type' && key !== 'stage') {
              parsedValue = parseFloat(value) || 0;
            }
            return { ...item, [key]: parsedValue };
          }
          return item;
        })
      }
    }));
  };

  const addComponent = (category) => {
    const schema = COMPONENT_SCHEMAS[category] || { model: 'New Item', price: 0 };
    const newItem = { 
      id: `${category.substring(0, 3)}${Date.now().toString().slice(-4)}`, 
      ...schema
    };

    setConfig(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [category]: [...(prev.components[category] || []), newItem]
      }
    }));
  };

  const removeComponent = (category, id) => {
    setConfig(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [category]: prev.components[category].filter(item => item.id !== id)
      }
    }));
  };

  const resetToDefault = () => {
    setConfig(DEFAULT_CONFIG);
  };

  return (
    <ConfigContext.Provider value={{
      config,
      updateGlobal,
      updateComponent,
      addComponent,
      removeComponent,
      resetToDefault
    }}>
      {children}
    </ConfigContext.Provider>
  );
};
