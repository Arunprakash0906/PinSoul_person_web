import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Comp/Home';
import PinLocation from './Comp/PinLocation';
import ViewAllLocation from './Comp/ViewAllLocation';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/pinLocation" element={<PinLocation />} />
        <Route path="/pin-location" element={<PinLocation />} />
        <Route path="/ViewAllLocation" element={<ViewAllLocation />} />
        <Route path="/view-all-location" element={<ViewAllLocation />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
