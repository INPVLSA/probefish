"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, FileText, Github } from "lucide-react";
import { UsersIcon, UsersIconHandle } from "@/components/ui/users";
import { FishSymbolIcon, FishSymbolIconHandle } from "@/components/ui/fish-symbol";
import { HomeIcon, HomeIconHandle } from "@/components/ui/home";
import { FoldersIcon, FoldersIconHandle } from "@/components/ui/folders";
import { SettingsIcon, SettingsIconHandle } from "@/components/ui/settings";
import { cn } from "@/lib/utils";

interface Project {
  _id: string;
  name: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const fishRef = useRef<FishSymbolIconHandle>(null);
  const homeIconRef = useRef<HomeIconHandle>(null);
  const foldersIconRef = useRef<FoldersIconHandle>(null);
  const settingsIconRef = useRef<SettingsIconHandle>(null);
  const usersIconRef = useRef<UsersIconHandle>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    // Animate fish on page load
    const timer = setTimeout(() => {
      fishRef.current?.startAnimation();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Fetch projects for sidebar
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/projects?limit=10");
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        }
      } catch {
        // Ignore errors silently
      }
    };
    fetchProjects();

    // Fetch user info to check super admin status
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setIsSuperAdmin(data.user?.isSuperAdmin || false);
        }
      } catch {
        // Ignore errors silently
      }
    };
    fetchUser();
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isProjectActive = (projectId: string) => {
    return pathname.startsWith(`/projects/${projectId}`);
  };

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FishSymbolIcon ref={fishRef} size={20} className="text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">Probefish</span>
        </Link>
      </div>

      <Separator />

      <nav className="flex-1 p-2 overflow-y-auto">
        <ul className="space-y-1">
          {/* Dashboard */}
          <li>
            <Button
              variant={isActive("/") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start px-3",
                isActive("/") && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              asChild
              onMouseEnter={() => homeIconRef.current?.startAnimation()}
              onMouseLeave={() => homeIconRef.current?.stopAnimation()}
            >
              <Link href="/">
                <HomeIcon ref={homeIconRef} size={16} className="size-4" />
                Dashboard
              </Link>
            </Button>
          </li>

          {/* Projects Section */}
          <li>
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <Button
                  variant={pathname.startsWith("/projects") ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-between px-3",
                    pathname.startsWith("/projects") && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                  onMouseEnter={() => foldersIconRef.current?.startAnimation()}
                  onMouseLeave={() => foldersIconRef.current?.stopAnimation()}
                >
                  <span className="flex items-center gap-2">
                    <FoldersIcon ref={foldersIconRef} size={16} className="size-4" />
                    Projects
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 mt-1">
                <ul className="space-y-1">
                  <li>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground hover:text-foreground"
                      asChild
                    >
                      <Link href="/projects">
                        All Projects
                      </Link>
                    </Button>
                  </li>
                  {projects.map((project) => (
                    <li key={project._id}>
                      <Button
                        variant={isProjectActive(project._id) ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "w-full justify-start truncate",
                          isProjectActive(project._id) && "bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                        asChild
                      >
                        <Link href={`/projects/${project._id}`}>
                          <FileText className="mr-2 h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{project.name}</span>
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </li>
        </ul>
      </nav>

      <Separator />

      <div className="p-2">
        <ul className="space-y-1">
          {isSuperAdmin && (
            <li>
              <Button
                variant={isActive("/admin/users") ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start px-3",
                  isActive("/admin/users") && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
                asChild
                onMouseEnter={() => usersIconRef.current?.startAnimation()}
                onMouseLeave={() => usersIconRef.current?.stopAnimation()}
              >
                <Link href="/admin/users">
                  <UsersIcon ref={usersIconRef} size={16} className="size-4" />
                  All Users
                </Link>
              </Button>
            </li>
          )}
          <li>
            <Button
              variant={isActive("/settings") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start px-3",
                isActive("/settings") && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              asChild
              onMouseEnter={() => settingsIconRef.current?.startAnimation()}
              onMouseLeave={() => settingsIconRef.current?.stopAnimation()}
            >
              <Link href="/settings">
                <SettingsIcon ref={settingsIconRef} size={16} className="size-4" />
                Settings
              </Link>
            </Button>
          </li>
        </ul>
      </div>

      <div className="p-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Probefish v{process.env.APP_VERSION} ({process.env.APP_CODENAME})</p>
        <Link
          href="https://github.com/INPVLSA/probefish"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Github className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}
