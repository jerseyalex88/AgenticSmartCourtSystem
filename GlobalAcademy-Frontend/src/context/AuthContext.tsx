import React, { createContext, useContext, useState, useEffect } from 'react';

// Define the shape of our decrypted cryptographic passport claim data matrix
interface UserProfile {
  email: string;
  role: string;
  academyId: string;
  userName: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  saveSession: (token: string) => void;
  clearSession: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Lightweight JSON Web Token claim extraction helper bypasses external dependency overhead
function decodeJwtClaims(token: string): UserProfile {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const parsed = JSON.parse(jsonPayload);

    //console.log(`parsed value: "${JSON.stringify(parsed)}"`);

    // Modern .NET 10 token claims mapping parameters
    const email = parsed["http://xmlsoap.org"] || parsed.sub || "";
    const role = parsed["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || parsed.role || "Player";
    const academyId = parsed.AcademyId || parsed.academyId || "";
    const userName = parsed["http://xmlsoap.org"] || parsed.unique_name || "";

    // console.log("==================================================");
    // console.log(`[DECODING JWT] Extracted Role Claim Value: "${role}"`);
    // console.log("==================================================");

    return { email, role, academyId, userName };
  } catch (err) {
    console.error("Failed to parse cryptographic JWT token structure claims:", err);
    return { email: "", role: "Player", academyId: "", userName: "" };
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Synchronize authentication context on initial component mount cycles
  useEffect(() => {
    const cachedToken = localStorage.getItem('global_academy_jwt_token');
    if (cachedToken) {
      const claims = decodeJwtClaims(cachedToken);
      if (claims.email) {
        setUser(claims);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('global_academy_jwt_token');
      }
    }
    setLoading(false);
  }, []);

  const saveSession = (token: string) => {
    localStorage.setItem('global_academy_jwt_token', token);
    const claims = decodeJwtClaims(token);
    setUser(claims);
    setIsAuthenticated(true);
  };

  const clearSession = () => {
    localStorage.removeItem('global_academy_jwt_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, saveSession, clearSession, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be executed within an active AuthProvider wrapper boundary.');
  }
  return context;
};
