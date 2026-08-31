import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import './Login.css';

export function Login() {
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      // * Google Auth Provider mahdollistaa kirjautumisen Google-tilillä.
      const provider = new GoogleAuthProvider();
      
      // * Hint the domain: Tämä ohjaa Googlen kirjautumisikkunan ehdottamaan 
      // vain edu.lappeenranta.fi -tilejä.
      // ! HUOM: Tämä EI estä muiden tilien käyttöä lopullisesti (se on vain UI-vihje).
      // Varsinainen domain-rajoitus on tehtävä Firebasen Authentication -asetuksissa (Cloud Console)
      // tai firestore.rules -tiedostossa (esim. `request.auth.token.email.matches('.*@edu.lappeenranta.fi')`).
      provider.setCustomParameters({
        hd: 'edu.lappeenranta.fi'
      });
      
      // * Avataan ponnahdusikkuna (Popup) kirjautumista varten.
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
