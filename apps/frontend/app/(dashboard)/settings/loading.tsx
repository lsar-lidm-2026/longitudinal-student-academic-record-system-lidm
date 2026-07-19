export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-40" />
      <div className="h-4 bg-gray-200 rounded w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
        </div>
        <div className="lg:col-span-3 space-y-4">
          <div className="h-48 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
