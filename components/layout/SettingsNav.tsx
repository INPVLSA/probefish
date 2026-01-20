"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Building2, Users, Key, Mail, KeyRound, Shield } from "lucide-react";

const iconMap = {
  Building2,
  Users,
  Key,
  Mail,
  KeyRound,
  Shield,
} as const;

type IconName = keyof typeof iconMap;

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

interface SettingsNavProps {
  items: NavItem[];
}

export function SettingsNav({ items }: SettingsNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href;
  };

  return (
    <nav className="w-48 flex-shrink-0">
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors",
                  isActive(item.href) && "bg-accent text-accent-foreground font-medium"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
