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
import { Home, Folder, Settings, ChevronDown, FileText } from "lucide-react";
import { FishSymbolIcon, FishSymbolIconHandle } from "@/components/ui/fish-symbol";
import { cn } from "@/lib/utils";

interface Project {
  _id: string;
  name: string;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
];

const bottomNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const fishRef = useRef<FishSymbolIconHandle>(null);
  const [projects, setProjects] = useState<Project[]>([]);

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
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Button
                  variant={isActive(item.href) ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isActive(item.href) && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              </li>
            );
          })}

          {/* Projects Section */}
          <li>
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <Button
                  variant={pathname.startsWith("/projects") ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-between",
                    pathname.startsWith("/projects") && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <span className="flex items-center">
                    <Folder className="mr-2 h-4 w-4" />
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
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Button
                  variant={isActive(item.href) ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isActive(item.href) && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4">
        <p className="text-xs text-muted-foreground">Probefish v0.6.1</p>
      </div>
    </aside>
  );
}
