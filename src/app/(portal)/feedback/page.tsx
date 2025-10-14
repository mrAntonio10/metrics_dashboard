'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { feedbackItems, organizations } from '@/lib/mock-data';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FeedbackItem } from '@/lib/types';
import { ArrowUp, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

export default function FeedbackPage() {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);

  const statusBadge = (status: FeedbackItem['status']) => {
    const variants = {
      open: 'bg-gray-100 text-gray-800 border-gray-200',
      planned: 'bg-blue-100 text-blue-800 border-blue-200',
      'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      shipped: 'bg-green-100 text-green-800 border-green-200',
    };
    return <Badge variant="outline" className={cn("capitalize", variants[status])}>{status.replace('-', ' ')}</Badge>;
  };

  if (selectedFeedback) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedFeedback(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to all feedback
        </Button>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{selectedFeedback.theme}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  {statusBadge(selectedFeedback.status)}
                  <span className="text-muted-foreground">From {selectedFeedback.organizationName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <Button variant="outline" size="sm" className="h-8">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <span>{selectedFeedback.votes} Votes</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This is a placeholder for the detailed feedback description, user comments, and internal notes.
              In a real application, you would fetch and display the full content related to this feedback item.
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">Feedback ID: {selectedFeedback.id}</p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <ProtectedComponent permissionKey="page:feedback" fallback={<AccessDeniedFallback />}>
      <PageHeader
        title="Feedback & Requests"
        description="View aggregated feature requests and themes from customers."
      >
        <Button disabled>Submit Feedback</Button>
      </PageHeader>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle>Top Feature Requests</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                      Filter by date...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="range" />
                  </PopoverContent>
                </Popover>
                <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                  </SelectContent>
                </Select>
                 <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by client..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {organizations.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Votes</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbackItems.sort((a,b) => b.votes - a.votes).map(item => (
                  <TableRow key={item.id} onClick={() => setSelectedFeedback(item)} className="cursor-pointer">
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <Button variant="outline" size="sm" className="h-8" disabled>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        {item.votes}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.theme}</TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.organizationName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ProtectedComponent>
  );
}
