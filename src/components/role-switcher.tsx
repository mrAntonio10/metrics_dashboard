'use client';

import { useRole, ALL_ROLES, Role } from '@/contexts/role-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RoleSwitcher() {
  const { role, setRole } = useRole();

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground hidden md:inline">Viewing as:</span>
      <Select value={role} onValueChange={(value) => setRole(value as Role)}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          {ALL_ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
