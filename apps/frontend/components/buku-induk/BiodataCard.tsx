"use client";

interface Biodata {
  nis: string;
  nisn: string;
  name: string;
  gender: string;
  className: string;
}

interface BiodataCardProps {
  biodata: Biodata;
}

export function BiodataCard({ biodata }: BiodataCardProps) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Biodata</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="p-3 bg-gray-50/50 rounded-lg">
          <span className="text-muted-foreground">Nama: </span>
          <span className="font-medium text-gray-900">{biodata.name}</span>
        </div>
        <div className="p-3 bg-gray-50/50 rounded-lg">
          <span className="text-muted-foreground">NIS: </span>
          <span className="font-medium text-gray-900">{biodata.nis}</span>
        </div>
        <div className="p-3 bg-gray-50/50 rounded-lg">
          <span className="text-muted-foreground">NISN: </span>
          <span className="font-medium text-gray-900">{biodata.nisn}</span>
        </div>
        <div className="p-3 bg-gray-50/50 rounded-lg">
          <span className="text-muted-foreground">Kelas: </span>
          <span className="font-medium text-gray-900">{biodata.className}</span>
        </div>
      </div>
    </div>
  );
}
