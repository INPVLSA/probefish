"use client";

import { ReactNode } from "react";
import { Lock } from "lucide-react";
import type { BooleanFeature } from "@/lib/license/features";
import type { PlanTier } from "@/lib/license/types";

interface FeatureGateProps {
  feature: BooleanFeature;
  hasAccess: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  requiredPlan?: PlanTier;
}

const FEATURE_LABELS: Record<BooleanFeature, string> = {
  apiAccess: "API Access",
  webhooks: "Webhooks",
  sso: "SSO / SAML",
  auditLog: "Audit Logging",
  customBranding: "Custom Branding",
  advancedAnalytics: "Advanced Analytics",
  prioritySupport: "Priority Support",
};

const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

/**
 * FeatureGate component to conditionally render content based on feature access.
 *
 * Usage:
 * ```tsx
 * <FeatureGate feature="sso" hasAccess={features.sso}>
 *   <SSOSettings />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  hasAccess,
  children,
  fallback,
  requiredPlan = "pro",
}: FeatureGateProps) {
  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <Lock className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm font-medium mb-1">
        {FEATURE_LABELS[feature] || feature} is a {PLAN_LABELS[requiredPlan]} feature
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        Upgrade your plan to unlock this feature.
      </p>
      <a
        href="/settings/organization"
        className="text-sm text-primary hover:underline"
      >
        Manage License
      </a>
    </div>
  );
}

/**
 * Hook-style feature check for programmatic use.
 * Returns a function that throws FeatureNotAvailableError if feature is not available.
 */
export function createFeatureCheck(features: Record<BooleanFeature, boolean>) {
  return (feature: BooleanFeature): boolean => {
    return features[feature] ?? false;
  };
}

/**
 * Higher-order component to wrap a component with feature gating.
 */
export function withFeatureGate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  feature: BooleanFeature,
  requiredPlan: PlanTier = "pro"
) {
  return function FeatureGatedComponent(
    props: P & { hasAccess: boolean; fallback?: ReactNode }
  ) {
    const { hasAccess, fallback, ...rest } = props;

    return (
      <FeatureGate
        feature={feature}
        hasAccess={hasAccess}
        fallback={fallback}
        requiredPlan={requiredPlan}
      >
        <WrappedComponent {...(rest as P)} />
      </FeatureGate>
    );
  };
}
