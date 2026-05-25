export default function SkeletonCard() {
  return (
    <div className="skeleton-surface rounded-3xl bg-white p-5 sm:p-6 shadow-sm border border-slate-100">
      <div className="skeleton-line h-5 w-2/5 rounded-full" />

      <div className="mt-6 space-y-3">
        <div className="skeleton-line h-4 w-full rounded-full" />
        <div className="skeleton-line h-4 w-5/6 rounded-full" />
        <div className="skeleton-line h-4 w-2/3 rounded-full" />
      </div>
    </div>
  );
}
