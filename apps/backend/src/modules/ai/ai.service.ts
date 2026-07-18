import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { generateChatCompletion } from "./llm.client";
import {
  buildStudentSummaryPrompt,
  buildDraftDescriptionPrompt,
  buildTransitionSummaryPrompt,
} from "./prompts";
import type { SummaryType } from "../../generated/prisma/client";

async function getStudentAcademicData(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: true },
  });
  if (!student) throw new NotFoundError("Student not found");

  const semesterRecords = await prisma.semesterRecord.findMany({
    where: { studentId },
    include: {
      academicYear: true,
      subjectScores: true,
      attendance: true,
      achievements: true,
    },
    orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
  });

  return { student, semesterRecords };
}

// ── Smart local fallbacks in case LLM is not configured/fails ─────────

function generateMockStudentSummary(data: any): string {
  const avg = Math.round(
    data.subjectScores.reduce((sum: number, s: any) => sum + s.knowledgeScore, 0) /
      data.subjectScores.length
  );
  const attendance = data.attendance;
  const abs = attendance ? attendance.sick + attendance.permission + attendance.absent : 0;

  let p1 = `${data.name} menunjukkan perkembangan akademik yang `;
  if (avg >= 85) {
    p1 += "sangat baik sepanjang semester ini. Ia aktif berpartisipasi di kelas dan menguasai hampir seluruh materi pelajaran dengan sangat memuaskan.";
  } else if (avg >= 75) {
    p1 += "cukup baik dan stabil. Sebagian besar standar kompetensi minimal telah tercapai dengan baik, meskipun masih ada ruang untuk peningkatan.";
  } else {
    p1 += "memerlukan perhatian dan bimbingan tambahan. Beberapa nilai mata pelajaran masih berada di bawah KKM, sehingga diperlukan perhatian ekstra di semester berikutnya.";
  }

  let p2 = ` Rata-rata nilai pengetahuan semester ini adalah ${avg}.`;
  if (data.achievements && data.achievements.length > 0) {
    p2 += ` Selain itu, siswa juga menorehkan prestasi dalam bidang "${data.achievements[0].title}" (${data.achievements[0].type}).`;
  }

  let p3 = "";
  if (abs > 5) {
    p3 = ` Catatan khusus: Kehadiran siswa perlu diperbaiki karena tercatat absen sebanyak ${abs} hari, yang sedikit mempengaruhi konsistensi belajarnya.`;
  } else {
    p3 = " Kedisiplinan dan kehadiran siswa sangat baik, dukung terus motivasi belajarnya di rumah.";
  }

  return p1 + p2 + p3 + "\n\n*(Catatan: Narasi dihasilkan oleh asisten analisis lokal LSAR)*";
}

function generateMockDraftDescription(data: any): string {
  const intro = `Rekomendasi kompetensi hasil belajar untuk ${data.name} (Semester ${data.semester}, TA ${data.academicYear}):\n\n`;
  const items = data.subjectScores.map((s: any) => {
    let desc = "";
    if (s.knowledgeScore >= 88) {
      desc = `Sangat menonjol dalam menguasai seluruh materi dan kompetensi dasar ${s.subjectName}.`;
    } else if (s.knowledgeScore >= 75) {
      desc = `Menunjukkan pemahaman yang baik dan mampu menyelesaikan tugas-tugas ${s.subjectName} dengan teratur.`;
    } else {
      desc = `Perlu bimbingan intensif dan latihan berkala untuk memahami materi dasar ${s.subjectName}.`;
    }
    return `- **${s.subjectName}**: ${desc}`;
  }).join("\n");
  
  return intro + items + "\n\n*(Catatan: Rekomendasi kompetensi dihasilkan oleh asisten analisis lokal LSAR)*";
}

function generateMockTransitionSummary(allData: any[]): string {
  if (allData.length === 0) return "Tidak ada data riwayat akademik untuk evaluasi serah terima.";
  const name = allData[0].name;
  const lastSem = allData[allData.length - 1];
  const avg = Math.round(
    lastSem.subjectScores.reduce((sum: number, s: any) => sum + s.knowledgeScore, 0) /
      lastSem.subjectScores.length
  );

  return `Catatan Serah Terima (Wali Kelas) untuk ${name}:\n\n` +
    `1. **Perkembangan Umum**: Siswa menyelesaikan jenjang kelas dengan rata-rata akhir ${avg}.\n` +
    `2. **Kekuatan Akademik**: Menunjukkan bakat dan minat yang stabil pada beberapa mata pelajaran utama.\n` +
    `3. **Rekomendasi untuk Wali Kelas Berikutnya**: Pertahankan motivasi belajar siswa dan berikan pendampingan berkelanjutan agar konsistensi belajarnya tetap terjaga.\n\n` +
    `*(Catatan: Rangkuman transisi dihasilkan oleh asisten analisis lokal LSAR)*`;
}

// ── Controller Methods ───────────────────────────────────────────────

export async function generateStudentSummary(studentId: string) {
  const { student, semesterRecords } = await getStudentAcademicData(studentId);
  const latest = semesterRecords[semesterRecords.length - 1];
  if (!latest) throw new NotFoundError("No semester records found");

  const data = {
    name: student.name,
    className: student.class.name,
    semester: latest.semester,
    academicYear: latest.academicYear.year,
    subjectScores: latest.subjectScores.map((s) => ({
      subjectName: s.subjectName,
      knowledgeScore: s.knowledgeScore,
      skillsScore: s.skillsScore,
    })),
    attendance: latest.attendance
      ? { sick: latest.attendance.sick, permission: latest.attendance.permission, absent: latest.attendance.absent }
      : null,
    achievements: latest.achievements.map((a) => ({ title: a.title, type: a.type })),
  };

  const prompt = buildStudentSummaryPrompt(data);
  let content: string;
  try {
    content = await generateChatCompletion([
      { role: "system", content: "Anda adalah asisten administrasi pendidikan SD." },
      { role: "user", content: prompt },
    ]);
  } catch (err) {
    console.warn(`[AI] LLM Call failed for ${student.name}, using local fallback:`, err);
    content = generateMockStudentSummary(data);
  }

  // Atomic version increment — prevents race conditions
  return prisma.$transaction(async (tx) => {
    const max = await tx.aiSummary.aggregate({
      where: { semesterRecordId: latest.id, summaryType: "STUDENT_SUMMARY" },
      _max: { version: true },
    });
    const nextVersion = (max._max.version || 0) + 1;

    return tx.aiSummary.create({
      data: {
        semesterRecordId: latest.id,
        summaryType: "STUDENT_SUMMARY",
        content,
        version: nextVersion,
        isFinal: false,
      },
    });
  });
}

export async function generateDraftDescription(studentId: string) {
  const { student, semesterRecords } = await getStudentAcademicData(studentId);
  const latest = semesterRecords[semesterRecords.length - 1];
  if (!latest) throw new NotFoundError("No semester records found");

  const data = {
    name: student.name,
    className: student.class.name,
    semester: latest.semester,
    academicYear: latest.academicYear.year,
    subjectScores: latest.subjectScores.map((s) => ({
      subjectName: s.subjectName,
      knowledgeScore: s.knowledgeScore,
      skillsScore: s.skillsScore,
    })),
    attendance: latest.attendance
      ? { sick: latest.attendance.sick, permission: latest.attendance.permission, absent: latest.attendance.absent }
      : null,
    achievements: latest.achievements.map((a) => ({ title: a.title, type: a.type })),
  };

  const prompt = buildDraftDescriptionPrompt(data);
  let content: string;
  try {
    content = await generateChatCompletion([
      { role: "system", content: "Anda adalah asisten guru SD." },
      { role: "user", content: prompt },
    ]);
  } catch (err) {
    console.warn(`[AI] LLM Call failed for ${student.name}, using local fallback:`, err);
    content = generateMockDraftDescription(data);
  }

  // Atomic version increment
  return prisma.$transaction(async (tx) => {
    const max = await tx.aiSummary.aggregate({
      where: { semesterRecordId: latest.id, summaryType: "DRAFT_DESCRIPTION" },
      _max: { version: true },
    });
    const nextVersion = (max._max.version || 0) + 1;

    return tx.aiSummary.create({
      data: {
        semesterRecordId: latest.id,
        summaryType: "DRAFT_DESCRIPTION",
        content,
        version: nextVersion,
        isFinal: false,
      },
    });
  });
}

/**
 * Process one student's transition summary (used for concurrent batching).
 */
async function generateSingleTransitionSummary(studentId: string) {
  const { student: s, semesterRecords } = await getStudentAcademicData(studentId);
  if (semesterRecords.length === 0) return null;

  const allData = semesterRecords.map((r) => ({
    name: s.name,
    className: "",
    semester: r.semester,
    academicYear: r.academicYear.year,
    subjectScores: r.subjectScores.map((sc) => ({
      subjectName: sc.subjectName,
      knowledgeScore: sc.knowledgeScore,
      skillsScore: sc.skillsScore,
    })),
    attendance: r.attendance
      ? { sick: r.attendance.sick, permission: r.attendance.permission, absent: r.attendance.absent }
      : null,
    achievements: r.achievements.map((a) => ({ title: a.title, type: a.type })),
  }));

  const prompt = buildTransitionSummaryPrompt(allData);
  let content: string;
  try {
    content = await generateChatCompletion([
      { role: "system", content: "Anda adalah asisten serah terima wali kelas SD." },
      { role: "user", content: prompt },
    ]);
  } catch (err) {
    console.warn(`[AI] LLM Call failed for ${s.name}, using local fallback:`, err);
    content = generateMockTransitionSummary(allData);
  }

  const latestRecord = semesterRecords[semesterRecords.length - 1];

  // Atomic version increment
  return prisma.$transaction(async (tx) => {
    const max = await tx.aiSummary.aggregate({
      where: { semesterRecordId: latestRecord.id, summaryType: "TRANSITION_SUMMARY" },
      _max: { version: true },
    });
    const nextVersion = (max._max.version || 0) + 1;

    return tx.aiSummary.create({
      data: {
        semesterRecordId: latestRecord.id,
        summaryType: "TRANSITION_SUMMARY",
        content,
        version: nextVersion,
        isFinal: false,
      },
    });
  });
}

/**
 * Generate transition summaries for ALL students in a class.
 * Uses concurrent batching with concurrency limit to avoid overwhelming the LLM API.
 */
export async function generateTransitionSummary(classId: string, concurrency = 3) {
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true },
  });

  const results: Awaited<ReturnType<typeof generateSingleTransitionSummary>>[] = [];

  // Process in concurrent batches
  for (let i = 0; i < students.length; i += concurrency) {
    const batch = students.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((s) => generateSingleTransitionSummary(s.id))
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value !== null) {
        results.push(r.value);
      } else if (r.status === "rejected") {
        console.warn(`[AI] Transition summary failed for a student: ${r.reason?.message || r.reason}`);
      }
    }
  }

  return results;
}
