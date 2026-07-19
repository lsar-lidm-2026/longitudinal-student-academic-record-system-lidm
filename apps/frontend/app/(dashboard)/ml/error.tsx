"use client";
export default function MlError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <p className="text-red-500 mb-4">Terjadi kesalahan</p>
      <button onClick={reset} className="text-sm text-blue-600 hover:underline">Coba Lagi</button>
    </div>
  );
}
