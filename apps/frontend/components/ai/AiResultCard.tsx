"use client";

import { AiSummary } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AiResultCardProps {
  result: AiSummary;
  typeLabel: string;
  onFinalize: (id: string) => void;
  onRegenerate: (id: string) => void;
  regenerating?: boolean;
}

export function AiResultCard({
  result,
  typeLabel,
  onFinalize,
  onRegenerate,
  regenerating,
}: AiResultCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Hasil {typeLabel}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            v{result.version}
          </span>
          <Badge variant={result.isFinal ? "success" : "warning"}>
            {result.isFinal ? "Final" : "Draft"}
          </Badge>
        </div>
      </div>
      <Separator />
      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
        {result.content}
      </div>
      <div className="flex gap-2">
        {!result.isFinal && (
          <>
            <Button onClick={() => onFinalize(result.id)} variant="primary" size="sm">
              Setujui & Finalkan
            </Button>
            <Button
              onClick={() => onRegenerate(result.id)}
              variant="secondary"
              size="sm"
              loading={regenerating}
            >
              Regenerate
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
