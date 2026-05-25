/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const applyAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
};

const getStoredSession = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("admin"));

    if (!stored?.id || !stored?.email || !stored?.role || !stored?.token) {
      localStorage.removeItem("admin");
      applyAuthToken(null);

      return null;
    }

    applyAuthToken(stored.token);

    return stored;
  } catch {
    localStorage.removeItem("admin");
    applyAuthToken(null);

    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(getStoredSession);

  const login = (data) => {
    setAdmin(data);
    localStorage.setItem("admin", JSON.stringify(data));
    applyAuthToken(data?.token);
  };

  const updateAdmin = (data) => {
    setAdmin((prev) => {
      const next = { ...prev, ...data };
      localStorage.setItem("admin", JSON.stringify(next));
      applyAuthToken(next?.token);

      return next;
    });
  };

  const logout = () => {
    setAdmin(null);
    localStorage.removeItem("admin");
    applyAuthToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        login,
        updateAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


