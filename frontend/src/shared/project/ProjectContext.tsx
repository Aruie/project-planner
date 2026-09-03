import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { RequestCoordinator } from "../api/request-coordinator";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ProjectContextValue = {
  projectId: string;
  setProjectId: (value: string) => boolean;
  coordinator: RequestCoordinator;
};
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, updateProjectId] = useState("");
  const [coordinator] = useState(() => new RequestCoordinator());
  const value = useMemo(
    () => ({
      projectId,
      coordinator,
      setProjectId: (raw: string) => {
        const value = raw.trim();
        if (!UUID.test(value)) return false;
        if (value !== projectId) coordinator.resetProject();
        updateProjectId(value);
        return true;
      },
    }),
    [coordinator, projectId],
  );
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("ProjectProvider is required");
  return value;
}
