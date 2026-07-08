export type AppTab = 'today' | 'create' | 'edit' | 'checklists' | 'settings';

export type ChecklistItem = {
  id: string;
  title: string;
  description?: string;
  reminderTime?: string;
  isDone: boolean;
};

export type Checklist = {
  id: string;
  title: string;
  durationDays: number;
  startDate: string;
  endDate: string;
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
};

export type DayRecord = {
  date: string;
  completed: number;
  total: number;
  checklistCount: number;
  updatedAt: string;
};

export type ChecklistDayRecord = {
  checklistId: string;
  date: string;
  completedItemIds: string[];
  total: number;
  updatedAt: string;
};

export type AppData = {
  checklists: Checklist[];
  history: DayRecord[];
  checklistHistory: ChecklistDayRecord[];
  lastActiveDate: string;
  settings: AppSettings;
};

export type AppSettings = {
  widgetEnabled: boolean;
  notificationEnabled: boolean;
};

export type WidgetSummary = {
  date: string;
  completed: number;
  total: number;
  percentage: number;
  nextItemTitle?: string;
};
