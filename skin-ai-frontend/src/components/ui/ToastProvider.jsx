import { Toaster } from "sonner";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={2600}
      gap={10}
      toastOptions={{
        style: {
          borderRadius: "16px",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
          fontSize: "14px",
          fontWeight: 600,
        },
      }}
    />
  );
}
