import { EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SuppressionBadgeProps {
  reason?: string;
  className?: string;
}

export function SuppressionBadge({ reason = 'cohort size < 5', className }: SuppressionBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 p-4 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <EyeOff className="h-6 w-6" />
              <span className="text-sm font-medium">Data Hidden for Privacy</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Data is suppressed when {reason}.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
