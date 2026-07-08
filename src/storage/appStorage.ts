import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppData, Checklist } from '../domain/types';
import { CHECKLIST_TITLE_LIMIT, splitChecklistText } from '../utils/checklistText';
import { addDays, toDateKey } from '../utils/date';

const APP_DATA_KEY = '@new-beginnings-100/app-data';
const FIRST_CHECKLIST_TITLE = 'Thử thách sinh hoạt 100 ngày';

const now = () => new Date().toISOString();
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const firstChecklistItems = [
  'Dậy sớm trước 7h',
  'Uống 1 ly nước ấm khi vừa thức dậy',
  'Đi tiểu tiện, đại tiện sau khi uống nước vài phút (thứ tự có thể thay đổi: thức dậy > tiểu tiện > uống nước > đại tiện)',
  'Không bỏ ăn sáng',
  'Tự nấu ăn tối thiểu 90% số bữa ăn',
  'Phơi nắng 20-30p/ngày trong khung giờ 8 - 16h (không bắt buộc phơi liên tục, phơi nắng không phơi đầu, phơi nắng phải cảm thấy ấm nóng, dễ chịu, không để bỏng rát)',
  'Ăn chậm, nhai kĩ',
  'Ăn no vừa phải',
  'Không uống nước lạnh, đá lạnh',
  'Không sử dụng các sản phẩm chế biến công nghiệp (nước ngọt, nước đóng chai, bánh kẹo, đồ ăn chế biến sẵn...)',
  'Vận động tối thiểu 30 phút ngày. Vận động là tập luyện chủ động.',
  'Tập thở sâu bằng bụng 5-10 phút / ngày',
  'Đi chân tiếp đất 15-20 phút/ ngày.',
  'Nghỉ trưa 30 - 60p.',
  'Ăn tối trước khi đi ngủ tối thiểu 3h.',
  'Quan sát phân và nước tiểu mỗi ngày.',
  'Quan sát và lắng nghe cơ thể mỗi ngày.',
  'Đi ngủ trễ nhất là 22h',
  'Ngủ đủ giấc',
];

const englishChecklistItems = [
  {
    title: 'Học 10 từ vựng mới',
    description: 'Ghi ví dụ ngắn cho từng từ để nhớ theo ngữ cảnh.',
  },
  {
    title: 'Ôn lại 20 từ cũ',
    description: 'Ưu tiên những từ đã sai hoặc chưa dùng được trong câu.',
  },
  {
    title: 'Nghe tiếng Anh 15 phút',
    description: 'Podcast, video ngắn hoặc đoạn hội thoại có giọng rõ.',
  },
  {
    title: 'Đọc 1 đoạn ngắn',
    description: 'Chọn bài vừa sức, gạch chân cụm từ hay thay vì dịch từng chữ.',
  },
  {
    title: 'Viết 5 câu tiếng Anh',
    description: 'Dùng từ mới trong ngày, câu ngắn nhưng đúng cấu trúc.',
  },
  {
    title: 'Nói shadowing 5 phút',
    description: 'Bắt chước nhịp, trọng âm và ngữ điệu của người bản xứ.',
  },
  {
    title: 'Ôn 1 điểm ngữ pháp',
    description: 'Chỉ chọn một điểm nhỏ và tự đặt ví dụ riêng.',
  },
  {
    title: 'Ghi lỗi sai trong ngày',
    description: 'Viết lại câu đúng để ngày mai ôn nhanh.',
  },
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
    items: firstChecklistItems.map((title, index) => ({
      id: `daily-checklist-100-days-${index + 1}`,
      ...splitChecklistText(title),
      isDone: false,
    })),
  };
}

function createEnglishChecklist(): Checklist {
  const timestamp = now();
  const startDate = toDateKey();

  return {
    id: 'english-99-days',
    title: 'Học tiếng Anh 99 ngày',
    durationDays: 99,
    startDate,
    endDate: addDays(startDate, 98),
    createdAt: timestamp,
    updatedAt: timestamp,
    items: englishChecklistItems.map((item, index) => ({
      id: `english-99-days-${index + 1}`,
      title: item.title,
      description: item.description,
      isDone: false,
    })),
  };
}

export const initialData: AppData = {
  checklists: [createEnglishChecklist(), createFirstChecklist()],
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
  const hasEnglishChecklist = data.checklists.some((checklist) => checklist.id === 'english-99-days');

  if (hasFirstChecklist && hasEnglishChecklist) return withSplitItemText(data);

  const demoTitles = new Set(['Buoi sang nhe nhang', 'Ket ngay gon gang']);
  const userChecklists = data.checklists.filter((checklist) => !demoTitles.has(checklist.title));
  const seedChecklists = [
    ...(hasEnglishChecklist ? [] : [createEnglishChecklist()]),
    ...(hasFirstChecklist ? [] : [createFirstChecklist()]),
  ];

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
    checklists: data.checklists.map((checklist) => ({
      ...checklist,
      title:
        checklist.id === 'daily-checklist-100-days' && checklist.title === 'Daily Checklist - 100 Days'
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
