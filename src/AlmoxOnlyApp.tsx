import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AlmoxarifadoAcesso from './pages/AlmoxarifadoAcesso';
import { Toaster } from './components/ui/toaster';

// Versão para almoxarifado simplificado
const AlmoxOnlyApp: React.FC = () => (
  <>
    <Routes>
      <Route path="*" element={<AlmoxarifadoAcesso />} />
    </Routes>
    <Toaster />
  </>
);

export default AlmoxOnlyApp;
