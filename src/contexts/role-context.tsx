'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

export type Role = 'OWNER' | 'FINANCE' | 'SUPPORT' | 'CSM' | 'ADMIN';

export const ALL_ROLES: Role[] = ['OWNER', 'FINANCE', 'SUPPORT', 'CSM', 'ADMIN'];

type RoleContextType = {
  role: Role;
  setRole: (role: Role) => void;
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('OWNER');

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
