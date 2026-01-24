'use client';

import { InvitationsList } from '@/components/invitations/InvitationsList';
import { InviteUserForm } from '@/components/invitations/InviteUserForm';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Team = { id: string; name: string; slug: string | null };

export default function AdminInvitePage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: memberships } = await supabase
        .from('memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .in('role', ['org_admin', 'superadmin']);
      const oid = memberships?.[0]?.org_id ?? null;
      setOrgId(oid ?? null);
      if (oid) {
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name, slug')
          .eq('org_id', oid)
          .order('name');
        setTeams((teamsData ?? []) as Team[]);
      }
      setLoading(false);
    };
    run();
  }, []);

  const onInviteSuccess = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (loading) return <p className="text-muted">Cargando…</p>;
  if (!orgId) {
    return (
      <div>
        <p className="text-text-secondary">No tienes permisos para invitar usuarios. Debes ser administrador de una organización.</p>
        <Link href="/dashboard/admin" className="mt-2 inline-block text-primary-600 hover:text-primary-700">Volver a Admin</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/admin" className="text-sm text-primary-600 hover:text-primary-700">← Admin</Link>
        <h1 className="mt-2 text-xl font-semibold text-text-primary">Invitar usuarios</h1>
        <p className="mt-1 text-sm text-text-secondary">Crea invitaciones por correo y comparte el enlace. El enlace expira en 7 días.</p>
      </div>
      <InviteUserForm orgId={orgId} teams={teams} onSuccess={onInviteSuccess} />
      <div>
        <h2 className="mb-2 text-lg font-semibold text-text-primary">Invitaciones</h2>
        <InvitationsList orgId={orgId} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
