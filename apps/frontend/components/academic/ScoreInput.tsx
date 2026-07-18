"use client";

import { Input } from "@/components/ui/input";

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
              <Input
                type="number"
                min="0"
                max="100"
                value={score.knowledgeScore || ""}
                onChange={(e) =>
                  updateScore(scoreIdx >= 0 ? scoreIdx : idx, "knowledgeScore", Number(e.target.value))
                }
                placeholder="Pengetahuan"
                className="w-24"
              />
              <Input
                type="number"
                min="0"
                max="100"
                value={score.skillsScore || ""}
                onChange={(e) =>
                  updateScore(scoreIdx >= 0 ? scoreIdx : idx, "skillsScore", Number(e.target.value))
                }
                placeholder="Keterampilan"
                className="w-24"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
