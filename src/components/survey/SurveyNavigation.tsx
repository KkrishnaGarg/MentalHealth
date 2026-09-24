"use client";

import { Button } from "@/components/ui/Button";

type Props = {
  canGoBack: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  disabled?: boolean;
};

export function SurveyNavigation({ canGoBack, onBack, onNext, nextLabel, disabled }: Props) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {canGoBack ? (
        <Button variant="ghost" size="lg" onClick={onBack} disabled={disabled}>
          ← Back
        </Button>
      ) : (
        <span />
      )}
      <Button size="lg" onClick={onNext} disabled={disabled}>
        {nextLabel}
      </Button>
    </div>
  );
}
