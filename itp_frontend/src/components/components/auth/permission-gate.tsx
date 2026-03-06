'use client';

import React from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/context/auth-context';

interface PermissionGateProps {
  children: React.ReactNode;
}

export function PermissionGate({ children }: PermissionGateProps) {
  const { user } = useAuth(); // Pega a role globalmente do contexto
  const { canWrite } = usePermissions(user?.role);

  // Hierarquia em Árvore: Só renderiza se for Nível 8 (DRT) ou superior
  if (!canWrite) return null;

  return <>{children}</>;
}