import { useEffect, useMemo, useRef, useState } from 'react';
import { addUserInteractionListener } from 'expo-widgets';
import type { EmailOtpType, Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { AppData, AppSettings, AppTab, Checklist, ChecklistDayRecord, DayRecord } from '../domain/types';
import { loadAppData, saveAppData } from '../storage/appStorage';
import { syncWidgetSummary } from '../widget/widgetBridge';
import { WIDGET_COMPLETE_NEXT_TARGET } from '../widget/HomeChecklistWidget';
import { splitChecklistText } from '../utils/checklistText';
import { addDays, compareDateKeys, toDateKey } from '../utils/date';
import { ImportedChecklist } from '../utils/excelImport';
import { APP_DATA_TABLE, fetchRemoteAppData, upsertRemoteAppData } from '../supabase/appDataSync';
import { isSupabaseConfigured, supabase } from '../supabase/client';

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
type SyncMode = 'local' | 'cloud';
type SyncStatus = 'local' | 'signed_out' | 'syncing' | 'synced' | 'error';

async function syncLocalToCloudOrHydrateLocal(userId: string, localData: AppData) {
  const { data: remoteData, updatedAt, error: fetchError } = await fetchRemoteAppData(userId);
  if (fetchError) return { error: fetchError.message };

  if (remoteData) {
    const hydrated = pushDoneItemsToBottom(rolloverIfNeeded(remoteData));
    return { data: hydrated, updatedAt };
  }

  const { error: uploadError, updatedAt: uploadedAt } = await upsertRemoteAppData(userId, localData);
  if (uploadError) return { error: uploadError.message };

  return { data: localData, updatedAt: uploadedAt, uploadedLocal: true };
}

function buildDayRecord(data: AppData, date: string): DayRecord {
  const total = data.checklists.reduce((sum, checklist) => sum + checklist.items.length, 0);
  const completed = data.checklists.reduce(
    (sum, checklist) => sum + checklist.items.filter((item) => item.isDone).length,
    0,
  );

  return {
    date,
    completed,
    total,
    checklistCount: data.checklists.length,
    updatedAt: new Date().toISOString(),
  };
}

function withUpdatedHistory(data: AppData, date = toDateKey()): AppData {
  const today = buildDayRecord(data, date);
  const history = [today, ...data.history.filter((record) => record.date !== today.date)];
  return { ...data, history, checklistHistory: data.checklistHistory ?? [] };
}

function buildChecklistRecord(checklist: Checklist, date: string): ChecklistDayRecord {
  return {
    checklistId: checklist.id,
    date,
    completedItemIds: checklist.items.filter((item) => item.isDone).map((item) => item.id),
    total: checklist.items.length,
    updatedAt: new Date().toISOString(),
  };
}

function withChecklistDayRecord(data: AppData, checklistId: string): AppData {
  const checklist = data.checklists.find((item) => item.id === checklistId);
  if (!checklist) return data;

  const record = buildChecklistRecord(checklist, toDateKey());
  return {
    ...data,
    checklistHistory: [
      record,
      ...(data.checklistHistory ?? []).filter(
        (item) => item.checklistId !== checklistId || item.date !== record.date,
      ),
    ],
  };
}

function archiveChecklistRecords(data: AppData, date: string): AppData {
  const records = data.checklists.map((checklist) => buildChecklistRecord(checklist, date));
  const nextHistory = records.reduce(
    (currentHistory, record) => [
      record,
      ...currentHistory.filter(
        (item) => item.checklistId !== record.checklistId || item.date !== record.date,
      ),
    ],
    data.checklistHistory ?? [],
  );

  return { ...data, checklistHistory: nextHistory };
}

function archiveDay(data: AppData, date: string): AppData {
  return archiveChecklistRecords(withUpdatedHistory(data, date), date);
}

function resetChecklistCompletions(data: AppData): AppData {
  return {
    ...data,
    checklists: data.checklists.map((checklist) => ({
      ...checklist,
      items: checklist.items.map((item) => ({ ...item, isDone: false })),
    })),
  };
}

function rolloverIfNeeded(data: AppData): AppData {
  const today = toDateKey();
  const lastActiveDate = data.lastActiveDate ?? today;
  if (lastActiveDate === today) {
    return { ...withUpdatedHistory(data, today), lastActiveDate: today };
  }

  const archived = archiveDay(data, lastActiveDate);
  return {
    ...withUpdatedHistory(resetChecklistCompletions(archived), today),
    lastActiveDate: today,
  };
}

function getEndOfDayDelayMs() {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return Math.max(1000, endOfDay.getTime() - now.getTime());
}

function pushDoneItemsToBottom(data: AppData): AppData {
  return {
    ...withDefaultSettings(data),
    checklists: withDefaultSettings(data).checklists.map((checklist) => ({
      ...checklist,
      items: checklist.items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => Number(a.item.isDone) - Number(b.item.isDone) || a.index - b.index)
        .map(({ item }) => item),
    })),
  };
}

function withDefaultSettings(data: AppData): AppData {
  return {
    ...data,
    settings: data.settings ?? {
      widgetEnabled: true,
      notificationEnabled: false,
    },
  };
}

export function useAppData() {
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>();
  const [data, setData] = useState<AppData>({
    checklists: [],
    history: [],
    checklistHistory: [],
    lastActiveDate: toDateKey(),
    settings: {
      widgetEnabled: true,
      notificationEnabled: false,
    },
  });
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncMode, setSyncMode] = useState<SyncMode>('local');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string>();
  const dataRef = useRef(data);
  const sessionRef = useRef<Session | null>(null);
  const syncModeRef = useRef<SyncMode>('local');
  const applyingRemoteRef = useRef(false);
  const remoteUpdatedAtRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    syncModeRef.current = syncMode;
  }, [syncMode]);

  const applyRemoteData = async (remoteData: AppData, updatedAt?: string) => {
    if (updatedAt && remoteUpdatedAtRef.current && updatedAt <= remoteUpdatedAtRef.current) return;

    applyingRemoteRef.current = true;
    const hydrated = pushDoneItemsToBottom(rolloverIfNeeded(remoteData));
    remoteUpdatedAtRef.current = updatedAt ?? remoteUpdatedAtRef.current;
    dataRef.current = hydrated;
    setData(hydrated);
    await saveAppData(hydrated);
    await syncWidgetSummary(hydrated);
    applyingRemoteRef.current = false;
    setSyncStatus('synced');
    setSyncError(undefined);
  };

  const refreshRemoteData = async () => {
    const activeSession = sessionRef.current;
    if (!activeSession || syncModeRef.current !== 'cloud') return;

    const { data: remoteData, updatedAt, error } = await fetchRemoteAppData(activeSession.user.id);
    if (error) {
      setSyncStatus('error');
      setSyncError(error.message);
      return;
    }
    if (remoteData) {
      await applyRemoteData(remoteData, updatedAt);
    }
  };

  useEffect(() => {
    async function boot() {
      const stored = await loadAppData();
      const hydrated = pushDoneItemsToBottom(rolloverIfNeeded(stored));
      dataRef.current = hydrated;
      setData(hydrated);
      await saveAppData(hydrated);
      await syncWidgetSummary(hydrated);

      if (!supabase) {
        setSyncStatus('local');
        setIsReady(true);
        return;
      }

      const { data: authData } = await supabase.auth.getSession();
      const activeSession = authData.session;
      setSession(activeSession);

      if (!activeSession) {
        setSyncMode('local');
        setSyncStatus('signed_out');
        setIsReady(true);
        return;
      }

      setSyncMode('cloud');
      setSyncStatus('syncing');
      const syncResult = await syncLocalToCloudOrHydrateLocal(activeSession.user.id, hydrated);
      if (syncResult.error) {
        setSyncStatus('error');
        setSyncError(syncResult.error);
      } else if (syncResult.data) {
        await applyRemoteData(syncResult.data, syncResult.updatedAt);
      }

      setIsReady(true);
    }

    void boot();
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setSyncMode('local');
        setSyncStatus('signed_out');
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session || syncMode !== 'cloud') return undefined;

    const client = supabase;
    const channel = client
      .channel('app-data-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: APP_DATA_TABLE,
          filter: `user_id=eq.${session.user.id}`,
        },
        async (payload) => {
          const nextRow = payload.new as { data?: AppData; updated_at?: string } | null;
          if (!nextRow?.data) return;
          await applyRemoteData(nextRow.data, nextRow.updated_at);
        },
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          setSyncStatus('synced');
          setSyncError(undefined);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncStatus('error');
          setSyncError(error?.message ?? 'Kết nối đồng bộ realtime bị gián đoạn.');
          void refreshRemoteData();
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [session, syncMode]);

  useEffect(() => {
    if (!isReady || !session || syncMode !== 'cloud') return undefined;

    const interval = setInterval(() => {
      void refreshRemoteData();
    }, 5000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshRemoteData();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [isReady, session, syncMode]);

  useEffect(() => {
    if (!isReady || !session || syncMode !== 'cloud') return;
    setSyncStatus('syncing');
    upsertRemoteAppData(session.user.id, dataRef.current).then(({ error, updatedAt }) => {
      remoteUpdatedAtRef.current = updatedAt ?? remoteUpdatedAtRef.current;
      setSyncStatus(error ? 'error' : 'synced');
      setSyncError(error?.message);
    });
  }, [isReady, session, syncMode]);

  useEffect(() => {
    if (!isReady) return undefined;

    const timer = setTimeout(() => {
      const archived = archiveDay(dataRef.current, toDateKey());
      dataRef.current = archived;
      setData(archived);
      void saveAppData(archived);
      void syncWidgetSummary(archived);
    }, getEndOfDayDelayMs());

    return () => clearTimeout(timer);
  }, [isReady, data.lastActiveDate]);

  const persist = async (nextData: AppData) => {
    const withHistory = { ...withUpdatedHistory(nextData), lastActiveDate: toDateKey() };
    dataRef.current = withHistory;
    setData(withHistory);
    await saveAppData(withHistory);
    await syncWidgetSummary(withHistory);
    if (!applyingRemoteRef.current && sessionRef.current && syncModeRef.current === 'cloud') {
      setSyncStatus('syncing');
      const { error, updatedAt } = await upsertRemoteAppData(sessionRef.current.user.id, withHistory);
      remoteUpdatedAtRef.current = updatedAt ?? remoteUpdatedAtRef.current;
      setSyncStatus(error ? 'error' : 'synced');
      setSyncError(error?.message);
    }
  };

  useEffect(() => {
    if (!isReady) return undefined;

    const subscription = addUserInteractionListener((event) => {
      if (event.target !== WIDGET_COMPLETE_NEXT_TARGET) return;

      const today = toDateKey();
      const currentData = dataRef.current;
      const activeChecklist = currentData.checklists.find(
        (checklist) =>
          compareDateKeys(checklist.startDate, today) <= 0 &&
          checklist.items.some((item) => !item.isDone),
      );
      const nextItem = activeChecklist?.items.find((item) => !item.isDone);
      if (!activeChecklist || !nextItem) return;

      const timestamp = new Date().toISOString();
      const nextData: AppData = {
        ...currentData,
        checklists: currentData.checklists.map((checklist) => {
          if (checklist.id !== activeChecklist.id) return checklist;

          return {
            ...checklist,
            updatedAt: timestamp,
            items: checklist.items
              .map((item, index) => ({
                item: item.id === nextItem.id ? { ...item, isDone: true } : item,
                index,
              }))
              .sort((a, b) => Number(a.item.isDone) - Number(b.item.isDone) || a.index - b.index)
              .map(({ item }) => item),
          };
        }),
      };

      void persist(withChecklistDayRecord(nextData, activeChecklist.id));
    });

    return () => subscription.remove();
  }, [isReady]);

  const toggleItem = (checklistId: string, itemId: string) => {
    const nextData: AppData = {
      ...data,
      checklists: data.checklists.map((checklist) => {
        if (checklist.id !== checklistId) return checklist;

        const updatedItems = checklist.items
          .map((item, index) => ({
            item: item.id === itemId ? { ...item, isDone: !item.isDone } : item,
            index,
          }))
          .sort((a, b) => Number(a.item.isDone) - Number(b.item.isDone) || a.index - b.index)
          .map(({ item }) => item);

        return {
          ...checklist,
          updatedAt: new Date().toISOString(),
          items: updatedItems,
        };
      }),
    };

    void persist(withChecklistDayRecord(nextData, checklistId));
  };

  const toggleHistoryItem = (checklistId: string, date: string, itemId: string) => {
    const today = toDateKey();
    const editableStartDate = addDays(today, -2);
    if (compareDateKeys(date, today) > 0) return;
    if (compareDateKeys(date, editableStartDate) < 0) return;

    const targetChecklist = data.checklists.find((checklist) => checklist.id === checklistId);
    if (!targetChecklist?.items.some((item) => item.id === itemId)) return;

    const timestamp = new Date().toISOString();
    const existingRecord = (data.checklistHistory ?? []).find(
      (record) => record.checklistId === checklistId && record.date === date,
    );
    const completedIds = new Set(
      existingRecord?.completedItemIds ?? (date === today ? targetChecklist.items.filter((item) => item.isDone).map((item) => item.id) : []),
    );

    if (completedIds.has(itemId)) {
      completedIds.delete(itemId);
    } else {
      completedIds.add(itemId);
    }

    const completedItemIds = targetChecklist.items
      .filter((item) => completedIds.has(item.id))
      .map((item) => item.id);
    const nextRecord: ChecklistDayRecord = {
      checklistId,
      date,
      completedItemIds,
      total: targetChecklist.items.length,
      updatedAt: timestamp,
    };

    const nextData: AppData = {
      ...data,
      checklists:
        date === today
          ? data.checklists.map((checklist) => {
              if (checklist.id !== checklistId) return checklist;

              return {
                ...checklist,
                updatedAt: timestamp,
                items: checklist.items
                  .map((item, index) => ({
                    item: { ...item, isDone: completedIds.has(item.id) },
                    index,
                  }))
                  .sort((a, b) => Number(a.item.isDone) - Number(b.item.isDone) || a.index - b.index)
                  .map(({ item }) => item),
              };
            })
          : data.checklists,
      checklistHistory: [
        nextRecord,
        ...(data.checklistHistory ?? []).filter(
          (record) => record.checklistId !== checklistId || record.date !== date,
        ),
      ],
    };

    void persist(nextData);
  };

  const createChecklist = (
    title: string,
    items: Array<{ title: string; description?: string; reminderTime?: string }>,
    durationDays: number,
    startDate: string,
  ) => {
    const timestamp = new Date().toISOString();
    const checklist: Checklist = {
      id: makeId(),
      title,
      durationDays,
      startDate,
      endDate: addDays(startDate, durationDays - 1),
      createdAt: timestamp,
      updatedAt: timestamp,
      items: items.map((item) => ({
        id: makeId(),
        ...splitChecklistText(item.title),
        ...(item.description?.trim() ? { description: item.description.trim() } : {}),
        ...(item.reminderTime ? { reminderTime: item.reminderTime } : {}),
        isDone: false,
      })),
    };

    void persist({ ...data, checklists: [checklist, ...data.checklists] });
    setActiveTab('today');
  };

  const importChecklists = (importedChecklists: ImportedChecklist[]) => {
    const timestamp = new Date().toISOString();
    const nextChecklists: Checklist[] = importedChecklists.map((imported) => ({
      id: makeId(),
      title: imported.title,
      durationDays: imported.durationDays,
      startDate: imported.startDate,
      endDate: addDays(imported.startDate, imported.durationDays - 1),
      createdAt: timestamp,
      updatedAt: timestamp,
              items: imported.items.map((item) => ({
                id: makeId(),
                ...splitChecklistText(item.title),
                ...(item.description?.trim() ? { description: item.description.trim() } : {}),
                ...(item.reminderTime ? { reminderTime: item.reminderTime } : {}),
                isDone: false,
              })),
    }));

    if (nextChecklists.length === 0) return;
    void persist({ ...data, checklists: [...nextChecklists, ...data.checklists] });
    setActiveTab('checklists');
  };

  const updateChecklist = (
    checklistId: string,
    title: string,
    items: Array<{ id?: string; title: string; description?: string; reminderTime?: string; isDone?: boolean }>,
    durationDays: number,
    startDate: string,
  ) => {
    const cleanTitle = title.trim();
    const cleanItems = items
      .map((item) => ({
        ...item,
        title: item.title.trim(),
        description: item.description?.trim(),
        reminderTime: item.reminderTime,
      }))
      .filter((item) => item.title);

    if (!cleanTitle || cleanItems.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || durationDays < 1 || durationDays > 365) {
      return;
    }

    const keptIds = new Set(cleanItems.map((item) => item.id).filter(Boolean));
    const timestamp = new Date().toISOString();
    const nextData: AppData = {
      ...data,
      checklists: data.checklists.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              title: cleanTitle,
              startDate,
              durationDays,
              endDate: addDays(startDate, durationDays - 1),
              updatedAt: timestamp,
              items: cleanItems.map((item) => ({
                id: item.id ?? makeId(),
                ...splitChecklistText(item.title),
                ...(item.description ? { description: item.description } : {}),
                ...(item.reminderTime ? { reminderTime: item.reminderTime } : {}),
                isDone: Boolean(item.isDone),
              })),
            }
          : checklist,
      ),
      checklistHistory: (data.checklistHistory ?? []).map((record) =>
        record.checklistId === checklistId
          ? {
              ...record,
              completedItemIds: record.completedItemIds.filter((id) => keptIds.has(id)),
              total: cleanItems.length,
            }
          : record,
      ),
    };

    void persist(withChecklistDayRecord(nextData, checklistId));
    setActiveTab('checklists');
  };

  const deleteChecklist = (checklistId: string) => {
    const nextData: AppData = {
      ...data,
      checklists: data.checklists.filter((checklist) => checklist.id !== checklistId),
      checklistHistory: (data.checklistHistory ?? []).filter((record) => record.checklistId !== checklistId),
    };

    setSelectedChecklistId(undefined);
    setActiveTab('checklists');
    void persist(nextData);
  };

  const openChecklistDetail = (checklistId: string) => {
    setSelectedChecklistId(checklistId);
    setActiveTab('checklists');
  };

  const addChecklistItem = (checklistId: string, title: string, description?: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const targetChecklist = data.checklists.find((checklist) => checklist.id === checklistId);
    if (
      targetChecklist?.items.some((item) => item.title.trim().toLowerCase() === cleanTitle.toLowerCase())
    ) {
      return;
    }

    const nextData: AppData = {
      ...data,
      checklists: data.checklists.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              updatedAt: new Date().toISOString(),
              items: [
                ...checklist.items,
                {
                  id: makeId(),
                  ...splitChecklistText(cleanTitle),
                  ...(description?.trim() ? { description: description.trim() } : {}),
                  isDone: false,
                },
              ],
            }
          : checklist,
      ),
    };

    void persist(withChecklistDayRecord(nextData, checklistId));
  };

  const removeChecklistItem = (checklistId: string, itemId: string) => {
    const targetChecklist = data.checklists.find((checklist) => checklist.id === checklistId);
    if (!targetChecklist || targetChecklist.items.length <= 1) return;

    const nextData: AppData = {
      ...data,
      checklists: data.checklists.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              updatedAt: new Date().toISOString(),
              items: checklist.items.filter((item) => item.id !== itemId),
            }
          : checklist,
      ),
      checklistHistory: (data.checklistHistory ?? []).map((record) =>
        record.checklistId === checklistId
          ? { ...record, completedItemIds: record.completedItemIds.filter((id) => id !== itemId) }
          : record,
      ),
    };

    void persist(withChecklistDayRecord(nextData, checklistId));
  };

  const updateChecklistSchedule = (checklistId: string, startDate: string, durationDays: number) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || durationDays < 1 || durationDays > 365) return;

    const endDate = addDays(startDate, durationDays - 1);
    const today = toDateKey();
    const includesToday = compareDateKeys(startDate, today) <= 0 && compareDateKeys(today, endDate) <= 0;

    const nextData: AppData = {
      ...data,
      checklists: data.checklists.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              startDate,
              durationDays,
              endDate,
              updatedAt: new Date().toISOString(),
              items: checklist.items.map((item) => ({
                ...item,
                isDone: includesToday ? item.isDone : false,
              })),
            }
          : checklist,
      ),
      checklistHistory: (data.checklistHistory ?? [])
        .filter((record) => record.checklistId !== checklistId || (compareDateKeys(record.date, startDate) >= 0 && compareDateKeys(record.date, endDate) <= 0))
        .map((record) =>
          record.checklistId === checklistId
            ? {
                ...record,
                total: data.checklists.find((checklist) => checklist.id === checklistId)?.items.length ?? record.total,
              }
            : record,
        ),
    };

    void persist(includesToday ? withChecklistDayRecord(nextData, checklistId) : nextData);
  };

  const resetToday = () => {
    const nextData: AppData = {
      ...data,
      checklists: data.checklists.map((checklist) => ({
        ...checklist,
        updatedAt: new Date().toISOString(),
        items: checklist.items.map((item) => ({ ...item, isDone: false })),
      })),
    };

    void persist(nextData);
  };

  const resetChecklist = (checklistId: string) => {
    const nextData: AppData = {
      ...data,
      checklists: data.checklists.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              updatedAt: new Date().toISOString(),
              items: checklist.items.map((item) => ({ ...item, isDone: false })),
            }
          : checklist,
      ),
    };

    void persist(withChecklistDayRecord(nextData, checklistId));
  };

  const updateSettings = (settings: AppSettings) => {
    void persist({
      ...dataRef.current,
      settings,
    });
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Đăng nhập hiện chưa sẵn sàng. Vui lòng thử lại sau.' };
    setSyncStatus('syncing');
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSyncStatus('error');
      setSyncError(error.message);
      return { error: error.message };
    }

    const activeSession = authData.session;
    setSession(activeSession);
    setSyncMode('cloud');
    if (activeSession) {
      const syncResult = await syncLocalToCloudOrHydrateLocal(activeSession.user.id, dataRef.current);
      if (syncResult.error) {
        setSyncStatus('error');
        setSyncError(syncResult.error);
        return { error: syncResult.error };
      }
      if (syncResult.data) {
        await applyRemoteData(syncResult.data, syncResult.updatedAt);
      }
    }
    setSyncStatus('synced');
    setSyncError(undefined);
    return {};
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return { error: 'Đăng ký hiện chưa sẵn sàng. Vui lòng thử lại sau.' };
    setSyncStatus('syncing');
    const { data: authData, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setSyncStatus('error');
      setSyncError(error.message);
      return { error: error.message };
    }

    if (authData.session) {
      setSession(authData.session);
      setSyncMode('cloud');
      const syncResult = await syncLocalToCloudOrHydrateLocal(authData.session.user.id, dataRef.current);
      if (syncResult.error) {
        setSyncStatus('error');
        setSyncError(syncResult.error);
        return { error: syncResult.error };
      }
      if (syncResult.data) {
        await applyRemoteData(syncResult.data, syncResult.updatedAt);
      }
      setSyncStatus('synced');
      setSyncError(undefined);
      return {};
    }

    setSyncStatus('signed_out');
    return { message: 'Kiểm tra email để xác nhận tài khoản trước khi đăng nhập.' };
  };

  const sendPasswordResetOtp = async (email: string) => {
    if (!supabase) return { error: 'Khôi phục mật khẩu hiện chưa sẵn sàng. Vui lòng thử lại sau.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { error: error.message };
    return { message: 'Nếu email tồn tại, mã xác nhận hoặc liên kết khôi phục đã được gửi.' };
  };

  const verifyOtp = async (email: string, token: string, type: EmailOtpType) => {
    if (!supabase) return { error: 'Xác nhận OTP hiện chưa sẵn sàng. Vui lòng thử lại sau.' };
    setSyncStatus('syncing');
    const { data: authData, error } = await supabase.auth.verifyOtp({ email, token, type });
    if (error) {
      setSyncStatus('error');
      setSyncError(error.message);
      return { error: error.message };
    }

    if (authData.session) {
      setSession(authData.session);
      setSyncMode('cloud');
      const syncResult = await syncLocalToCloudOrHydrateLocal(authData.session.user.id, dataRef.current);
      if (syncResult.error) {
        setSyncStatus('error');
        setSyncError(syncResult.error);
        return { error: syncResult.error };
      }
      if (syncResult.data) {
        await applyRemoteData(syncResult.data, syncResult.updatedAt);
      }
    }

    setSyncStatus('synced');
    setSyncError(undefined);
    return {};
  };

  const updatePassword = async (password: string) => {
    if (!supabase) return { error: 'Đổi mật khẩu hiện chưa sẵn sàng. Vui lòng thử lại sau.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setSyncMode('local');
    setSyncStatus('signed_out');
  };

  const useLocalOnly = () => {
    setSyncMode('local');
    setSyncStatus(session ? 'signed_out' : 'local');
  };

  const enableCloudSync = async () => {
    if (!session) return { error: 'Đăng nhập trước để bật đồng bộ.' };
    setSyncMode('cloud');
    setSyncStatus('syncing');
    const { error, updatedAt } = await upsertRemoteAppData(session.user.id, dataRef.current);
    remoteUpdatedAtRef.current = updatedAt ?? remoteUpdatedAtRef.current;
    setSyncStatus(error ? 'error' : 'synced');
    setSyncError(error?.message);
    return { error: error?.message };
  };

  const progress = useMemo(() => {
    const total = data.checklists.reduce((sum, checklist) => sum + checklist.items.length, 0);
    const completed = data.checklists.reduce(
      (sum, checklist) => sum + checklist.items.filter((item) => item.isDone).length,
      0,
    );

    return {
      total,
      completed,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }, [data.checklists]);

  return {
    activeTab,
    setActiveTab,
    isReady,
    checklists: data.checklists,
    history: data.history,
    checklistHistory: data.checklistHistory ?? [],
    settings: data.settings,
    selectedChecklist: data.checklists.find((checklist) => checklist.id === selectedChecklistId),
    selectedChecklistId,
    setSelectedChecklistId,
    progress,
    toggleItem,
    toggleHistoryItem,
    createChecklist,
    importChecklists,
    updateChecklist,
    deleteChecklist,
    openChecklistDetail,
    addChecklistItem,
    removeChecklistItem,
    updateChecklistSchedule,
    resetChecklist,
    resetToday,
    updateSettings,
    authSession: session,
    isSupabaseConfigured,
    syncMode,
    syncStatus,
    syncError,
    signIn,
    signUp,
    sendPasswordResetOtp,
    verifyOtp,
    updatePassword,
    signOut,
    useLocalOnly,
    enableCloudSync,
  };
}
