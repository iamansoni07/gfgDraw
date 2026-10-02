import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Whiteboard from './components/Whiteboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:id?" element={<Whiteboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
