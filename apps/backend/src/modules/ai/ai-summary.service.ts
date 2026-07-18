import { prisma } from "../../lib/prisma";
import { NotFoundError, AiError } from "../../common/error";
import { generateChatCompletion } from "./llm.client";
import { buildStudentSummaryPrompt, buildDraftDescriptionPrompt } from "./prompts";

export async function getBySemesterRecord(semesterRecordId: string) {
  return prisma.aiSummary.findMany({
    where: { semesterRecordId },
    orderBy: [{ version: "desc" }],
  });
}

export async function update(id: string, data: { isFinal?: boolean; content?: string }) {
  const existing = await prisma.aiSummary.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("AI Summary not found");

  return prisma.aiSummary.update({
    where: { id },
    data: {
      ...(data.isFinal !== undefined ? { isFinal: data.isFinal } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.aiSummary.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("AI Summary not found");

  return prisma.aiSummary.delete({ where: { id } });
}

export async function regenerate(id: string) {
  const existing = await prisma.aiSummary.findUnique({
    where: { id },
    include: {
      semesterRecord: {
        include: {
          student: { select: { id: true, name: true } },
          subjectScores: true,
          attendance: true,
          achievements: true,
        },
      },
    },
  });
  if (!existing) throw new NotFoundError("AI Summary not found");

  const record = existing.semesterRecord;
  const data = {
    name: record.student.name,
    className: "",
    semester: record.semester,
    academicYear: "",
    subjectScores: record.subjectScores.map((s) => ({
      subjectName: s.subjectName,
      knowledgeScore: s.knowledgeScore,
      skillsScore: s.skillsScore,
    })),
    attendance: record.attendance
      ? { sick: record.attendance.sick, permission: record.attendance.permission, absent: record.attendance.absent }
      : null,
    achievements: record.achievements.map((a) => ({ title: a.title, type: a.type })),
  };

  const prompt =
    existing.summaryType === "DRAFT_DESCRIPTION"
      ? buildDraftDescriptionPrompt(data)
      : buildStudentSummaryPrompt(data);

  const systemMessage =
    existing.summaryType === "DRAFT_DESCRIPTION"
      ? "Anda adalah asisten guru SD. Buatkan draft deskripsi rapor."
      : "Anda adalah asisten administrasi pendidikan SD.";

  const content = await generateChatCompletion([
    { role: "system", content: systemMessage },
    { role: "user", content: prompt },
  ]).catch(() => {
    throw new AiError("Gagal menghubungi layanan AI");
  });

  return prisma.$transaction(async (tx) => {
    const max = await tx.aiSummary.aggregate({
      where: { semesterRecordId: record.id, summaryType: existing.summaryType },
      _max: { version: true },
    });
    const nextVersion = (max._max.version || 0) + 1;

    return tx.aiSummary.create({
      data: {
        semesterRecordId: record.id,
        summaryType: existing.summaryType,
        content,
        version: nextVersion,
        isFinal: false,
      },
    });
  });
}
