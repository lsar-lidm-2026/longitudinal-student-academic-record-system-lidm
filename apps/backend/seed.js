#!/usr/bin/env bun
import pg from "pg";
const { Client } = pg;
const sql = new Client({ connectionString: process.env.DATABASE_URL });
await sql.connect();

console.log("🌱 Seeding...");
await sql.query("TRUNCATE class, academic_year, \"user\", student, semester_record, subject_score, attendance, achievement, class_audit_log CASCADE");
console.log("✅ Clean");

const h = await Bun.password.hash("admin123", {algorithm:"bcrypt",cost:10});
const users = [
  {id:require("crypto").randomUUID(), u:"admin", n:"Administrator", r:"ADMINISTRATOR"},
  {id:require("crypto").randomUUID(), u:"guru", n:"Ani Rahmawati, S.Pd.", r:"GURU"},
  {id:require("crypto").randomUUID(), u:"kepsek", n:"Drs. H. Suryana, M.Pd.", r:"KEPALA_SEKOLAH"},
  {id:require("crypto").randomUUID(), u:"operator", n:"Operator Sekolah", r:"OPERATOR_SEKOLAH"},
];
await sql.query("INSERT INTO \"user\"(id,username,password,name,role,\"isActive\") VALUES"+
  users.map((_,i)=>`($${i*5+1}::text,$${i*5+2},$${i*5+3},$${i*5+4},$${i*5+5}::text,true)`).join(","),
  users.flatMap(x=>[x.id,x.u,h,x.n,x.r])
);
const gu = users.find(x=>x.u==="guru").id;
console.log("✅ Users");

const {randomUUID} = require("crypto");
const yids = [randomUUID(),randomUUID(),randomUUID()];
await sql.query("INSERT INTO academic_year(id,year,\"isActive\",\"isArchived\") VALUES($1::text,'2023/2024',false,true),($2::text,'2024/2025',false,true),($3::text,'2025/2026',true,false)",yids);
console.log("✅ Years");

const cids = [0,1,2,3,4,5].map(()=>randomUUID());
const cn = ["Kelas 4A","Kelas 4B","Kelas 5A","Kelas 5B","Kelas 6A","Kelas 6B"];
await sql.query("INSERT INTO class(id,name,\"academicYearId\",\"homeroomTeacherId\") VALUES"+
  cids.map((_,i)=>`($${i*4+1}::text,$${i*4+2},$${i*4+3}::text,$${i*4+4}::text)`).join(","),
  cids.flatMap((id,i)=>[id,cn[i],yids[Math.floor(i/2)],gu])
);
console.log("✅ Classes");

const sd = [
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

for (let i=0;i<sd.length;i++) {
  const s = sd[i]; const ci = i<8 ? 0 : 1; const sid = randomUUID();
  await sql.query("BEGIN");
  try {
    await sql.query("INSERT INTO student(id,nis,nisn,name,gender,\"classId\") VALUES($1::text,$2,$3,$4,$5,$6::text)",[sid,`${1000+i}`,`${2000+i}`,s.n,s.g,cids[4+ci]]);
    for (let yi=0;yi<3;yi++) {
      for (let sem=1;sem<=2;sem++) {
        const sc = sem===1?s.s1:s.s2; const rid = randomUUID();
        await sql.query("INSERT INTO semester_record(id,\"studentId\",\"academicYearId\",semester,\"createdById\") VALUES($1::text,$2::text,$3::text,$4,$5::text)",[rid,sid,yids[yi],sem,gu]);
        for (let si=0;si<subj.length;si++) {
          const ks = Math.min(100,Math.max(0,sc[si]+(yi-1)*3+Math.round((Math.random()-0.5)*5)));
          const ss = Math.min(100,Math.max(0,sc[si]-3+(yi-1)*2+Math.round((Math.random()-0.5)*5)));
          await sql.query("INSERT INTO subject_score(id,\"semesterRecordId\",\"subjectName\",\"knowledgeScore\",\"skillsScore\") VALUES($1::text,$2::text,$3,$4,$5)",[randomUUID(),rid,subj[si],ks,ss]);
        }
        const av = Math.floor(Math.random()*3)-1;
        await sql.query("INSERT INTO attendance(id,\"semesterRecordId\",sick,permission,absent) VALUES($1::text,$2::text,$3,$4,$5)",[randomUUID(),rid,Math.max(0,s.a.s+av),Math.max(0,s.a.p+av),Math.max(0,s.a.ab+Math.floor(av/2))]);
        if (sem===2&&yi===2&&s.ac.length>0) {
          for (let ai=0;ai<s.ac.length;ai+=2)
            await sql.query("INSERT INTO achievement(id,\"semesterRecordId\",title,type) VALUES($1::text,$2::text,$3,$4)",[randomUUID(),rid,s.ac[ai],s.ac[ai+1]]);
        }
      }
    }
    await sql.query("COMMIT");
  } catch(e) {
    await sql.query("ROLLBACK");
    console.error(`Student ${i+1} (${s.n}) failed:`, e.message?.substring(0,100));
    break;
  }
  if ((i+1)%5===0) console.log(`  ${i+1}/${sd.length}`);
}

console.log("\nadmin / admin123\nguru / guru123\nkepsek / kepsek123\noperator / operator123");
await sql.end();
