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

export async function generateTransitionSummary(classId: string) {
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true },
  });

  const results = [];

  for (const student of students) {
    const { student: s, semesterRecords } = await getStudentAcademicData(student.id);
    if (semesterRecords.length === 0) continue;

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
    const summary = await prisma.$transaction(async (tx) => {
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

    results.push(summary);
  }

  return results;
}
