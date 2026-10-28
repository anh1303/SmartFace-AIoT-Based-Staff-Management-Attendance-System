import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function PublicThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  return <button type="button" className="sf-button sf-public-theme" onClick={toggleTheme} aria-label={label} title={label}>
    {isDark ? <Sun size={18} /> : <Moon size={18} />}
    <span>{isDark ? 'Sáng' : 'Tối'}</span>
  </button>;
}
