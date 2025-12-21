"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Search,
  Shield,
  ShieldOff,
  ChevronLeft,
  ChevronRight,
  Ban,
  CircleSlash,
} from "lucide-react";
import { DeleteIcon } from "@/components/ui/delete";
import { format } from "date-fns";

interface User {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  isBlocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  organizationCount: number;
  createdAt: string;
  lastLoginAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantingUserId, setGrantingUserId] = useState<string | null>(null);
  const [grantPassword, setGrantPassword] = useState("");
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchUsers();
    }
  }, [pagination.page, currentUserId]);

  const checkAccess = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();

      if (!data.user?.isSuperAdmin) {
        toast.error("Access denied. Super admin required.");
        router.push("/");
        return;
      }

      setCurrentUserId(data.user.id);
    } catch {
      toast.error("Failed to verify access");
      router.push("/");
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) {
        params.set("search", search);
      }

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();

      if (res.ok) {
        setUsers(data.users);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Failed to load users");
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    setSearchTimeout(
      setTimeout(() => {
        setPagination((prev) => ({ ...prev, page: 1 }));
        fetchUsers();
      }, 300)
    );
  };

  const openGrantDialog = (userId: string) => {
    setGrantingUserId(userId);
    setGrantPassword("");
    setGrantDialogOpen(true);
  };

  const handleGrantSuperAdmin = async () => {
    if (!grantingUserId || !grantPassword) return;

    setGranting(true);
    try {
      const res = await fetch(`/api/admin/users/${grantingUserId}/super-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: grantPassword }),
      });

      if (res.ok) {
        setUsers(
          users.map((u) =>
            u.id === grantingUserId ? { ...u, isSuperAdmin: true } : u
          )
        );
        toast.success("Super admin granted");
        setGrantDialogOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to grant super admin");
      }
    } catch {
      toast.error("Failed to grant super admin");
    } finally {
      setGranting(false);
      setGrantPassword("");
    }
  };

  const handleRevokeSuperAdmin = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/super-admin`, {
        method: "DELETE",
      });

      if (res.ok) {
        setUsers(
          users.map((u) =>
            u.id === userId ? { ...u, isSuperAdmin: false } : u
          )
        );
        toast.success("Super admin revoked");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to revoke super admin");
      }
    } catch {
      toast.error("Failed to revoke super admin");
    }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setUsers(
          users.map((u) =>
            u.id === userId ? { ...u, isBlocked: true } : u
          )
        );
        toast.success("User blocked");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to block user");
      }
    } catch {
      toast.error("Failed to block user");
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: "DELETE",
      });

      if (res.ok) {
        setUsers(
          users.map((u) =>
            u.id === userId ? { ...u, isBlocked: false } : u
          )
        );
        toast.success("User unblocked");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to unblock user");
      }
    } catch {
      toast.error("Failed to unblock user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setUsers(users.filter((u) => u.id !== userId));
        toast.success("User deleted");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete user");
      }
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Manage all users in the platform (Super Admin only)
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                {pagination.total} total users
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Organizations</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isCurrentUser = user.id === currentUserId;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {user.name}
                            {isCurrentUser && (
                              <span className="text-muted-foreground ml-2">(you)</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.isSuperAdmin ? (
                          <Badge variant="default" className="gap-1 w-fit">
                            <Shield className="h-3 w-3" />
                            Super Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="w-fit">User</Badge>
                        )}
                        {user.isBlocked && (
                          <Badge variant="destructive" className="gap-1 w-fit">
                            <Ban className="h-3 w-3" />
                            Blocked
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.organizationCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), "MMM d, yyyy")
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {!isCurrentUser && (
                        <div className="flex gap-1">
                          {/* Super Admin Toggle */}
                          {user.isSuperAdmin ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  title="Revoke super admin"
                                >
                                  <ShieldOff className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Revoke Super Admin
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to revoke super admin
                                    privileges from {user.name}? They will lose
                                    access to this admin panel.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRevokeSuperAdmin(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Revoke
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openGrantDialog(user.id)}
                              title="Grant super admin"
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Block/Unblock Toggle */}
                          {user.isBlocked ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600"
                                  title="Unblock user"
                                >
                                  <CircleSlash className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Unblock User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to unblock {user.name}?
                                    They will be able to log in again.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleUnblockUser(user.id)}>
                                    Unblock
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-amber-600"
                                  title="Block user"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Block User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to block {user.name}?
                                    They will not be able to log in until unblocked.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleBlockUser(user.id)}
                                    className="bg-amber-600 hover:bg-amber-700"
                                  >
                                    Block
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {/* Delete User */}
                          {!user.isSuperAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  title="Delete user"
                                >
                                  <DeleteIcon size={16} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {user.name}?
                                    This action cannot be undone. The user will be
                                    removed from all organizations.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No users found matching your search" : "No users found"}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grant Super Admin Dialog with Password */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Super Admin</DialogTitle>
            <DialogDescription>
              {grantingUserId && (
                <>
                  You are about to grant super admin privileges to{" "}
                  <strong>{users.find(u => u.id === grantingUserId)?.name}</strong>.
                  They will have full access to manage all users and settings.
                  <br /><br />
                  Enter your password to confirm this action.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Your Password</Label>
              <Input
                id="password"
                type="password"
                value={grantPassword}
                onChange={(e) => setGrantPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGrantDialogOpen(false)}
              disabled={granting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGrantSuperAdmin}
              disabled={granting || !grantPassword}
            >
              {granting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Granting...
                </>
              ) : (
                "Grant Super Admin"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
