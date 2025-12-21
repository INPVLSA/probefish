import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import connectDB from "@/lib/db/mongodb";
import { User, Organization } from "@/lib/db/models";
import { verifyToken } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Building2, Users, Key, Mail, Shield, KeyRound } from "lucide-react";

async function getUserAndOrg() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  await connectDB();

  const user = await User.findById(payload.userId).select("-passwordHash");
  if (!user || user.organizationIds.length === 0) {
    return null;
  }

  // Get the first organization (primary org)
  const org = await Organization.findById(user.organizationIds[0]);
  if (!org) {
    return null;
  }

  // Get user's role in the org
  const member = org.members.find(
    (m: { userId: { toString: () => string } }) => m.userId.toString() === user._id.toString()
  );

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin || false,
    },
    organization: {
      id: org._id.toString(),
      name: org.name,
      slug: org.slug,
    },
    role: member?.role || "member",
  };
}

const settingsNav = [
  {
    href: "/settings/organization",
    label: "General",
    icon: Building2,
    requiredRole: ["owner", "admin"],
  },
  {
    href: "/settings/organization/members",
    label: "Members",
    icon: Users,
    requiredRole: ["owner", "admin"],
  },
  {
    href: "/settings/organization/invitations",
    label: "Invitations",
    icon: Mail,
    requiredRole: ["owner", "admin"],
  },
  {
    href: "/settings/organization/api-keys",
    label: "LLM API Keys",
    icon: Key,
    requiredRole: ["owner", "admin"],
  },
  {
    href: "/settings/tokens",
    label: "Access Tokens",
    icon: KeyRound,
    requiredRole: null, // Available to all users
  },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getUserAndOrg();

  if (!data) {
    redirect("/login");
  }

  const canManage = ["owner", "admin"].includes(data.role);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and preferences
        </p>
      </div>

      <div className="flex gap-6">
        <nav className="w-48 flex-shrink-0">
          <ul className="space-y-1">
            {settingsNav
              .filter(
                (item) =>
                  !item.requiredRole ||
                  item.requiredRole.includes(data.role) ||
                  data.user.isSuperAdmin
              )
              .map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            {data.user.isSuperAdmin && (
              <>
                <li className="pt-4 pb-2">
                  <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Super Admin
                  </span>
                </li>
                <li>
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                    All Users
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
