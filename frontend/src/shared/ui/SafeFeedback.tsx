import type { ApiProblem } from "../api/models";

export function SafeFeedback({
  problem,
  success,
}: {
  problem?: ApiProblem | null;
  success?: string | null;
}) {
  if (problem)
    return (
      <p className="error" role="alert" aria-live="polite" data-testid="app-error-banner">
        {problem.message}
      </p>
    );
  if (success)
    return (
      <p className="success" role="status" aria-live="polite">
        {success}
      </p>
    );
  return null;
}

export function Pending({ active }: { active: boolean }) {
  return active ? <span aria-live="polite">처리 중</span> : null;
}
