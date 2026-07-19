"use client";

export interface ScoreInputData {
  subjectName: string;
  knowledgeScore: number;
  skillsScore: number;
}

interface ScoreInputProps {
  scores: ScoreInputData[];
  onChange: (scores: ScoreInputData[]) => void;
}

const SUBJECTS = [
  "Pendidikan Agama", "Pendidikan Pancasila", "Bahasa Indonesia",
  "Matematika", "IPA", "IPS", "Seni Budaya", "PJOK",
];

export function ScoreInput({ scores, onChange }: ScoreInputProps) {
  function updateScore(idx: number, field: "knowledgeScore" | "skillsScore", value: number) {
    const newScores = [...scores];
    newScores[idx] = { ...newScores[idx], [field]: value };
    onChange(newScores);
  }

  function toNumber(val: string): number {
    return val === "" ? 0 : Number(val);
  }

  return (
    <div className="space-y-2">
      {SUBJECTS.map((subject, idx) => {
        const score = scores.find((s) => s.subjectName === subject) || {
          subjectName: subject,
          knowledgeScore: 0,
          skillsScore: 0,
        };
        const scoreIdx = scores.findIndex((s) => s.subjectName === subject);

        return (
          <div
            key={subject}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-2 bg-gray-50/50 rounded-lg"
          >
            <span className="sm:w-44 text-sm font-medium text-gray-700">
              {subject}
            </span>
            <div className="flex gap-3">
              <input
                type="number"
                min="0"
                max="100"
                value={score.knowledgeScore || ""}
                onChange={(e) =>
                  updateScore(scoreIdx >= 0 ? scoreIdx : idx, "knowledgeScore", toNumber(e.target.value))
                }
                placeholder="P"
                title="Nilai Pengetahuan"
                className="w-16 h-8 px-2 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={score.skillsScore || ""}
                onChange={(e) =>
                  updateScore(scoreIdx >= 0 ? scoreIdx : idx, "skillsScore", toNumber(e.target.value))
                }
                placeholder="K"
                title="Nilai Keterampilan"
                className="w-16 h-8 px-2 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
