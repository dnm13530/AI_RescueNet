import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import SubmitRequestPage from './pages/SubmitRequestPage';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function App() {
  return (
    <Router>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <Navbar />
        <main style={{ marginTop: '32px' }} className="animate-fade-in">
          <Routes>
            <Route path="/" element={<SubmitRequestPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
