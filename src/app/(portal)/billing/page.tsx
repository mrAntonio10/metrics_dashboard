'use client';

import { useState } from 'react';
import { Download, ChevronDown, Users, Briefcase, BrainCircuit } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { invoices, arAgingData, organizations } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ProtectedComponent, AccessDeniedFallback } from '@/hooks/use-permission';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/lib/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TimeRangeFilter } from '@/components/time-range-filter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";


export default function BillingPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const { toast } = useToast();
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [showClientList, setShowClientList] = useState(false);

  const handleExport = () => {
    toast({
      title: "Export Initiated",
      description: "A secure link will be generated shortly.",
    });
  };

  const getOrgStatus = (orgId: string) => {
    return organizations.find(org => org.id === orgId)?.status || 'unknown';
  }

  const statusBadge = (status: Invoice['status']) => {
    const variants = {
      paid: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
      overdue: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
      dunning: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
    };
    return <Badge variant="outline" className={cn("capitalize", variants[status])}>{status}</Badge>;
  };
  
  const orgStatusBadge = (status: string) => {
    const variants: { [key: string]: string } = {
      active: 'bg-blue-100 text-blue-800 border-blue-200',
      trial: 'bg-purple-100 text-purple-800 border-purple-200',
      churned: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return <Badge variant="outline" className={cn("capitalize", variants[status])}>{status === 'trial' ? 'Activo en Trial' : status}</Badge>;
  };


  return (
    <ProtectedComponent permissionKey="page:billing" fallback={<AccessDeniedFallback />}>
       <Dialog open={showClientList} onOpenChange={setShowClientList}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clientes por Categoría</DialogTitle>
            <DialogDescription>
              Lista de clientes clasificados en diferentes categorías.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Arte</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Galería de Arte Moderno</li>
                <li>Estudio de Fotografía Creativa</li>
                <li>Colectivo de Muralistas Urbanos</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Música</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Festival de Jazz Independiente</li>
                <li>Orquesta Sinfónica de la Ciudad</li>
                <li>Sello Discográfico Indie Pop</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <PageHeader
        title="Billing & Revenue"
        description="Review invoices, AR aging, and collections."
      >
        <div className="flex items-center gap-2">
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
            <Button variant="secondary" onClick={() => setShowClientList(true)}>Clasificar Clientes</Button>
            <ProtectedComponent permissionKey="action:export_data">
                <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
            </ProtectedComponent>
        </div>
      </PageHeader>
      
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
            <ProtectedComponent permissionKey="widget:ar_aging" fallback={<AccessDeniedFallback />}>
              <Card className="lg:col-span-3">
                  <CardHeader>
                      <CardTitle>AR Aging Buckets</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <ChartContainer config={{}} className="h-64">
                          <BarChart data={arAgingData} layout="vertical" margin={{ left: 10 }}>
                              <CartesianGrid horizontal={false} />
                              <XAxis type="number" tickFormatter={(value) => `$${value/1000}k`} />
                              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={80}/>
                              <ChartTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
                              <Bar dataKey="value" radius={4} fill="var(--color-chart-1)" />
                          </BarChart>
                      </ChartContainer>
                  </CardContent>
              </Card>
            </ProtectedComponent>
            
            <ProtectedComponent permissionKey="widget:dunning_pipeline" fallback={<AccessDeniedFallback />}>
              <Card className="lg:col-span-2">
                  <CardHeader>
                      <CardTitle>Dunning Pipeline</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                      <div className="flex justify-between items-baseline">
                          <span className="text-muted-foreground">Overdue Invoices</span>
                          <span className="font-bold text-lg">2</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                          <span className="text-muted-foreground">In Dunning</span>
                          <span className="font-bold text-lg">1</span>
                      </div>
                       <div className="flex justify-between items-baseline">
                          <span className="text-muted-foreground">Total At-Risk</span>
                          <span className="font-bold text-lg text-destructive">$3,000</span>
                      </div>
                       <div className="flex justify-between items-baseline">
                          <span className="text-muted-foreground">Recovered (Last 30d)</span>
                          <span className="font-bold text-lg text-green-600">$4,500</span>
                      </div>
                  </CardContent>
              </Card>
            </ProtectedComponent>
        </div>
        
        <ProtectedComponent permissionKey="widget:invoices" fallback={<AccessDeniedFallback />}>
          <Card>
              <CardHeader>
                  <CardTitle>Recent Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Invoice ID</TableHead>
                              <TableHead>Organization</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Account Status</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {invoices.map((invoice) => (
                            <Collapsible asChild key={invoice.id} open={openInvoice === invoice.id} onOpenChange={() => setOpenInvoice(openInvoice === invoice.id ? null : invoice.id)}>
                              <>
                                <TableRow className="hover:bg-muted/50 cursor-pointer">
                                  <TableCell className="font-medium">{invoice.id}</TableCell>
                                  <TableCell>{invoice.organizationName}</TableCell>
                                  <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoice.amount)}</TableCell>
                                  <TableCell>{invoice.dueDate.toLocaleDateString()}</TableCell>
                                  <TableCell>{statusBadge(invoice.status)}</TableCell>
                                  <TableCell>{orgStatusBadge(getOrgStatus(invoice.organizationId))}</TableCell>
                                  <TableCell>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <ChevronDown className={cn("h-4 w-4 transition-transform", openInvoice === invoice.id && "rotate-180")} />
                                      </Button>
                                    </CollapsibleTrigger>
                                  </TableCell>
                                </TableRow>
                                <CollapsibleContent asChild>
                                  <TableRow>
                                    <TableCell colSpan={7} className="p-0">
                                      <div className="p-6 bg-muted/50">
                                        <h4 className="font-semibold mb-4">Invoice Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                          <Card>
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                              <CardTitle className="text-sm font-medium">Clinical Seats</CardTitle>
                                              <Users className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                              <div className="text-2xl font-bold">25</div>
                                              <p className="text-xs text-muted-foreground">@ $100 / seat</p>
                                            </CardContent>
                                          </Card>
                                          <Card>
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                              <CardTitle className="text-sm font-medium">Admin Seats</CardTitle>
                                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                              <div className="text-2xl font-bold">5</div>
                                              <p className="text-xs text-muted-foreground">@ $50 / seat</p>
                                            </CardContent>
                                          </Card>
                                           <Card>
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                              <CardTitle className="text-sm font-medium">API Usage</CardTitle>
                                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><path d="M10 20v-6m0 0V4m0 10h4m0 0V4m0 10h-4m8 6v-2m0 0V4m0 14h2m0 0V4m0 14h-2m-8 6v-4m0 0V4m0 12h4m0 0V4m0 12h-4"/></svg>
                                            </CardHeader>
                                            <CardContent>
                                              <div className="text-2xl font-bold">1.2M Calls</div>
                                              <p className="text-xs text-muted-foreground">@ $0.001 / call</p>
                                            </CardContent>
                                          </Card>
                                          <Card>
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                              <CardTitle className="text-sm font-medium">UniqMind Pro</CardTitle>
                                              <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                              <div className="text-2xl font-bold">1</div>
                                              <p className="text-xs text-muted-foreground">@ $1,000 / month</p>
                                            </CardContent>
                                          </Card>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                </CollapsibleContent>
                              </>
                            </Collapsible>
                          ))}
                      </TableBody>
                  </Table>
              </CardContent>
          </Card>
        </ProtectedComponent>
      </div>
    </ProtectedComponent>
  );
}
