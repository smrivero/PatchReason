import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ComparePage } from "./pages/ComparePage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { EvidencePage } from "./pages/EvidencePage";
import { GpuPage } from "./pages/GpuPage";
import { MethodologyPage } from "./pages/MethodologyPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReviewPage } from "./pages/ReviewPage";
import { RunsPage } from "./pages/RunsPage";
import { WorkspaceProvider } from "./workspace/WorkspaceProvider";

export function App() {
  return (
    <WorkspaceProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/evaluation" element={<EvaluationPage />} />
            <Route path="/gpu" element={<GpuPage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </WorkspaceProvider>
  );
}
