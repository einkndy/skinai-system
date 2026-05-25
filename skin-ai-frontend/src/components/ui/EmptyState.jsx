export default function EmptyState({
  title = "Data belum tersedia",
  subtitle = "Belum ada data yang dapat ditampilkan.",
  icon = null,
}) {
  return (
    <div className="rounded-3xl bg-white p-6 sm:p-8 text-center shadow-sm border border-slate-100">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-600">
        {icon || "i"}
      </div>

      <h2 className="mt-5 text-xl font-bold text-slate-800">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}
