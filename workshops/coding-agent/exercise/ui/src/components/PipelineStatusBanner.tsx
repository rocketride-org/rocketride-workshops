import type { PipelineState } from "../hooks/usePipelineHealth";

const MESSAGES: Record<Exclude<PipelineState, "ready">, string> = {
  unbuilt: "Pipeline is empty — add components in the design view to start chatting.",
  unavailable: "Pipeline is starting up — hang on…",
  unreachable: "Can't reach the API. Is the dev server running?",
};

export function PipelineStatusBanner({ state }: { state: PipelineState }) {
  if (state === "ready") return null;
  return (
    <div className="pipeline-banner" role="status">
      <span>{MESSAGES[state]}</span>
    </div>
  );
}
