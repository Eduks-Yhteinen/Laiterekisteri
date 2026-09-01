import { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type UserRole = 'Global Admin' | 'Admin' | 'User';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser && currentUser.email) {
        const email = currentUser.email.toLowerCase();
        
        // 1. Check Global Admin (Hardcoded)
        if (email === 'pasi.hulkkonen@edu.lappeenranta.fi' || email === 'joni.hikipaa@edu.lappeenranta.fi') {
          setRole('Global Admin');
        } 
        // 2. Check Admin (Hardcoded)
        else if (email === 'asentaja@lappee.fi') {
          setRole('Admin');
        } 
        // 3. Fallback to DB check for admin role
        else {
          try {
            const roleDoc = await getDoc(doc(db, 'user_roles', currentUser.uid));
            if (roleDoc.exists() && roleDoc.data().role === 'admin') {
              setRole('Admin');
            } else {
              setRole('User');
            }
          } catch (err) {
            console.error("Failed to fetch user role:", err);
            setRole('User');
          }
        }
      } else {
        setRole(null);
      }
      
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
