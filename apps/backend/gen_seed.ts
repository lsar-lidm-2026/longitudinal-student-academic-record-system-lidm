const H = process.env.HASH || "";
const { randomUUID } = require("crypto");
const sdata = [
  {n:"Ahmad Fauzi",g:"L",s1:[78,80,75,82,85,80,88,90],s2:[82,83,78,85,88,82,90,92],at:{s:2,p:1,a:0},ac:["Juara 1 Olimpiade MTK","Akademik"]},
  {n:"Bunga Citra",g:"P",s1:[85,88,82,90,92,85,78,95],s2:[88,90,85,92,94,88,82,96],at:{s:1,p:0,a:0},ac:["Juara 2 Olimpiade IPA","Akademik","Paskibra","Non-Akademik"]},
  {n:"Cahya Ningsih",g:"P",s1:[70,75,68,72,65,70,78,80],s2:[72,76,70,74,68,72,80,82],at:{s:4,p:2,a:1},ac:[]},
  {n:"Dwi Prasetyo",g:"L",s1:[60,65,58,62,55,60,68,70],s2:[75,78,72,76,70,74,80,82],at:{s:3,p:1,a:0},ac:["Baca Puisi","Non-Akademik"]},
  {n:"Eka Putri",g:"P",s1:[90,92,88,95,93,90,85,96],s2:[92,94,90,96,95,92,88,98],at:{s:0,p:0,a:0},ac:["Juara 1 Pidato","Non-Akademik","Ranking 1","Akademik"]},
  {n:"Fajar Ramadhan",g:"L",s1:[65,68,62,70,72,68,60,75],s2:[68,70,65,72,74,70,64,78],at:{s:6,p:3,a:2},ac:[]},
  {n:"Gita Savitri",g:"P",s1:[82,84,80,85,88,82,78,90],s2:[85,87,83,88,90,85,82,92],at:{s:1,p:1,a:0},ac:["Juara 3 MTK","Akademik"]},
  {n:"Hendra Gunawan",g:"L",s1:[55,58,52,60,62,58,50,65],s2:[50,52,48,55,58,52,45,60],at:{s:8,p:4,a:5},ac:[]},
  {n:"Indah Permata",g:"P",s1:[88,90,85,92,90,88,82,94],s2:[90,92,88,94,92,90,85,96],at:{s:2,p:0,a:0},ac:["Juara 2 Sains","Akademik"]},
  {n:"Joko Susilo",g:"L",s1:[72,75,70,78,80,72,68,82],s2:[76,78,74,82,84,76,72,86],at:{s:2,p:1,a:0},ac:["Juara 1 Tenis Meja","Non-Akademik"]},
  {n:"Kartika Sari",g:"P",s1:[80,82,78,85,83,80,75,88],s2:[78,80,76,82,80,78,72,85],at:{s:3,p:2,a:0},ac:[]},
  {n:"Lukman Hakim",g:"L",s1:[68,72,65,70,75,68,62,78],s2:[82,85,80,84,88,82,78,90],at:{s:1,p:1,a:0},ac:["Pramuka","Non-Akademik"]},
  {n:"Maya Anggraini",g:"P",s1:[75,78,72,80,78,75,70,85],s2:[80,82,78,85,82,80,76,88],at:{s:2,p:0,a:0},ac:["Juara 2 Melukis","Non-Akademik"]},
  {n:"Nanda Pratama",g:"L",s1:[85,88,82,88,90,85,80,92],s2:[88,90,85,92,94,88,84,95],at:{s:1,p:0,a:0},ac:["Ketua OSIS","Non-Akademik","Ranking 3","Akademik"]},
  {n:"Olivia Dewi",g:"P",s1:[70,72,68,74,76,70,65,80],s2:[72,75,70,78,80,72,68,82],at:{s:3,p:1,a:0},ac:[]},
];
const subj = ["Pendidikan Agama","Pendidikan Pancasila","Bahasa Indonesia","Matematika","IPA","IPS","Seni Budaya","PJOK"];
const ylbls = [["2023/2024",false,true],["2024/2025",false,true],["2025/2026",true,false]];
const clbls = ["Kelas 4A","Kelas 4B","Kelas 5A","Kelas 5B","Kelas 6A","Kelas 6B"];

// Pre-generate all UUIDs
const userIds = ["admin","guru","kepsek","operator"].map(() => randomUUID());
const yearIds = ylbls.map(() => randomUUID());
const classIds = clbls.map(() => randomUUID());
const studentIds = sdata.map(() => randomUUID());

let sql = "";
sql += `TRUNCATE class,academic_year,"user",student,semester_record,subject_score,attendance,achievement,class_audit_log CASCADE;\n`;

// Users with explicit IDs
const unames = ["admin","guru","kepsek","operator"];
const unames2 = ["Administrator","Ani Rahmawati, S.Pd.","Drs. H. Suryana, M.Pd.","Operator Sekolah"];
const uroles = ["ADMINISTRATOR","GURU","KEPALA_SEKOLAH","OPERATOR_SEKOLAH"];
for (let i=0;i<4;i++)
  sql += `INSERT INTO "user" (id,username,password,name,role,"isActive") VALUES ('${userIds[i]}','${unames[i]}','${H}','${unames2[i]}','${uroles[i]}',true);\n`;

// Academic years with explicit IDs
for (let i=0;i<3;i++)
  sql += `INSERT INTO academic_year (id,year,"isActive","isArchived") VALUES ('${yearIds[i]}','${ylbls[i][0]}',${ylbls[i][1]},${ylbls[i][2]});\n`;

// Classes with explicit IDs + references
for (let i=0;i<6;i++)
  sql += `INSERT INTO class (id,name,"academicYearId","homeroomTeacherId") VALUES ('${classIds[i]}','${clbls[i]}','${yearIds[Math.floor(i/2)]}','${userIds[1]}');\n`;

// Students + all data
for (let i=0;i<sdata.length;i++) {
  const s=sdata[i]; const ci=i<8?0:1;
  const sid = studentIds[i];
  sql += `INSERT INTO student (id,nis,nisn,name,gender,"classId") VALUES ('${sid}','${1000+i}','${2000+i}','${s.n}','${s.g}','${classIds[4+ci]}');\n`;

  for (let yi=0;yi<3;yi++) {
    for (let sem=1;sem<=2;sem++) {
      const sc=sem===1?s.s1:s.s2;
      const rid=randomUUID();
      sql += `INSERT INTO semester_record (id,"studentId","academicYearId",semester,"createdById") VALUES ('${rid}','${sid}','${yearIds[yi]}',${sem},'${userIds[1]}');\n`;

      for (let si=0;si<subj.length;si++) {
        const ks=Math.min(100,Math.max(0,sc[si]+(yi-1)*3+Math.round((Math.random()-0.5)*5)));
        const ss=Math.min(100,Math.max(0,sc[si]-3+(yi-1)*2+Math.round((Math.random()-0.5)*5)));
        sql += `INSERT INTO subject_score (id,"semesterRecordId","subjectName","knowledgeScore","skillsScore") VALUES ('${randomUUID()}','${rid}','${subj[si]}',${ks},${ss});\n`;
      }

      const av=Math.floor(Math.random()*3)-1;
      sql += `INSERT INTO attendance (id,"semesterRecordId",sick,permission,absent) VALUES ('${randomUUID()}','${rid}',${Math.max(0,s.at.s+av)},${Math.max(0,s.at.p+av)},${Math.max(0,s.at.a+Math.floor(av/2))});\n`;

      if (sem===2&&yi===2&&s.ac.length>0) {
        for (let ai=0;ai<s.ac.length;ai+=2)
          sql += `INSERT INTO achievement (id,"semesterRecordId",title,type) VALUES ('${randomUUID()}','${rid}','${s.ac[ai]}','${s.ac[ai+1]}');\n`;
      }
    }
  }
}
process.stdout.write(sql);
