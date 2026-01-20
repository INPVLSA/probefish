"use client";

import { useState, useEffect } from "react";
import { LicenseStatus } from "@/components/settings/LicenseStatus";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LicensePage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();

        if (data.organizations?.[0]?.id) {
          setOrgId(data.organizations[0].id);
        } else {
          toast.error("No organization found");
        }
      } catch {
        toast.error("Failed to load organization");
      } finally {
        setLoading(false);
      }
    }

    fetchOrg();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No organization found
      </div>
    );
  }

  return <LicenseStatus organizationId={orgId} />;
}
