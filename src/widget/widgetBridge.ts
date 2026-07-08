import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppData, WidgetSummary } from '../domain/types';
import { compareDateKeys, toDateKey } from '../utils/date';
import { HomeWidget } from './HomeChecklistWidget';
import type { HomeChecklistWidgetProps } from './HomeChecklistWidget';

export const WIDGET_SUMMARY_KEY = '@new-beginnings-100/widget-summary';

export function getHomeWidgetSnapshot(data: AppData): HomeChecklistWidgetProps {
  const today = toDateKey();
  const activeChecklists = data.checklists.filter((checklist) => compareDateKeys(checklist.startDate, today) <= 0);
  const primaryChecklist = activeChecklists[0] ?? data.checklists[0];
  const total = activeChecklists.reduce((sum, checklist) => sum + checklist.items.length, 0);
  const completed = activeChecklists.reduce(
    (sum, checklist) => sum + checklist.items.filter((item) => item.isDone).length,
    0,
  );
  const nextItem = activeChecklists.flatMap((checklist) => checklist.items).find((item) => !item.isDone);

  return {
    title: primaryChecklist?.title ?? '100 Khởi đầu mới',
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    nextItemTitle: nextItem?.title,
  };
}

export async function syncWidgetSummary(data: AppData) {
  const snapshot = getHomeWidgetSnapshot(data);

  const summary: WidgetSummary = {
    date: toDateKey(),
    completed: snapshot.completed,
    total: snapshot.total,
    percentage: snapshot.percentage,
    nextItemTitle: snapshot.nextItemTitle,
  };

  await AsyncStorage.setItem(WIDGET_SUMMARY_KEY, JSON.stringify(summary));
  HomeWidget.updateSnapshot(snapshot);
}
