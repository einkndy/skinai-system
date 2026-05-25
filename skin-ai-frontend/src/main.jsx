import { StrictMode, Fragment } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import ToastProvider from "./components/ui/ToastProvider";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Fragment>
      <AuthProvider>
        <App />
      </AuthProvider>
      <ToastProvider />
    </Fragment>
  </StrictMode>
);


