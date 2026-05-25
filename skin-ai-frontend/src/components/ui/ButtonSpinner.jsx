export default function ButtonSpinner({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`button-spinner inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
