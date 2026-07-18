import { Client } from "pg";
import { randomUUID } from "crypto";
const sql = new Client({ connectionString: process.env.DATABASE_URL! });
await sql.connect();

await sql.query("TRUNCATE class,academic_year,\"user\",student,semester_record,subject_score,attendance,achievement,class_audit_log CASCADE");
console.log("✅ Clean");

const now = "NOW()";
const hash = await Bun.password.hash("admin123",{algorithm:"bcrypt",cost:10});
const hash2 = await Bun.password.hash("guru123",{algorithm:"bcrypt",cost:10});
const r = await sql.query(
  `INSERT INTO "user" (id,username,password,name,role,"isActive","createdAt","updatedAt") VALUES
    ($1::text,'admin',$2::text,'Administrator','ADMINISTRATOR',true,${now},${now}),
    ($3::text,'guru',$4::text,'Ani Rahmawati, S.Pd.','GURU',true,${now},${now}),
    ($5::text,'kepsek',$6::text,'Drs. H. Suryana, M.Pd.','KEPALA_SEKOLAH',true,${now},${now}),
    ($7::text,'operator',$8::text,'Operator Sekolah','OPERATOR_SEKOLAH',true,${now},${now})
    RETURNING id,username`,
  [randomUUID(),hash,randomUUID(),hash2,randomUUID(),hash,randomUUID(),hash2]
);
const guruId = r.rows.find((x:any)=>x.username==="guru").id;
console.log("✅ Users");

const yrs = await sql.query(
  `INSERT INTO academic_year (id,year,"isActive","isArchived","createdAt","updatedAt") VALUES
    ($1::text,'2023/2024',false,true,${now},${now}),($2::text,'2024/2025',false,true,${now},${now}),($3::text,'2025/2026',true,false,${now},${now})
    RETURNING id,year`,
  [randomUUID(),randomUUID(),randomUUID()]
);
const [y1,y2,y3] = yrs.rows;
console.log("✅ Academic years");

const cl = await sql.query(
  `INSERT INTO class (id,name,"academicYearId","homeroomTeacherId","createdAt","updatedAt") VALUES
    ($1::text,'Kelas 4A',$2::text,$3::text,${now},${now}),($4::text,'Kelas 4B',$5::text,$6::text,${now},${now}),
    ($7::text,'Kelas 5A',$8::text,$9::text,${now},${now}),($10::text,'Kelas 5B',$11::text,$12::text,${now},${now}),
    ($13::text,'Kelas 6A',$14::text,$15::text,${now},${now}),($16::text,'Kelas 6B',$17::text,$18::text,${now},${now})
    RETURNING id,name`,
  [randomUUID(),y1.id,guruId,randomUUID(),y1.id,guruId,
   randomUUID(),y2.id,guruId,randomUUID(),y2.id,guruId,
   randomUUID(),y3.id,guruId,randomUUID(),y3.id,guruId]
);
const c = cl.rows;
console.log("✅ Classes");

const sdata = [
  {n:"Ahmad Fauzi",g:"L",s1:[78,80,75,82,85,80,88,90],s2:[82,83,78,85,88,82,90,92],a:{s:2,p:1,ab:0},ac:["Juara 1 Olimpiade MTK","Akademik"]},
  {n:"Bunga Citra",g:"P",s1:[85,88,82,90,92,85,78,95],s2:[88,90,85,92,94,88,82,96],a:{s:1,p:0,ab:0},ac:["Juara 2 Olimpiade IPA","Akademik","Paskibra","Non-Akademik"]},
  {n:"Cahya Ningsih",g:"P",s1:[70,75,68,72,65,70,78,80],s2:[72,76,70,74,68,72,80,82],a:{s:4,p:2,ab:1},ac:[]},
  {n:"Dwi Prasetyo",g:"L",s1:[60,65,58,62,55,60,68,70],s2:[75,78,72,76,70,74,80,82],a:{s:3,p:1,ab:0},ac:["Baca Puisi","Non-Akademik"]},
  {n:"Eka Putri",g:"P",s1:[90,92,88,95,93,90,85,96],s2:[92,94,90,96,95,92,88,98],a:{s:0,p:0,ab:0},ac:["Juara 1 Pidato","Non-Akademik","Ranking 1","Akademik"]},
  {n:"Fajar Ramadhan",g:"L",s1:[65,68,62,70,72,68,60,75],s2:[68,70,65,72,74,70,64,78],a:{s:6,p:3,ab:2},ac:[]},
  {n:"Gita Savitri",g:"P",s1:[82,84,80,85,88,82,78,90],s2:[85,87,83,88,90,85,82,92],a:{s:1,p:1,ab:0},ac:["Juara 3 MTK","Akademik"]},
  {n:"Hendra Gunawan",g:"L",s1:[55,58,52,60,62,58,50,65],s2:[50,52,48,55,58,52,45,60],a:{s:8,p:4,ab:5},ac:[]},
  {n:"Indah Permata",g:"P",s1:[88,90,85,92,90,88,82,94],s2:[90,92,88,94,92,90,85,96],a:{s:2,p:0,ab:0},ac:["Juara 2 Sains","Akademik"]},
  {n:"Joko Susilo",g:"L",s1:[72,75,70,78,80,72,68,82],s2:[76,78,74,82,84,76,72,86],a:{s:2,p:1,ab:0},ac:["Juara 1 Tenis Meja","Non-Akademik"]},
  {n:"Kartika Sari",g:"P",s1:[80,82,78,85,83,80,75,88],s2:[78,80,76,82,80,78,72,85],a:{s:3,p:2,ab:0},ac:[]},
  {n:"Lukman Hakim",g:"L",s1:[68,72,65,70,75,68,62,78],s2:[82,85,80,84,88,82,78,90],a:{s:1,p:1,ab:0},ac:["Pramuka","Non-Akademik"]},
  {n:"Maya Anggraini",g:"P",s1:[75,78,72,80,78,75,70,85],s2:[80,82,78,85,82,80,76,88],a:{s:2,p:0,ab:0},ac:["Juara 2 Melukis","Non-Akademik"]},
  {n:"Nanda Pratama",g:"L",s1:[85,88,82,88,90,85,80,92],s2:[88,90,85,92,94,88,84,95],a:{s:1,p:0,ab:0},ac:["Ketua OSIS","Non-Akademik","Ranking 3","Akademik"]},
  {n:"Olivia Dewi",g:"P",s1:[70,72,68,74,76,70,65,80],s2:[72,75,70,78,80,72,68,82],a:{s:3,p:1,ab:0},ac:[]},
];
const subj = ["Pendidikan Agama","Pendidikan Pancasila","Bahasa Indonesia","Matematika","IPA","IPS","Seni Budaya","PJOK"];
const yIds = [y1.id,y2.id,y3.id];
const clsIdx = [c[0].id,c[1].id,c[2].id,c[3].id,c[4].id,c[5].id];

for (let i=0;i<sdata.length;i++) {
  const s = sdata[i]; const ci = i<8?0:1; const sid = randomUUID();
  await sql.query(`INSERT INTO student (id,nis,nisn,name,gender,"classId","createdAt","updatedAt") VALUES ($1::text,$2,$3,$4,$5,$6::text,${now},${now})`,[sid,`${1000+i}`,`${2000+i}`,s.n,s.g,clsIdx[4+ci]]);
  for (let yi=0;yi<3;yi++) {
    for (let sem=1;sem<=2;sem++) {
      const sc = sem===1?s.s1:s.s2; const rid = randomUUID();
      await sql.query(`INSERT INTO semester_record (id,"studentId","academicYearId",semester,"createdById","createdAt","updatedAt") VALUES ($1::text,$2::text,$3::text,$4,$5::text,${now},${now})`,[rid,sid,yIds[yi],sem,guruId]);
      for (let si=0;si<subj.length;si++) {
        const ks = Math.min(100,Math.max(0,sc[si]+(yi-1)*3+Math.round((Math.random()-0.5)*5)));
        const ss = Math.min(100,Math.max(0,sc[si]-3+(yi-1)*2+Math.round((Math.random()-0.5)*5)));
        await sql.query(`INSERT INTO subject_score (id,"semesterRecordId","subjectName","knowledgeScore","skillsScore","createdAt","updatedAt") VALUES ($1::text,$2::text,$3,$4,$5,${now},${now})`,[randomUUID(),rid,subj[si],ks,ss]);
      }
      const av = Math.floor(Math.random()*3)-1;
      await sql.query(`INSERT INTO attendance (id,"semesterRecordId",sick,permission,absent,"createdAt","updatedAt") VALUES ($1::text,$2::text,$3,$4,$5,${now},${now})`,[randomUUID(),rid,Math.max(0,s.a.s+av),Math.max(0,s.a.p+av),Math.max(0,s.a.ab+Math.floor(av/2))]);
      if (sem===2&&yi===2&&s.ac.length>0) {
        for (let ai=0;ai<s.ac.length;ai+=2)
          await sql.query(`INSERT INTO achievement (id,"semesterRecordId",title,type,"createdAt","updatedAt") VALUES ($1::text,$2::text,$3,$4,${now},${now})`,[randomUUID(),rid,s.ac[ai],s.ac[ai+1]]);
      }
    }
  }
}

console.log(`✅ ${sdata.length} students × 6 semesters`);
console.log("\nadmin / admin123\nguru / guru123\nkepsek / kepsek123\noperator / operator123");
await sql.end();
