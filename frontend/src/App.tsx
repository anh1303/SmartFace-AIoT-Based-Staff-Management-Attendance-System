import { AppProviders } from './providers';
import { AppRoutes } from './routes';
import { ToastContainer } from './components/common/Toast';

/**
 * Root Application Component
 * Clean architecture with aggregated AppProviders and modular AppRoutes.
 */
export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
      <ToastContainer />
    </AppProviders>
  );
}
