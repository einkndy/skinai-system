const statusStyles = {
  online: "bg-emerald-100 text-emerald-700",
  offline: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  connecting: "bg-blue-100 text-blue-700",
  reconnecting: "bg-amber-100 text-amber-700",
  "camera ready": "bg-cyan-100 text-cyan-700",
};

const statusLabels = {
  online: "Online",
  offline: "Offline",
  warning: "Warning",
  processing: "Processing",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  "camera ready": "Camera Ready",
};

export default function StatusBadge({ status = "online" }) {
  const normalizedStatus = String(status || "online").toLowerCase();
  const badgeClass = statusStyles[normalizedStatus] || statusStyles.online;

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass}`}
    >
      {statusLabels[normalizedStatus] || normalizedStatus}
    </span>
  );
}
