"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Send,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  createdAt: string;
  invitedBy?: {
    name: string;
    email: string;
  } | null;
  message?: string;
}

const statusConfig = {
  pending: { label: "Pending", icon: Clock, variant: "outline" as const },
  accepted: { label: "Accepted", icon: CheckCircle, variant: "default" as const },
  expired: { label: "Expired", icon: XCircle, variant: "secondary" as const },
  revoked: { label: "Revoked", icon: X, variant: "destructive" as const },
};

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();

      if (!meData.organizations?.[0]?.id) {
        toast.error("No organization found");
        setLoading(false);
        return;
      }

      const id = meData.organizations[0].id;
      setOrgId(id);

      const res = await fetch(`/api/organizations/${id}/invitations`);
      const data = await res.json();

      if (res.ok) {
        setInvitations(data.invitations);
      } else {
        toast.error(data.error || "Failed to load invitations");
      }
    } catch {
      toast.error("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!orgId || !email) return;

    setSending(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, message: message || undefined }),
      });

      const data = await res.json();

      if (res.ok) {
        setInvitations([data.invitation, ...invitations]);
        setEmail("");
        setRole("member");
        setMessage("");
        setDialogOpen(false);
        toast.success(`Invitation sent to ${email}`);
      } else {
        toast.error(data.error || "Failed to send invitation");
      }
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setSending(false);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    if (!orgId) return;

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/invitations/${invitationId}`,
        { method: "POST" }
      );

      const data = await res.json();

      if (res.ok) {
        setInvitations(
          invitations.map((inv) =>
            inv.id === invitationId
              ? { ...inv, expiresAt: data.invitation.expiresAt }
              : inv
          )
        );
        toast.success("Invitation resent");
      } else {
        toast.error(data.error || "Failed to resend invitation");
      }
    } catch {
      toast.error("Failed to resend invitation");
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!orgId) return;

    try {
      const res = await fetch(
        `/api/organizations/${orgId}/invitations/${invitationId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setInvitations(
          invitations.map((inv) =>
            inv.id === invitationId ? { ...inv, status: "revoked" as const } : inv
          )
        );
        toast.success("Invitation revoked");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to revoke invitation");
      }
    } catch {
      toast.error("Failed to revoke invitation");
    }
  };

  const copyInviteLink = (invitationId: string) => {
    // Find the invitation to get the token
    const invitation = invitations.find((i) => i.id === invitationId);
    if (!invitation) return;

    // Note: In a real app, you'd need the token. For now, construct from ID
    const url = `${window.location.origin}/invite/${invitationId}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingInvitations = invitations.filter((i) => i.status === "pending");
  const pastInvitations = invitations.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>
              Invite people to join your organization
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New Member</DialogTitle>
                <DialogDescription>
                  Send an invitation email to add someone to your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Add a personal note to the invitation..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendInvitation} disabled={!email || sending}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {pendingInvitations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => {
                  const isExpired = new Date(invitation.expiresAt) < new Date();
                  return (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invitation.email}</div>
                          <div className="text-xs text-muted-foreground">
                            Invited by {invitation.invitedBy?.name || "Unknown"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            isExpired ? "text-destructive" : "text-muted-foreground"
                          }
                        >
                          {isExpired
                            ? "Expired"
                            : formatDistanceToNow(new Date(invitation.expiresAt), {
                                addSuffix: true,
                              })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvitation(invitation.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(invitation.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <X className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to revoke the invitation for{" "}
                                  {invitation.email}? They will no longer be able to join.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRevokeInvitation(invitation.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No pending invitations
            </div>
          )}
        </CardContent>
      </Card>

      {pastInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitation History</CardTitle>
            <CardDescription>Past invitations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastInvitations.map((invitation) => {
                  const StatusIcon = statusConfig[invitation.status].icon;
                  return (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="font-medium">{invitation.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[invitation.status].variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[invitation.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(invitation.createdAt), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
