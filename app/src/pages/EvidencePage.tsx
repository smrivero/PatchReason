import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/status/EmptyState";
import { usePageTitle } from "../hooks/usePageTitle";

const sections = [
  {
    title: "NVIDIA Nsight Systems",
    testId: "evidence-nsight",
    body: "No .nsys-rep or Nsight timeline is in the repository. Collect a trace on the host, then add the reviewed image under screenshots/.",
  },
  {
    title: "nvtop and nvidia-smi",
    testId: "evidence-nvtop",
    body: "No nvtop or nvidia-smi capture is available. The planned names are screenshots/07-nvtop.png and screenshots/08-nvidia-smi.png, after a real session.",
  },
  {
    title: "Training metrics",
    testId: "evidence-training",
    body: "No loss curve or checkpoint metric has been recorded. Training has not started.",
  },
  {
    title: "Model evaluation comparisons",
    testId: "evidence-evaluation",
    body: "No scored comparison of the base model and a LoRA adapter is available.",
  },
  {
    title: "GPU performance charts",
    testId: "evidence-gpu",
    body: "No measured utilization, memory, power, or temperature series is stored here. Import a capture on GPU telemetry when one exists.",
  },
] as const;

export function EvidencePage() {
  usePageTitle("Evidence");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Evidence"
        lede="This page is reserved for captures from a real session. Empty sections stay empty until those files exist."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <EmptyState key={section.testId} testId={section.testId} title={section.title} body={section.body} />
        ))}
      </div>
    </div>
  );
}
