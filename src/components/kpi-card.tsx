import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type KpiCardProps = {
  title: string;
  value: string;
  change?: number;
  changePeriod?: string;
  icon?: ReactNode;
  chart?: ReactNode;
  tooltip?: string;
  isLoading?: boolean;
};

export function KpiCard({ title, value, change, changePeriod = 'YoY', icon, chart, tooltip, isLoading }: KpiCardProps) {
  if (isLoading) {
    return <KpiCardSkeleton />;
  }
  
  const ChangeIndicator = () => {
    if (change === undefined) return null;

    const isPositive = change > 0;
    const isNeutral = change === 0;

    return (
      <div
        className={cn(
          'flex items-center gap-1 text-xs font-medium',
          isPositive ? 'text-green-600' : isNeutral ? 'text-muted-foreground' : 'text-red-600',
          'dark:text-green-400 dark:text-red-400'
        )}
      >
        {isPositive && <ArrowUp className="h-3 w-3" />}
        {isNeutral && <Minus className="h-3 w-3" />}
        {!isPositive && !isNeutral && <ArrowDown className="h-3 w-3" />}
        <span>{Math.abs(change)}% {changePeriod}</span>
      </div>
    );
  };
  
  const CardTitleWithTooltip = () => (
     <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        {title}
        {icon}
    </CardTitle>
  );

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
       {tooltip ? (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div><CardTitleWithTooltip /></div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
       ) : (
        <CardTitleWithTooltip />
       )}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
            <div className="flex flex-col">
                <div className="text-2xl font-bold">{value}</div>
                <ChangeIndicator />
            </div>
            {chart && <div className="h-10 w-24">{chart}</div>}
        </div>
      </CardContent>
    </Card>
  );
}


export function KpiCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-24" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                     <Skeleton className="h-10 w-24" />
                </div>
            </CardContent>
        </Card>
    )
}
