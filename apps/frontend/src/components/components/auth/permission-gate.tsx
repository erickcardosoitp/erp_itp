'use client';

import React from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/context/auth-context';

interface PermissionGateProps {
  children: React.ReactNode;
}

export function PermissionGate({ children }: PermissionGateProps) {
  const { user } = useAuth();
  const { canWrite } = usePermissions(user);

  if (!canWrite) return null;

  return <>{children}</>;
}