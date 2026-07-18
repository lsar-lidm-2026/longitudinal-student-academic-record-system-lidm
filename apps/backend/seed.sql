TRUNCATE class, academic_year, "user", student, semester_record, subject_score, attendance, achievement, class_audit_log CASCADE;

-- Password hash for "admin123" and "guru123" (same bcrypt hash)
INSERT INTO "user" (id, username, password, name, role, "isActive")
VALUES
  (gen_random_uuid()::text, 'admin',  '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGm8y7VfJyWz2rPw7FjGy', 'Administrator', 'ADMINISTRATOR', true),
  (gen_random_uuid()::text, 'guru',   '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGm8y7VfJyWz2rPw7FjGy', 'Ani Rahmawati, S.Pd.', 'GURU', true),
  (gen_random_uuid()::text, 'kepsek', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGm8y7VfJyWz2rPw7FjGy', 'Drs. H. Suryana, M.Pd.', 'KEPALA_SEKOLAH', true),
  (gen_random_uuid()::text, 'operator','$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGm8y7VfJyWz2rPw7FjGy', 'Operator Sekolah', 'OPERATOR_SEKOLAH', true);

\echo '✅ Users'

WITH ay AS (
  INSERT INTO academic_year (id, year, "isActive", "isArchived")
  VALUES
    (gen_random_uuid()::text, '2023/2024', false, true),
    (gen_random_uuid()::text, '2024/2025', false, true),
    (gen_random_uuid()::text, '2025/2026', true, false)
  RETURNING id, year
)
SELECT * FROM ay;
\echo '✅ Academic years'

-- Get IDs
\set gid (SELECT id FROM "user" WHERE username='guru')
\set y1 (SELECT id FROM academic_year WHERE year='2023/2024')
\set y2 (SELECT id FROM academic_year WHERE year='2024/2025')
\set y3 (SELECT id FROM academic_year WHERE year='2025/2026')

INSERT INTO class (id, name, "academicYearId", "homeroomTeacherId")
VALUES
  (gen_random_uuid()::text, 'Kelas 4A', (SELECT id FROM academic_year WHERE year='2023/2024'), (SELECT id FROM "user" WHERE username='guru')),
  (gen_random_uuid()::text, 'Kelas 4B', (SELECT id FROM academic_year WHERE year='2023/2024'), (SELECT id FROM "user" WHERE username='guru')),
  (gen_random_uuid()::text, 'Kelas 5A', (SELECT id FROM academic_year WHERE year='2024/2025'), (SELECT id FROM "user" WHERE username='guru')),
  (gen_random_uuid()::text, 'Kelas 5B', (SELECT id FROM academic_year WHERE year='2024/2025'), (SELECT id FROM "user" WHERE username='guru')),
  (gen_random_uuid()::text, 'Kelas 6A', (SELECT id FROM academic_year WHERE year='2025/2026'), (SELECT id FROM "user" WHERE username='guru')),
  (gen_random_uuid()::text, 'Kelas 6B', (SELECT id FROM academic_year WHERE year='2025/2026'), (SELECT id FROM "user" WHERE username='guru'));
\echo '✅ Classes'
