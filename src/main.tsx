import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// * ErrorBoundary ottaa kiinni koko sovelluksen laajuiset JavaScript-virheet.
// Sen sijaan, että näyttö jäisi täysin valkoiseksi kaatumisen yhteydessä, 
// tämä luokka piirtää ruudulle punaisen virheilmoituksen.
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', backgroundColor: '#fff', height: '100vh' }}>
          <h1>Jokin meni pieleen (Error)</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', fontSize: '0.8rem' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// * Reactin juurikomponentti piirretään DOMiin (index.html:n root-elementtiin)
createRoot(document.getElementById('root')!).render(
  // ! StrictMode ajaa komponentit kehitysympäristössä KAHDESTI!
  // Tämä auttaa löytämään mahdollisia virheitä (kuten muistivuotoja useEffecteissä).
  // Se ei koske tuotantoversiota.
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
