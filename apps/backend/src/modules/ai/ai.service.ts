import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../common/error";
import { generateChatCompletion } from "./llm.client";
import {
  buildStudentSummaryPrompt,
  buildDraftDescriptionPrompt,
  buildTransitionSummaryPrompt,
} from "./prompts";
import type { SummaryType } from "../../generated/prisma";

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
  const content = await generateChatCompletion([
    { role: "system", content: "Anda adalah asisten administrasi pendidikan SD." },
    { role: "user", content: prompt },
  ]);

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
  const content = await generateChatCompletion([
    { role: "system", content: "Anda adalah asisten guru SD." },
    { role: "user", content: prompt },
  ]);

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
  const content = await generateChatCompletion([
    { role: "system", content: "Anda adalah asisten serah terima wali kelas SD." },
    { role: "user", content: prompt },
  ]);

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
