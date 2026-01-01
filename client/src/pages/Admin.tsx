import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  CreditCard, 
  BarChart3, 
  Bell, 
  Loader2, 
  Plus, 
  Trash2, 
  Edit,
  Crown,
  Bot,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  subscriptionTier: string;
  subscriptionExpiry: string | null;
  createdAt: string;
  isAdmin: boolean;
}

interface AdminStats {
  totalUsers: number;
  activeBotsCount: number;
  totalTrades: number;
  subscriptionCounts: Record<string, number>;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

export default function Admin() {
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "", isActive: true });
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: users, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/admin/announcements"],
  });

  const updateSubscription = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/subscription`, { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: async (data: { title: string; content: string; isActive: boolean }) => {
      return apiRequest("POST", "/api/admin/announcements", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      setNewAnnouncement({ title: "", content: "", isActive: true });
      setIsDialogOpen(false);
    },
  });

  const updateAnnouncement = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; title?: string; content?: string; isActive?: boolean }) => {
      return apiRequest("PATCH", `/api/admin/announcements/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      setEditingAnnouncement(null);
    },
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
    },
  });

  const tierColors: Record<string, string> = {
    free: "bg-gray-500/10 text-gray-500",
    pro: "bg-blue-500/10 text-blue-500",
    premium: "bg-yellow-500/10 text-yellow-500",
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <Crown className="w-8 h-8 text-yellow-500" />
          관리자 페이지
        </h1>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <Users className="w-4 h-4" /> 사용자
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-2" data-testid="tab-subscriptions">
              <CreditCard className="w-4 h-4" /> 구독
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2" data-testid="tab-stats">
              <BarChart3 className="w-4 h-4" /> 통계
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex items-center gap-2" data-testid="tab-announcements">
              <Bell className="w-4 h-4" /> 공지
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  사용자 관리
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">이메일</th>
                          <th className="text-left py-3 px-2">이름</th>
                          <th className="text-left py-3 px-2">구독</th>
                          <th className="text-left py-3 px-2">가입일</th>
                          <th className="text-left py-3 px-2">역할</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users?.map((user) => (
                          <tr key={user.id} className="border-b border-border/50" data-testid={`row-user-${user.id}`}>
                            <td className="py-3 px-2">{user.email}</td>
                            <td className="py-3 px-2">{user.displayName || "-"}</td>
                            <td className="py-3 px-2">
                              <Badge className={tierColors[user.subscriptionTier]}>
                                {user.subscriptionTier.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-muted-foreground">
                              {user.createdAt ? format(new Date(user.createdAt), "yyyy-MM-dd") : "-"}
                            </td>
                            <td className="py-3 px-2">
                              {user.isAdmin && <Badge className="bg-red-500/10 text-red-500">Admin</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  구독 관리
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">이메일</th>
                          <th className="text-left py-3 px-2">현재 구독</th>
                          <th className="text-left py-3 px-2">구독 변경</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users?.map((user) => (
                          <tr key={user.id} className="border-b border-border/50" data-testid={`row-subscription-${user.id}`}>
                            <td className="py-3 px-2">{user.email}</td>
                            <td className="py-3 px-2">
                              <Badge className={tierColors[user.subscriptionTier]}>
                                {user.subscriptionTier.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-3 px-2">
                              <Select
                                defaultValue={user.subscriptionTier}
                                onValueChange={(value) => updateSubscription.mutate({ userId: user.id, tier: value })}
                              >
                                <SelectTrigger className="w-32" data-testid={`select-tier-${user.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="free">Free</SelectItem>
                                  <SelectItem value="pro">Pro</SelectItem>
                                  <SelectItem value="premium">Premium</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">전체 사용자</CardTitle>
                  <Users className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-users">
                    {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.totalUsers || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">활성 봇</CardTitle>
                  <Bot className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-active-bots">
                    {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.activeBotsCount || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">총 거래 수</CardTitle>
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-trades">
                    {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.totalTrades || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">구독 현황</CardTitle>
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <div className="space-y-1" data-testid="stat-subscriptions">
                      <div className="flex justify-between text-sm">
                        <span>Free:</span>
                        <span>{stats?.subscriptionCounts?.free || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Pro:</span>
                        <span>{stats?.subscriptionCounts?.pro || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Premium:</span>
                        <span>{stats?.subscriptionCounts?.premium || 0}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="announcements">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  공지사항 관리
                </CardTitle>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-new-announcement">
                      <Plus className="w-4 h-4 mr-1" /> 새 공지
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>새 공지사항</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">제목</Label>
                        <Input
                          id="title"
                          value={newAnnouncement.title}
                          onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                          data-testid="input-announcement-title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="content">내용</Label>
                        <Textarea
                          id="content"
                          value={newAnnouncement.content}
                          onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                          rows={4}
                          data-testid="input-announcement-content"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={newAnnouncement.isActive}
                          onCheckedChange={(checked) => setNewAnnouncement({ ...newAnnouncement, isActive: checked })}
                          data-testid="switch-announcement-active"
                        />
                        <Label>활성화</Label>
                      </div>
                      <Button
                        onClick={() => createAnnouncement.mutate(newAnnouncement)}
                        disabled={createAnnouncement.isPending || !newAnnouncement.title || !newAnnouncement.content}
                        data-testid="button-create-announcement"
                      >
                        {createAnnouncement.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        등록
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {announcementsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : announcements?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    등록된 공지사항이 없습니다
                  </div>
                ) : (
                  <div className="space-y-4">
                    {announcements?.map((announcement) => (
                      <div
                        key={announcement.id}
                        className="p-4 border rounded-md"
                        data-testid={`announcement-${announcement.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{announcement.title}</h3>
                              <Badge className={announcement.isActive ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"}>
                                {announcement.isActive ? "활성" : "비활성"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{announcement.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {announcement.createdAt ? format(new Date(announcement.createdAt), "yyyy-MM-dd HH:mm") : ""}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateAnnouncement.mutate({ id: announcement.id, isActive: !announcement.isActive })}
                              data-testid={`button-toggle-${announcement.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteAnnouncement.mutate(announcement.id)}
                              data-testid={`button-delete-${announcement.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
