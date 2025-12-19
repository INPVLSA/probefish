import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import connectDB from "@/lib/db/mongodb";
import { User, Organization } from "@/lib/db/models";
import { verifyToken } from "@/lib/auth/session";

async function getUser() {
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
  if (!user) {
    return null;
  }

  const organizations = await Organization.find({
    _id: { $in: user.organizationIds },
  }).select("name slug");

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    },
    organizations: organizations.map((org) => ({
      id: org._id.toString(),
      name: org.name,
      slug: org.slug,
    })),
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getUser();

  if (!data) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav user={data.user} organizations={data.organizations} />
        <main className="flex-1 overflow-auto p-6 bg-default-50">
          {children}
        </main>
      </div>
    </div>
  );
}
