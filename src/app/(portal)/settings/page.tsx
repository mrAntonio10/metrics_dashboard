// src/app/(portal)/settings/page.tsx
'use client';

import React, { useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Key, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PortalUser = {
  name: string;
  email: string;
  role: 'Admin' | 'Finance' | 'Support';
};

const PORTAL_USERS: readonly PortalUser[] = [
  { name: 'Admin User',   email: 'admin@example.com',   role: 'Admin' },
  { name: 'Finance User', email: 'finance@example.com', role: 'Finance' },
  { name: 'Support Lead', email: 'support@example.com', role: 'Support' },
] as const;

export default function SettingsPage() {
  const { toast } = useToast();

  const handleInvite = useCallback(() => {
    toast({
      title: 'Invite Sent (Simulated)',
      description: 'In a real application, an invitation email would be sent.',
    });
  }, [toast]);

  return (
    <ProtectedComponent permissionKey="page:settings" fallback={<AccessDeniedFallback />}>
      <PageHeader title="Settings" description="Manage portal users, notifications, and API keys." />

      <div className="space-y-8">
        {/* Users & Roles */}
        <ProtectedComponent permissionKey="widget:portal_users">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Users &amp; Roles</CardTitle>
                  <CardDescription>Manage who has access to this portal.</CardDescription>
                </div>
                <ProtectedComponent permissionKey="action:invite_user">
                  <Button onClick={handleInvite} aria-label="Invite a new user">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Invite User
                  </Button>
                </ProtectedComponent>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PORTAL_USERS.map((user) => (
                    <TableRow key={user.email}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" disabled aria-disabled="true" aria-label={`Remove ${user.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </ProtectedComponent>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Manage your email notification preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="weekly-summary">Weekly Summary</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a summary of key metrics every Monday.
                </p>
              </div>
              <Switch id="weekly-summary" defaultChecked aria-label="Toggle weekly summary emails" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="incident-alerts">Incident Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about critical and major platform incidents.
                </p>
              </div>
              <Switch id="incident-alerts" aria-label="Toggle incident alert emails" />
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <ProtectedComponent permissionKey="widget:api_keys">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Scoped, non-PHI API keys for programmatic access to aggregate data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 rounded-lg border p-4 bg-muted/50">
                <Key className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <Input
                  readOnly
                  value="a1b2c3d4-****-****-****-************efgh"
                  className="font-mono"
                  aria-label="Read-only API key"
                />
                <span className="text-sm text-muted-foreground">Read-only</span>
                <Button variant="secondary" size="sm" disabled aria-disabled="true">
                  Revoke
                </Button>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" disabled aria-disabled="true">
                <PlusCircle className="mr-2 h-4 w-4" />
                Generate New Key
              </Button>
            </CardFooter>
          </Card>
        </ProtectedComponent>
      </div>
    </ProtectedComponent>
  );
}
