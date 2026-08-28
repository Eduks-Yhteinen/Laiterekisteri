import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import './Login.css';

export function Login() {
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        hd: 'edu.lappeenranta.fi' // Hint the domain
      });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <h1>EDU Laiterekisteri</h1>
        <p>Kirjaudu sisään @edu.lappeenranta.fi -tunnuksella</p>
        <button className="btn-primary login-btn" onClick={handleLogin}>
          Kirjaudu Googlella
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
