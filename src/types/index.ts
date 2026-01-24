/**
 * Tipos de dominio Turnia
 * types/supabase.ts se genera con: npm run supabase:gen
 */

export type { Role, MembershipRow } from '@/lib/rbac';

export type ShiftType = 'day' | 'night' | '24h' | 'custom';
export type ShiftStatus = 'draft' | 'published';

export type RequestType = 'give_away' | 'swap' | 'take_open';
export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'approved'
  | 'rejected'
  | 'cancelled';
