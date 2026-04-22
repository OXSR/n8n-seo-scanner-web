import React, { useState, useEffect } from 'react';
import './App.css';
import Activation from './Activation';
import Auth from './Auth';
import Dashboard from './Dashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [currentView, setCurrentView] = useState('home');

  const handleLogin = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setCurrentView('home');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setCurrentView('home');
  };

  return (
    <div className="App">
      <nav className="navbar">
        <div className="nav-brand" onClick={() => setCurrentView('home')} style={{cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem'}}>n8n Monitor SEO</div>
        <div className="nav-links">
          <button onClick={() => setCurrentView('home')} className={currentView === 'home' ? 'active' : ''}>
            {token ? 'Mi Área Personal' : 'Inicio'}
          </button>
          <button onClick={() => setCurrentView('activate')} className={currentView === 'activate' ? 'active' : ''}>Activar Clave</button>
          
          {token ? (
            <button onClick={handleLogout} className="btn-logout">Cerrar Sesión ({user?.email})</button>
          ) : (
            <button onClick={() => setCurrentView('auth')} className={currentView === 'auth' ? 'active' : ''}>Entrar</button>
          )}
        </div>
      </nav>

      <main className="main-content">
        {currentView === 'home' && (
          token ? <Dashboard token={token} /> : (
            <div className="welcome-screen">
              <h1>Bienvenido a n8n Monitor SEO</h1>
              <p>Inicia sesión o regístrate para gestionar tus API Keys y ver tu historial de escaneos.</p>
              <button onClick={() => setCurrentView('auth')} style={{padding: '10px 20px', fontSize: '1rem', marginTop: '20px', cursor: 'pointer'}}>Ir a Login / Registro</button>
            </div>
          )
        )}

        {currentView === 'auth' && !token && <Auth onLogin={handleLogin} />}
        {currentView === 'activate' && <Activation />}
      </main>
    </div>
  );
}

export default App;
