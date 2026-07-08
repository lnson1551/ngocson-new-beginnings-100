import { AppData } from '../domain/types';
import { supabase } from './client';

export const APP_DATA_TABLE = 'app_data';

export type RemoteAppDataRow = {
  user_id: string;
  data: AppData;
  updated_at: string;
};

export async function fetchRemoteAppData(userId: string) {
  if (!supabase) return { data: undefined, error: new Error('Supabase chưa được cấu hình.') };

  const { data, error } = await supabase
    .from(APP_DATA_TABLE)
    .select('user_id,data,updated_at')
    .eq('user_id', userId)
    .maybeSingle<RemoteAppDataRow>();

  return { data: data?.data, updatedAt: data?.updated_at, error };
}

export async function upsertRemoteAppData(userId: string, data: AppData) {
  if (!supabase) return { error: new Error('Supabase chưa được cấu hình.') };

  const { error } = await supabase.from(APP_DATA_TABLE).upsert({
    user_id: userId,
    data,
    updated_at: new Date().toISOString(),
  });

  return { error };
}
