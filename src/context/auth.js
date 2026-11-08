import { createContext, useContext } from "react";

// The signed-in staff member and what they're allowed to do (see AuthProvider).
export const AuthContext = createContext(null);

/** { user, ready, login, logout, refreshUser, can } */
export const useAuth = () => useContext(AuthContext);
