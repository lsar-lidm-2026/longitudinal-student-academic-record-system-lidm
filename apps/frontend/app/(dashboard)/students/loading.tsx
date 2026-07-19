export default function StudentsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="h-4 bg-gray-200 rounded w-96" />
      <div className="grid grid-cols-4 gap-4 mt-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  );
}
