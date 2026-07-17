import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

async function main() {
  console.log("Seeding database...");

  // Create users
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      password: await Bun.password.hash("admin123", { algorithm: "bcrypt", cost: 10 }),
      name: "Administrator",
      role: "ADMINISTRATOR",
    },
  });

  const operator = await prisma.user.create({
    data: {
      username: "operator",
      password: await Bun.password.hash("operator123", { algorithm: "bcrypt", cost: 10 }),
      name: "Operator Sekolah",
      role: "OPERATOR_SEKOLAH",
    },
  });

  const guru1 = await prisma.user.create({
    data: {
      username: "guru1",
      password: await Bun.password.hash("guru123", { algorithm: "bcrypt", cost: 10 }),
      name: "Ani Rahmawati",
      role: "GURU",
    },
  });

  const guru2 = await prisma.user.create({
    data: {
      username: "guru2",
      password: await Bun.password.hash("guru123", { algorithm: "bcrypt", cost: 10 }),
      name: "Budi Santoso",
      role: "GURU",
    },
  });

  const kepsek = await prisma.user.create({
    data: {
      username: "kepsek",
      password: await Bun.password.hash("kepsek123", { algorithm: "bcrypt", cost: 10 }),
      name: "Drs. H. Suryana",
      role: "KEPALA_SEKOLAH",
    },
  });

  console.log(`Users created: admin, operator, guru1, guru2, kepsek`);

  // Create academic year
  const year = await prisma.academicYear.create({
    data: { year: "2025/2026", isActive: true },
  });

  console.log(`Academic year: ${year.year}`);

  // Create classes
  const classA = await prisma.class.create({
    data: {
      name: "Kelas 5A",
      academicYearId: year.id,
      homeroomTeacherId: guru1.id,
    },
  });

  const classB = await prisma.class.create({
    data: {
      name: "Kelas 5B",
      academicYearId: year.id,
      homeroomTeacherId: guru2.id,
    },
  });

  console.log(`Classes: ${classA.name}, ${classB.name}`);

  // Create students
  const students = [];
  const names = [
    "Ahmad Fauzi", "Bunga Citra", "Cahya Ningsih", "Dwi Prasetyo", "Eka Putri",
    "Fajar Ramadhan", "Gita Savitri", "Hendra Gunawan", "Indah Permata", "Joko Susilo",
    "Kartika Sari", "Lukman Hakim", "Maya Anggraini", "Nanda Pratama", "Olivia Dewi",
  ];

  for (let i = 0; i < names.length; i++) {
    const student = await prisma.student.create({
      data: {
        nis: `${1000 + i}`,
        nisn: `00${1000 + i}`,
        name: names[i]!,
        gender: i % 2 === 0 ? "L" : "P",
        classId: i < 8 ? classA.id : classB.id,
      },
    });
    students.push(student);
  }

  console.log(`Students: ${students.length}`);

  // Create semester records
  const subjects = [
    "Pendidikan Agama", "Pendidikan Pancasila", "Bahasa Indonesia",
    "Matematika", "IPA", "IPS", "Seni Budaya", "PJOK",
  ];

  for (const student of students) {
    const record = await prisma.semesterRecord.create({
      data: {
        studentId: student.id,
        academicYearId: year.id,
        semester: 1,
        createdById: guru1.id,
      },
    });

    for (const subject of subjects) {
      await prisma.subjectScore.create({
        data: {
          semesterRecordId: record.id,
          subjectName: subject,
          knowledgeScore: Math.round(65 + Math.random() * 30),
          skillsScore: Math.round(65 + Math.random() * 30),
        },
      });
    }

    await prisma.attendance.create({
      data: {
        semesterRecordId: record.id,
        sick: Math.floor(Math.random() * 3),
        permission: Math.floor(Math.random() * 2),
        absent: Math.floor(Math.random() * 2),
      },
    });

    await prisma.achievement.create({
      data: {
        semesterRecordId: record.id,
        title: "Juara Kelas",
        type: "Akademik",
        description: "Peringkat 3 besar di kelas",
      },
    });
  }

  console.log("Semester records created with scores, attendance, and achievements");
  console.log("");
  console.log("=== Login Credentials ===");
  console.log("admin / admin123");
  console.log("operator / operator123");
  console.log("guru1 / guru123");
  console.log("guru2 / guru123");
  console.log("kepsek / kepsek123");
  console.log("========================");
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
