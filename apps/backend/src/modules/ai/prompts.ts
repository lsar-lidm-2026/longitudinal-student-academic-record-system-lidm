interface StudentData {
  name: string;
  className: string;
  semester: number;
  academicYear: string;
  subjectScores: { subjectName: string; knowledgeScore: number; skillsScore: number }[];
  attendance: { sick: number; permission: number; absent: number } | null;
  achievements: { title: string; type: string }[];
}

export function buildStudentSummaryPrompt(data: StudentData): string {
  return `Anda adalah asisten administrasi pendidikan yang membantu guru SD.
Buat ringkasan perkembangan siswa berdasarkan data akademik berikut.
Ringkasan harus:
- Bahasa Indonesia yang baik dan benar
- Fokus pada kekuatan dan area pengembangan
- Objektif berdasarkan data
- Maksimal 3 paragraf

Data Siswa:
Nama: ${data.name}
Kelas: ${data.className}
Semester: ${data.semester === 1 ? "Ganjil" : "Genap"} - ${data.academicYear}

Nilai:
${data.subjectScores.map((s) => `- ${s.subjectName}: Pengetahuan ${s.knowledgeScore}, Keterampilan ${s.skillsScore}`).join("\n")}

Kehadiran:
${data.attendance ? `- Sakit: ${data.attendance.sick} hari\n- Izin: ${data.attendance.permission} hari\n- Alpha: ${data.attendance.absent} hari` : "Tidak ada data kehadiran"}

Prestasi:
${data.achievements.length > 0 ? data.achievements.map((a) => `- ${a.title} (${a.type})`).join("\n") : "Tidak ada prestasi"}`
;
}

export function buildDraftDescriptionPrompt(data: StudentData): string {
  return `Anda adalah asisten guru SD yang membantu menyusun deskripsi rapor.
Buat draft deskripsi rapor untuk setiap mata pelajaran.
Deskripsi harus:
- Bahasa Indonesia yang baik
- Mencakup aspek pengetahuan dan keterampilan
- Memberikan gambaran objektif
- Disertai saran pengembangan yang konstruktif
- Tidak menggunakan kata-kata negatif

Data Siswa:
Nama: ${data.name}
Kelas: ${data.className}
Semester: ${data.semester === 1 ? "Ganjil" : "Genap"}

Nilai:
${data.subjectScores.map((s) => `- ${s.subjectName}: Pengetahuan ${s.knowledgeScore}, Keterampilan ${s.skillsScore}`).join("\n")}

Format Output:
**{Mata Pelajaran}**: [deskripsi narasi 2-3 kalimat]`;
}

export function buildTransitionSummaryPrompt(allSemesters: StudentData[]): string {
  const semesterData = allSemesters.map(
    (s) => `Semester ${s.semester === 1 ? "Ganjil" : "Genap"} ${s.academicYear}:
Nilai: ${s.subjectScores.map((sc) => `${sc.subjectName}=${sc.knowledgeScore}/${sc.skillsScore}`).join(", ")}
Kehadiran: ${s.attendance ? `S:${s.attendance.sick} I:${s.attendance.permission} A:${s.attendance.absent}` : "N/A"}
Prestasi: ${s.achievements.map((a) => a.title).join(", ") || "Tidak ada"}`
  ).join("\n\n");

  return `Anda adalah asisten yang membantu serah terima wali kelas di SD.
Buat ringkasan transisi untuk wali kelas baru tentang siswa ini.
Ringkasan harus:
- Bahasa Indonesia yang baik
- Fokus pada informasi yang berguna untuk guru baru
- Mencakup kekuatan akademik, area pengembangan, dan catatan penting
- Maksimal 4 paragraf

Nama: ${allSemesters[0]?.name || "-"}
Riwayat Semester:
${semesterData}

Format Output:
1. Profil Singkat: [1 paragraf]
2. Kekuatan Akademik: [1-2 kalimat]
3. Area Pengembangan: [1-2 kalimat]
4. Catatan Penting untuk Wali Kelas Baru: [1-2 kalimat]`;
}
