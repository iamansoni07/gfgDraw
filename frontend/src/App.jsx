import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Whiteboard from './components/Whiteboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/board/new" element={<Whiteboard />} />
        <Route path="/board/:id" element={<Whiteboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
