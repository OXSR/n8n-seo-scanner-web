import React, { useState, useEffect } from 'react';
import './Dashboard.css';

function Dashboard({ token }) {
  const [keyData, setKeyData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newApiKey, setNewApiKey] = useState(null);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const keyRes = await fetch('https://n8n-seo-scanner-web.onrender.com/api/keys/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const keyJson = await keyRes.json();
      setKeyData(keyJson.key);

      const histRes = await fetch('https://n8n-seo-scanner-web.onrender.com/api/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const histJson = await histRes.json();
      setHistory(histJson.history || []);
    } catch (e) {
      console.error(e);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const handleGenerateKey = async () => {
    try {
      const res = await fetch('https://n8n-seo-scanner-web.onrender.com/api/keys/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      setKeyData(data.keyData);
      setNewApiKey(data.apiKey);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleKey = async () => {
    try {
      const res = await fetch('https://n8n-seo-scanner-web.onrender.com/api/keys/toggle', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      setKeyData({ ...keyData, active: data.key.active });
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Cargando tu área personal...</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Panel de Control API</h2>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Estado de la Clave</h3>
          {!keyData ? (
            <div>
              <p className="status-text none">No tienes clave generada</p>
              <button onClick={handleGenerateKey} className="btn-action">Generar Nueva Clave</button>
            </div>
          ) : (
            <div>
              <p className={`status-text ${keyData.active ? 'active' : 'inactive'}`}>
                {keyData.active ? 'ACTIVA' : 'INACTIVA'}
              </p>
              <button onClick={handleToggleKey} className={`btn-action ${keyData.active ? 'btn-danger' : 'btn-success'}`}>
                {keyData.active ? 'Desactivar Clave' : 'Activar Clave (Local)'}
              </button>
              <p className="note">Nota: Para vincularla con un nodo remoto usa la pestaña "Activar Clave".</p>
            </div>
          )}
        </div>

        <div className="stat-card">
          <h3>Estadísticas de Uso</h3>
          {keyData ? (
            <ul className="stats-list">
              <li><strong>Total de usos:</strong> {keyData.total_uses || 0}</li>
              <li><strong>Último uso:</strong> {keyData.last_used ? new Date(keyData.last_used).toLocaleString() : 'Nunca'}</li>
              <li><strong>Nodo vinculado:</strong> {keyData.node_id || 'Ninguno'}</li>
              <li><strong>Creada el:</strong> {new Date(keyData.created_at).toLocaleDateString()}</li>
            </ul>
          ) : (
            <p>Genera una clave para ver estadísticas.</p>
          )}
        </div>
      </div>

      {newApiKey && (
        <div className="new-key-alert">
          <h3>¡Clave Generada Exitosamente!</h3>
          <p>Copia esta clave ahora. <strong>No se volverá a mostrar.</strong></p>
          <div className="key-box">{newApiKey}</div>
          <button onClick={() => setNewApiKey(null)} className="btn-action">Ya la he copiado</button>
        </div>
      )}

      <div className="history-section">
        <h3>Historial de Escaneos</h3>
        {history.length === 0 ? (
          <p className="no-data">No hay escaneos registrados todavía.</p>
        ) : (
          <div className="table-responsive">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>URL Objetivo</th>
                  <th>Estado</th>
                  <th>Puntuación SEO</th>
                </tr>
              </thead>
              <tbody>
                {history.map((scan) => (
                  <tr key={scan.id}>
                    <td>{new Date(scan.created_at).toLocaleString()}</td>
                    <td>{scan.target_url}</td>
                    <td><span className={`badge ${scan.status.toLowerCase()}`}>{scan.status}</span></td>
                    <td><strong>{scan.score}/100</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;