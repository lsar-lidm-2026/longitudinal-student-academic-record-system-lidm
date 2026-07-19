export default function MlLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="h-4 bg-gray-200 rounded w-96" />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-96 bg-gray-100 rounded-xl" />
    </div>
  );
}
