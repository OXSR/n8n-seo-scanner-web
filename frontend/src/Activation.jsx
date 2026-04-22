import React, { useState } from 'react';
import './Activation.css';

function Activation() {
  const [apiKey, setApiKey] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [status, setStatus] = useState({ loading: false, error: null, success: null });

  const handleActivate = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: null, success: null });

    try {
      const response = await fetch('http://localhost:3001/api/keys/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey, nodeId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al activar la clave');
      }

      setStatus({ loading: false, error: null, success: data.message });
      setApiKey('');
      setNodeId('');
    } catch (err) {
      setStatus({ loading: false, error: err.message, success: null });
    }
  };

  return (
    <div className="activation-container">
      <div className="activation-card">
        <h2>Activar API Key</h2>
        <p>Vincula tu API Key con tu nodo para comenzar a utilizar los servicios.</p>
        
        <form onSubmit={handleActivate} className="activation-form">
          <div className="form-group">
            <label htmlFor="apiKey">API Key</label>
            <input
              type="text"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk_..."
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="nodeId">ID del Nodo (Opcional)</label>
            <input
              type="text"
              id="nodeId"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              placeholder="n8n-node-xyz"
            />
          </div>

          <button type="submit" disabled={status.loading} className="btn-activate">
            {status.loading ? 'Activando...' : 'Activar Clave'}
          </button>
        </form>

        {status.error && <div className="alert error">{status.error}</div>}
        {status.success && <div className="alert success">{status.success}</div>}
      </div>
    </div>
  );
}

export default Activation;