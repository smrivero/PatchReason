import {
  BarChart3,
  BookOpen,
  Cpu,
  FileCode2,
  FolderOpen,
  GitCompare,
  LayoutDashboard,
  ListTree,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useWorkspace } from "../../hooks/useWorkspace";
import { DemoBanner, DemoToggle } from "./DemoBanner";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/review", label: "Code review", icon: FileCode2, end: false },
  { to: "/compare", label: "Comparison", icon: GitCompare, end: false },
  { to: "/evaluation", label: "Evaluation", icon: BarChart3, end: false },
  { to: "/gpu", label: "GPU telemetry", icon: Cpu, end: false },
  { to: "/evidence", label: "Evidence", icon: FolderOpen, end: false },
  { to: "/runs", label: "Training runs", icon: ListTree, end: false },
  { to: "/methodology", label: "Methodology", icon: BookOpen, end: false },
] satisfies readonly NavItem[];

function NavLinks() {
  return (
    <div className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition duration-150 ${
                isActive ? "bg-accentDim text-accentText" : "text-mute hover:bg-panelRaised hover:text-paper"
              }`
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        );
      })}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
        <Shield className="h-4 w-4" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-tight text-paper">PatchReason</span>
        <span className="block text-xs text-mute">AI Code Security</span>
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { demoMode, setDemoMode } = useWorkspace();

  return (
    <div className="min-h-screen bg-ink text-paper">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {demoMode ? <DemoBanner /> : null}
      <div className="md:grid md:min-h-screen md:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden border-r border-line bg-white md:flex md:flex-col md:justify-between md:px-3 md:py-5">
          <div>
            <Brand />
            <nav aria-label="Primary" className="mt-6">
              <NavLinks />
            </nav>
          </div>
          <DemoToggle pressed={demoMode} onToggle={() => setDemoMode(!demoMode)} />
        </aside>
        <div className="min-w-0">
          <div className="border-b border-line bg-white px-4 py-3 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <Brand />
            </div>
            <div className="mt-3">
              <DemoToggle pressed={demoMode} onToggle={() => setDemoMode(!demoMode)} />
            </div>
            <nav aria-label="Primary" className="mt-3">
              <NavLinks />
            </nav>
          </div>
          <main id="content" className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
