import { useState } from 'react';
import { submitRequest } from '../services/api';
import { Send, AlertTriangle, Mic, MicOff } from 'lucide-react';

export default function SubmitRequestPage() {
  const [formData, setFormData] = useState({
    type: 'food',
    peopleCount: '',
    urgency: 'medium',
    location: '',
    notes: '',
    imageBase64: ''
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const toggleListening = () => {
    if (isListening) {
      if (window.recognitionInstance) {
        window.recognitionInstance.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support the Web Speech API. Try Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        setFormData(prev => ({ ...prev, notes: prev.notes + (prev.notes ? ' ' : '') + finalTranscript }));
      }
    };

    recognition.onerror = (e) => {
       console.error("Speech Recognition Error", e);
       setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    window.recognitionInstance = recognition;
    recognition.start();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await submitRequest(formData);
      setStatus({ type: 'success', message: 'Request submitted successfully. Aid prioritized by AI.' });
      setFormData({ type: 'food', peopleCount: '', urgency: 'medium', location: '', notes: '', imageBase64: '' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to submit request. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, imageBase64: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="glass-panel">
        <h2 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle color="var(--warning)" /> Request Emergency Aid
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Our AI analyzes and prioritizes resources where they are needed most.
        </p>

        {status && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            backgroundColor: status.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${status.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            color: status.type === 'success' ? '#4ade80' : '#f87171'
          }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Resource Type</label>
            <select name="type" value={formData.type} onChange={handleChange} required>
              <option value="food">🍞 Food Supplies</option>
              <option value="medical">🏥 Medical Assistance</option>
              <option value="shelter">🏠 Shelter</option>
              <option value="water">💧 Clean Water</option>
              <option value="rescue">🚁 Search & Rescue</option>
              <option value="transport">🚐 Emergency Transport</option>
              <option value="clothing">👕 Clothing & Blankets</option>
              <option value="sanitation">🧼 Sanitation & Hygiene</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Number of People</label>
              <input type="number" name="peopleCount" min="1" value={formData.peopleCount} onChange={handleChange} placeholder="e.g. 50" required />
            </div>
            <div>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Urgency Level</label>
              <select name="urgency" value={formData.urgency} onChange={handleChange} required>
                <option value="low">Low (Stable)</option>
                <option value="medium">Medium (Needs attention)</option>
                <option value="high">High (Critical/Life-threatening)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Location Details</label>
            <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="Street, City, or Coordinates" required />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Additional Context</label>
              <button 
                type="button" 
                onClick={toggleListening} 
                style={{ 
                  background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)', 
                  border: `1px solid ${isListening ? 'var(--danger)' : 'var(--accent-color)'}`,
                  color: isListening ? '#f87171' : '#818cf8',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />} 
                {isListening ? "Listening..." : "Dictate Emergency"}
              </button>
            </div>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows="4" placeholder="Describe specific needs or click 'Dictate' to speak..."></textarea>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Visual Damage Upload (Optional - JPEG/PNG)</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ width: '100%', padding: '10px 0', color: 'var(--text-secondary)' }} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Processing via AI...' : <><Send size={18} /> Submit Aid Request</>}
          </button>
        </form>
      </div>
    </div>
  );
}
