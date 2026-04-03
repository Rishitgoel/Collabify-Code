export const evaluateRules = (specs, selection, config) => {
  const warnings = [];
  const suggestions = [];
  const dynamicProps = {
    motorHpMultiplier: 1.0,
    fanCostMultiplier: 1.0,
    requiresEliminator: false
  };

  // Convert specs parsing
  const app = specs.app;
  const pressure = parseFloat(specs.pressure) || 0;

  // 1. Mandatory Rules
  if (app === 'Hospital') {
    const selectedFilter = config.components.filters.find(f => f.id === selection.filters);
    if (!selectedFilter || selectedFilter.stage !== 'HEPA') {
      warnings.push("Hospital/Clinical applications strictly require HEPA filtration.");
    }
  }

  // 2. Dependency Rules
  if (selection.pads && !selection.eliminators) {
    suggestions.push("Evaporative cooling pads selected. It is highly recommended to add a Moisture Eliminator.");
    dynamicProps.requiresEliminator = true;
  }

  // 3. Validation Rules
  if (pressure > 2.5) {
    const selectedMotor = config.components.motors.find(m => m.id === selection.motors);
    if (selectedMotor && selectedMotor.hp < 5) {
       warnings.push("High static pressure (>2.5 in. wg) detected. Motor HP may be insufficient.");
    }
  }

  // 4. Cost Impact / Scaling Rules
  if (selection.filters) {
    const selectedFilter = config.components.filters.find(f => f.id === selection.filters);
    if (selectedFilter && selectedFilter.stage === 'HEPA') {
      // HEPA filters add significant pressure drop, meaning fans have to work harder, increasing fan cost / size
      suggestions.push("HEPA Filtration active: Assuming +20% scaling factor on Fan structural cost due to operating pressure.");
      dynamicProps.fanCostMultiplier = 1.2;
    }
  }

  return { warnings, suggestions, dynamicProps };
};

// Derived cost formula for each component type
export const calculateCost = (category, item, specs, dynamicProps) => {
  if (!item) return 0;
  
  const cfm = parseFloat(specs.airflow) || 0;
  
  // Base sizing assumptions
  const estimatedAreaSqFt = cfm / 500; // rough sizing: 500 FPM face velocity assumption for coils/filters/pads
  const casingLengthMeters = (cfm / 2000) * 1.5; // rough length scaling

  switch (category) {
    case 'internal':
      return item.price; 
    case 'profile':
      return item.price + (casingLengthMeters * (item.lengthRate || 0));
    case 'hardware':
      return item.price;
    case 'fans':
      return (item.price + (cfm * (item.mult || 0))) * dynamicProps.fanCostMultiplier;
    case 'motors':
      return item.price * (item.efficiency || 1.0) * dynamicProps.motorHpMultiplier;
    case 'filters':
      return item.price; // Could scale by area if needed
    case 'pads':
      return item.price + (estimatedAreaSqFt * (item.areaRate || 0));
    case 'eliminators':
      return item.price * (item.rowMult || 1.0);
    case 'dampers':
      return item.price + (item.actuatorPrice || 0);
    case 'coils':
      return item.price + ((item.rows || 1) * 50) + (estimatedAreaSqFt * (item.areaFactor || 1) * 20);
    case 'electricity':
      // Return 0 for capital cost, this is an operational cost. We'll handle it separately if needed.
      return 0;
    case 'pufPanels':
      // Casing surface area roughly scales with sqrt of cfm
      const surfaceArea = Math.pow(cfm, 0.6) * 2; 
      return item.price + (surfaceArea * (item.areaRate || 0));
    default:
      return item.price || 0;
  }
};
