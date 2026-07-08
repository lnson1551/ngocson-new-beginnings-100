import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppData, Checklist } from '../domain/types';
import { CHECKLIST_TITLE_LIMIT, splitChecklistText } from '../utils/checklistText';
import { addDays, toDateKey } from '../utils/date';

const APP_DATA_KEY = '@new-beginnings-100/app-data';
const FIRST_CHECKLIST_TITLE = '100 khởi đầu mới';
const LEGACY_ENGLISH_CHECKLIST_ID = 'english-99-days';

const now = () => new Date().toISOString();

const firstChecklistItems: Array<{ title: string; description?: string }> = [
  { title: 'Dậy sớm trước 7h' },
  { title: 'Uống 1 ly nước ấm', description: 'Uống ngay sau khi vừa thức dậy.' },
  {
    title: 'Đi tiểu tiện, đại tiện',
    description: 'Sau khi uống nước vài phút. Thứ tự có thể thay đổi: thức dậy > tiểu tiện > uống nước > đại tiện.',
  },
  { title: 'Không bỏ ăn sáng' },
  { title: 'Tự nấu ăn tối', description: 'Tối thiểu 90% số bữa ăn.' },
  {
    title: 'Phơi nắng 20-30p/ngày',
    description: 'Trong khung giờ 8-16h. Không cần liên tục; chỉ phơi khi cảm thấy ấm, dễ chịu, không để bỏng rát.',
  },
  { title: 'Ăn chậm, nhai kĩ' },
  { title: 'Ăn no vừa phải' },
  { title: 'Không uống nước lạnh, đá lạnh' },
  {
    title: 'Không dùng thực phẩm chế biến công nghiệp',
    description: 'Ví dụ: nước ngọt, nước đóng chai, bánh kẹo, đồ ăn chế biến sẵn.',
  },
  { title: 'Vận động tối thiểu 30 phút/ngày', description: 'Vận động là tập luyện chủ động.' },
  { title: 'Tập thở sâu bằng bụng', description: '5-10 phút mỗi ngày.' },
  { title: 'Đi chân tiếp đất', description: '15-20 phút mỗi ngày.' },
  { title: 'Nghỉ trưa 30-60p' },
  { title: 'Ăn tối trước khi đi ngủ', description: 'Cách giờ ngủ tối thiểu 3h.' },
  { title: 'Quan sát phân và nước tiểu', description: 'Theo dõi mỗi ngày.' },
  { title: 'Quan sát và lắng nghe cơ thể', description: 'Thực hiện mỗi ngày.' },
  { title: 'Đi ngủ trễ nhất là 22h' },
  { title: 'Ngủ đủ giấc' },
];

function createFirstChecklist(): Checklist {
  const timestamp = now();
  const startDate = toDateKey();

  return {
    id: 'daily-checklist-100-days',
    title: FIRST_CHECKLIST_TITLE,
    durationDays: 100,
    startDate,
    endDate: addDays(startDate, 99),
    createdAt: timestamp,
    updatedAt: timestamp,
    items: firstChecklistItems.map((item, index) => ({
      id: `daily-checklist-100-days-${index + 1}`,
      title: item.title,
      ...(item.description ? { description: item.description } : {}),
      isDone: false,
    })),
  };
}

export const initialData: AppData = {
  checklists: [createFirstChecklist()],
  history: [],
  checklistHistory: [],
  lastActiveDate: toDateKey(),
  settings: {
    widgetEnabled: true,
    notificationEnabled: false,
  },
};

function withFirstChecklist(data: AppData): AppData {
  const hasFirstChecklist = data.checklists.some((checklist) => checklist.id === 'daily-checklist-100-days');

  if (hasFirstChecklist) return withSplitItemText(data);

  const demoTitles = new Set(['Buoi sang nhe nhang', 'Ket ngay gon gang']);
  const userChecklists = data.checklists.filter((checklist) => !demoTitles.has(checklist.title));
  const seedChecklists = hasFirstChecklist ? [] : [createFirstChecklist()];

  return withSplitItemText({
    ...data,
    checklists: [...seedChecklists, ...userChecklists],
  });
}

function withSplitItemText(data: AppData): AppData {
  return {
    ...data,
    checklistHistory: data.checklistHistory ?? [],
    lastActiveDate: data.lastActiveDate ?? toDateKey(),
    settings: data.settings ?? {
      widgetEnabled: true,
      notificationEnabled: false,
    },
    checklists: data.checklists
      .filter((checklist) => checklist.id !== LEGACY_ENGLISH_CHECKLIST_ID)
      .map((checklist) => ({
        ...checklist,
        title:
          checklist.id === 'daily-checklist-100-days' &&
          ['Daily Checklist - 100 Days', 'Thử thách sinh hoạt 100 ngày'].includes(checklist.title)
            ? FIRST_CHECKLIST_TITLE
            : checklist.title,
        durationDays: checklist.durationDays ?? 100,
        startDate: checklist.startDate ?? toDateKey(),
        endDate: checklist.endDate ?? addDays(checklist.startDate ?? toDateKey(), (checklist.durationDays ?? 100) - 1),
        items: checklist.items.map((item) => {
          if (item.description || item.title.length <= CHECKLIST_TITLE_LIMIT) return item;
          return {
            ...item,
            ...splitChecklistText(item.title),
          };
        }),
      })),
  };
}

export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(APP_DATA_KEY);
  if (!raw) {
    await saveAppData(initialData);
    return initialData;
  }

  const data = withFirstChecklist(JSON.parse(raw) as AppData);
  await saveAppData(data);
  return data;
}

export async function saveAppData(data: AppData) {
  await AsyncStorage.setItem(APP_DATA_KEY, JSON.stringify(data));
}
