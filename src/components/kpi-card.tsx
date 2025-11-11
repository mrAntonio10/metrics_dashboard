import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type KpiCardProps = {
  title: string;
  value: string;
  /** Estos quedan opcionales pero ya no se usan para mostrar nada */
  change?: number;
  changePeriod?: string;
  icon?: ReactNode;
  chart?: ReactNode;
  tooltip?: string;
  isLoading?: boolean;
};

export function KpiCard({
  title,
  value,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  change,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  changePeriod = 'YoY',
  icon,
  chart,
  tooltip,
  isLoading,
}: KpiCardProps) {
  if (isLoading) {
    return <KpiCardSkeleton />;
  }

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
                <div>
                  <CardTitleWithTooltip />
                </div>
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
            {/* Ya no mostramos ChangeIndicator */}
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
            {/* Línea extra (tipo 0% YoY) también fuera */}
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
