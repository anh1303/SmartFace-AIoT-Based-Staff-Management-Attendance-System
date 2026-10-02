import React from 'react';
import { AppProviders } from './providers';
import { AppRoutes } from './routes';

/**
 * Root Application Component
 * Clean architecture with aggregated AppProviders and modular AppRoutes.
 */
export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}