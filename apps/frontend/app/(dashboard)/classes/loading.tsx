export default function ClassesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="h-4 bg-gray-200 rounded w-72" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-8 bg-gray-100 rounded-xl w-full" />
      <div className="h-80 bg-gray-100 rounded-xl" />
    </div>
  );
}
