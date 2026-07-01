import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { SearchX } from "lucide-react";
import { Nav } from "./components/layout/Nav";
import { PageWrapper } from "./components/layout/PageWrapper";
import { ShelbyErrorBoundary } from "./components/ShelbyErrorBoundary";
import { EmptyState } from "./components/ui/EmptyState";
import { Landing } from "./pages/Landing";
import { Marketplace } from "./pages/Marketplace";
import { DatasetDetail } from "./pages/DatasetDetail";
import { Upload } from "./pages/Upload";
import { Dashboard } from "./pages/Dashboard";

export function App() {
  const location = useLocation();

  return (
    <>
      <Nav />
      <ShelbyErrorBoundary resetKey={location.pathname}>
        <PageWrapper>
          <Routes>
            <Route index element={<Landing />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/dataset/:id" element={<DatasetDetail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageWrapper>
      </ShelbyErrorBoundary>
    </>
  );
}

function NotFound() {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={SearchX}
      title="Page not found"
      description="This route is not part of Stash yet. Go back to the marketplace and continue browsing indexed datasets."
      action={{ label: "Back to marketplace", onClick: () => navigate("/marketplace") }}
    />
  );
}
