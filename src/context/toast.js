import { createContext, useContext } from "react";

// toast(message, kind = "ok" | "err") — see ToastProvider.
export const ToastContext = createContext(() => {});

export const useToast = () => useContext(ToastContext);
