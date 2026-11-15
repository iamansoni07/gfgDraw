import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Whiteboard from './components/Whiteboard';
import WhiteboardApp from './components/WhiteboardApp';
import './App.css';

function RootRoute({ theme, onToggleTheme }) {
  const [searchParams] = useSearchParams();
  // If user opens a shared multiplayer room link with ?room=, directly load WhiteboardApp
  if (searchParams.has('room')) {
    return <WhiteboardApp theme={theme} onToggleTheme={onToggleTheme} />;
  }
  return <Dashboard theme={theme} onToggleTheme={onToggleTheme} />;
}

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
        <Route path="/" element={<RootRoute theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/canvas" element={<WhiteboardApp theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/canvas/:roomId" element={<WhiteboardApp theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/infinite" element={<WhiteboardApp theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/board/new" element={<Whiteboard theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/board/:id" element={<Whiteboard theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/view/:id" element={<Whiteboard theme={theme} onToggleTheme={toggleTheme} readOnly={true} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
