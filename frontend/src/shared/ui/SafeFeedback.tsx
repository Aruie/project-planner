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

export function BlockingProgress({
  active,
  title,
  description,
}: {
  active: boolean;
  title: string;
  description: string;
}) {
  if (!active) return null;
  return (
    <div className="blocking-progress-backdrop" role="presentation">
      <section
        className="blocking-progress-dialog"
        role="dialog"
        aria-modal="true"
        aria-live="assertive"
        aria-labelledby="blocking-progress-title"
      >
        <span className="blocking-progress-spinner" aria-hidden="true" />
        <div>
          <strong id="blocking-progress-title">{title}</strong>
          <p>{description}</p>
        </div>
      </section>
    </div>
  );
}
