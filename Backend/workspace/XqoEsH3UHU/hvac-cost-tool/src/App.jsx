import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AppConfigurator from './pages/AppConfigurator';
import Settings from './pages/Settings';
import { ConfigProvider } from './context/ConfigContext';

function App() {
  return (
    <ConfigProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app" element={<AppConfigurator />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
