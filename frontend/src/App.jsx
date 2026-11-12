import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Whiteboard from './components/Whiteboard';
import './App.css';

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('gfg_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gfg_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/board/new" element={<Whiteboard theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/board/:id" element={<Whiteboard theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/view/:id" element={<Whiteboard theme={theme} onToggleTheme={toggleTheme} readOnly={true} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
