export type Role = "ADMINISTRATOR" | "OPERATOR_SEKOLAH" | "GURU" | "KEPALA_SEKOLAH";

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: Role;
  name: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: JwtPayload;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { page: number; limit: number; total: number };
}

export interface AcademicYear {
  id: string;
  year: string;
  isActive: boolean;
  isArchived: boolean;
}

export interface ClassItem {
  id: string;
  name: string;
  academicYearId: string;
  homeroomTeacherId: string | null;
  academicYear?: { year: string };
  homeroomTeacher?: { id: string; name: string };
  _count?: { students: number };
}

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: string;
  classId: string;
  class?: { id: string; name: string };
}

export interface SemesterRecord {
  id: string;
  studentId: string;
  academicYearId: string;
  semester: number;
  createdById: string;
  academicYear?: { year: string };
  subjectScores: SubjectScore[];
  attendance: Attendance | null;
  achievements: Achievement[];
  healthRecord: HealthRecord | null;
}

export interface SubjectScore {
  id: string;
  semesterRecordId: string;
  subjectName: string;
  knowledgeScore: number;
  skillsScore: number;
  notes: string | null;
}

export interface Attendance {
  id: string;
  semesterRecordId: string;
  sick: number;
  permission: number;
  absent: number;
}

export interface Achievement {
  id: string;
  semesterRecordId: string;
  title: string;
  type: string;
  description: string | null;
}

export interface HealthRecord {
  id: string;
  semesterRecordId: string;
  height: number | null;
  weight: number | null;
  hearingCondition: string | null;
  visionCondition: string | null;
  teethCondition: string | null;
}

export interface AiSummary {
  id: string;
  semesterRecordId: string;
  summaryType: "STUDENT_SUMMARY" | "DRAFT_DESCRIPTION" | "TRANSITION_SUMMARY";
  content: string;
  isFinal: boolean;
  version: number;
}

export interface DashboardSummary {
  totalStudents: number;
  totalClasses?: number;
  activeYear: string | null;
  pendingAiDrafts?: number;
  managedClasses?: ClassItem[];
}

export interface StudentProfile {
  student: Student & { class: { id: string; name: string } };
  semesterRecords: SemesterRecord[];
}
