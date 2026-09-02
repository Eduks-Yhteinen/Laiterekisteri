import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface UserAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface IntuneUser {
  displayName: string;
  email: string;
}

export interface UserAutocompleteRef {
  search: () => void;
}

export const UserAutocomplete = forwardRef<UserAutocompleteRef, UserAutocompleteProps>(
  ({ value, onChange, disabled }, ref) => {
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults] = useState<IntuneUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // * How does this work? (Syncing External State)
    // If the input value doesn't match the parent's current selection (`value` prop), we update our local state.
    // This prevents state updates from triggering an infinite loop inside useEffect if they are already in sync.
    // This is useful when the parent component resets the value (e.g., after a successful form submission).
    if (inputValue !== value) {
        setInputValue(value);
    }
  }, [value, inputValue]);

  const executeSearch = useCallback(async (force: boolean = false) => {
    const term = inputValue.trim();
    if (term.length < 3) {
      setResults([]);
      return;
    }
    
    if (!force && !isTyping) return;

    setIsLoading(true);
    try {
      // * How does this work? (Firebase Callable Functions)
      // We call the `searchIntuneUsers` Firebase Function defined in `intune.ts`.
      // `httpsCallable` creates a reference to the function, which we can then call with arguments.
      // The function handles authentication with MS Graph and returns the search results securely.
      const functions = getFunctions();
      const searchIntuneUsers = httpsCallable(functions, 'searchIntuneUsers');
      const res = await searchIntuneUsers({ query: term }) as { data: { users: IntuneUser[] } };
      setResults(res.data.users || []);
      setIsOpen(true);
    } catch (err) {
      console.error("Failed to search Intune users:", err);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isTyping]);

  useImperativeHandle(ref, () => ({
    search: () => executeSearch(true)
  }));

  useEffect(() => {
    // * How does this work? (Debouncing Search)
    // To avoid spamming the backend API on every keystroke, we use a setTimeout.
    // If the user types another character before the 500ms timeout completes, 
    // the cleanup function `clearTimeout` cancels the previous timeout, 
    // and a new one starts. This ensures we only search after the user stops typing.
    const timeoutId = setTimeout(() => executeSearch(false), 500);
    return () => clearTimeout(timeoutId);
  }, [inputValue, value, isTyping, executeSearch]);

  const handleSelect = (user: IntuneUser) => {
    setIsTyping(false);
    setInputValue(user.email);
    onChange(user.email);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsTyping(true);
    setInputValue(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="email"
        value={inputValue}
        onChange={handleInputChange}
        disabled={disabled}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        placeholder="esim. matti.meikäläinen@edu.lappeenranta.fi"
        style={{ width: '100%' }}
      />
      {isLoading && (
        <div style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--color-text-muted)' }}>
          <span className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid', borderRadius: '50%', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></span>
        </div>
      )}
      
      {isOpen && results.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          boxShadow: 'var(--shadow-md)',
          listStyle: 'none',
          padding: '0',
          margin: '4px 0 0 0',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 10
        }}>
          {results.map((user, i) => (
            <li 
              key={i}
              onClick={() => handleSelect(user)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ fontWeight: 500, color: 'var(--color-text-main)' }}>{user.displayName}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{user.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
