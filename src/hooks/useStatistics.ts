'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

export type StatisticsData = {
  totalShifts: number;
  totalHours: number;
  shiftsByType: Array<{ typeName: string; count: number; hours: number; color: string }>;
  shiftsByUser: Array<{ userId: string; userName: string; count: number; hours: number }>;
  shiftsByDayOfWeek: Array<{ day: string; count: number; hours: number }>;
  shiftsByDate: Array<{ date: string; count: number; hours: number }>;
  requestsStats: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
};

export type UseStatisticsResult = {
  data: StatisticsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Hook para obtener estadísticas de turnos y guardias en un período determinado.
 */
export function useStatistics(orgId: string | null, startDate: Date, endDate: Date, userId?: string | null): UseStatisticsResult {
  const [data, setData] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = useCallback(async () => {
    if (!orgId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      // Query base para turnos
      let shiftsQuery = supabase
        .from('shifts')
        .select(
          `id, start_at, end_at, assigned_user_id, status, shift_type_id,
           organization_shift_types (id, name, letter, color)`
        )
        .eq('org_id', orgId)
        .gte('start_at', startISO)
        .lte('start_at', endISO)
        .eq('status', 'published');

      // Filtrar por usuario si se especifica
      if (userId) {
        shiftsQuery = shiftsQuery.eq('assigned_user_id', userId);
      }

      const { data: shifts, error: shiftsError } = await shiftsQuery;

      if (shiftsError) {
        throw new Error(shiftsError.message);
      }

      const shiftsList = (shifts ?? []) as Array<{
        id: string;
        start_at: string;
        end_at: string;
        assigned_user_id: string | null;
        status: string;
        shift_type_id: string;
        organization_shift_types: {
          id: string;
          name: string;
          letter: string;
          color: string;
        } | null;
      }>;

      // Calcular horas totales
      let totalHours = 0;
      shiftsList.forEach((shift) => {
        const start = new Date(shift.start_at);
        const end = new Date(shift.end_at);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      });

      // Estadísticas por tipo de turno
      const shiftsByTypeMap = new Map<string, { count: number; hours: number; color: string; name: string }>();
      shiftsList.forEach((shift) => {
        const typeName = shift.organization_shift_types?.name ?? 'Sin tipo';
        const color = shift.organization_shift_types?.color ?? '#666666';
        const start = new Date(shift.start_at);
        const end = new Date(shift.end_at);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

        const existing = shiftsByTypeMap.get(typeName) ?? { count: 0, hours: 0, color, name: typeName };
        existing.count += 1;
        existing.hours += hours;
        shiftsByTypeMap.set(typeName, existing);
      });
      const shiftsByType = Array.from(shiftsByTypeMap.values()).map((v) => ({
        typeName: v.name,
        count: v.count,
        hours: Math.round(v.hours * 10) / 10,
        color: v.color,
      }));

      // Estadísticas por usuario
      const shiftsByUserMap = new Map<string, { count: number; hours: number; userId: string }>();
      const userIds = new Set<string>();
      shiftsList.forEach((shift) => {
        if (shift.assigned_user_id) {
          userIds.add(shift.assigned_user_id);
          const start = new Date(shift.start_at);
          const end = new Date(shift.end_at);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

          const existing = shiftsByUserMap.get(shift.assigned_user_id) ?? { count: 0, hours: 0, userId: shift.assigned_user_id };
          existing.count += 1;
          existing.hours += hours;
          shiftsByUserMap.set(shift.assigned_user_id, existing);
        }
      });

      // Obtener nombres de usuarios
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(userIds));

      const profilesMap = new Map<string, string>();
      (profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
        profilesMap.set(p.id, p.full_name ?? 'Sin nombre');
      });

      const shiftsByUser = Array.from(shiftsByUserMap.entries())
        .map(([userId, stats]) => ({
          userId,
          userName: profilesMap.get(userId) ?? 'Usuario desconocido',
          count: stats.count,
          hours: Math.round(stats.hours * 10) / 10,
        }))
        .sort((a, b) => b.hours - a.hours);

      // Estadísticas por día de la semana
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const shiftsByDayOfWeekMap = new Map<number, { count: number; hours: number }>();
      shiftsList.forEach((shift) => {
        const start = new Date(shift.start_at);
        const dayOfWeek = start.getDay();
        const end = new Date(shift.end_at);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

        const existing = shiftsByDayOfWeekMap.get(dayOfWeek) ?? { count: 0, hours: 0 };
        existing.count += 1;
        existing.hours += hours;
        shiftsByDayOfWeekMap.set(dayOfWeek, existing);
      });
      const shiftsByDayOfWeek = Array.from({ length: 7 }, (_, i) => ({
        day: dayNames[i],
        count: shiftsByDayOfWeekMap.get(i)?.count ?? 0,
        hours: Math.round((shiftsByDayOfWeekMap.get(i)?.hours ?? 0) * 10) / 10,
      }));

      // Estadísticas por fecha (diaria)
      const shiftsByDateMap = new Map<string, { count: number; hours: number }>();
      shiftsList.forEach((shift) => {
        const start = new Date(shift.start_at);
        const dateKey = start.toISOString().split('T')[0];
        const end = new Date(shift.end_at);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

        const existing = shiftsByDateMap.get(dateKey) ?? { count: 0, hours: 0 };
        existing.count += 1;
        existing.hours += hours;
        shiftsByDateMap.set(dateKey, existing);
      });
      const shiftsByDate = Array.from(shiftsByDateMap.entries())
        .map(([date, stats]) => ({
          date,
          count: stats.count,
          hours: Math.round(stats.hours * 10) / 10,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Estadísticas de solicitudes
      let requestsQuery = supabase
        .from('shift_requests')
        .select('id, status')
        .eq('org_id', orgId)
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      if (userId) {
        requestsQuery = requestsQuery.eq('requester_id', userId);
      }

      const { data: requests, error: requestsError } = await requestsQuery;

      if (requestsError) {
        console.warn('Error fetching requests:', requestsError);
      }

      const requestsList = (requests ?? []) as Array<{ id: string; status: string }>;
      const requestsStats = {
        total: requestsList.length,
        approved: requestsList.filter((r) => r.status === 'approved').length,
        rejected: requestsList.filter((r) => r.status === 'rejected').length,
        pending: requestsList.filter((r) => r.status === 'submitted' || r.status === 'draft').length,
      };

      setData({
        totalShifts: shiftsList.length,
        totalHours: Math.round(totalHours * 10) / 10,
        shiftsByType,
        shiftsByUser,
        shiftsByDayOfWeek,
        shiftsByDate,
        requestsStats,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar estadísticas';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, startDate, endDate, userId]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchStatistics,
  };
}
