import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { ChevronLeft, Clock, Download, FileSpreadsheet, FileText, GripVertical, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as XLSX from 'xlsx';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { CHECKLIST_TITLE_LIMIT, splitChecklistText } from '../utils/checklistText';
import { addDays, compareDateKeys, dateFromKey, formatShortDate, toDateKey } from '../utils/date';
import { parseExcelWorkbook } from '../utils/excelImport';

type Props = {
  onCreateChecklist: (
    title: string,
    items: Array<{ title: string; description?: string; reminderTime?: string }>,
    durationDays: number,
    startDate: string,
  ) => void;
  onClose: () => void;
};

type DurationOption = 30 | 60 | 100 | 'custom';
type StartOption = 'today' | 'tomorrow' | 'custom';

const durationOptions: Array<{ label: string; value: DurationOption }> = [
  { label: '30 ngày', value: 30 },
  { label: '60 ngày', value: 60 },
  { label: '100 ngày', value: 100 },
  { label: 'Tùy chọn', value: 'custom' },
];

const startOptions: Array<{ label: string; value: StartOption }> = [
  { label: 'Hôm nay', value: 'today' },
  { label: 'Ngày mai', value: 'tomorrow' },
  { label: 'Tùy chọn', value: 'custom' },
];

type DraftItem = {
  id: string;
  title: string;
  description?: string;
  reminderTime?: string;
};

const makeDraftId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MAX_CUSTOM_DURATION_DAYS = 365;
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SAMPLE_EXCEL_FILE_NAME = 'mau-danh-sach-viec.xlsx';

const padTime = (value: number) => String(value).padStart(2, '0');

function formatReminderTime(date: Date) {
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function dateFromReminderTime(time?: string) {
  const date = new Date();
  const [hours = 8, minutes = 0] = (time ?? '08:00').split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function normalizeDraftItem(item: DraftItem): DraftItem {
  const split = splitChecklistText(item.title);
  return {
    ...item,
    title: split.title,
    description: item.description ?? split.description,
  };
}

function buildSampleWorkbook() {
  const rows = [
    ['Tên thử thách', 'Học tiếng Anh 100 ngày'],
    ['Thời lượng', 100],
    ['Ngày bắt đầu', toDateKey()],
    [],
    ['Việc', 'Ghi chú'],
    ['Học 10 từ vựng mới', 'Từ chủ đề đang học'],
    ['Ôn lại 20 từ cũ', 'Dùng flashcard'],
    ['Nghe tiếng Anh 15 phút', 'Podcast hoặc video ngắn'],
    ['Viết 5 câu tiếng Anh', 'Có thể viết trong sổ tay'],
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 24 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau');
  return workbook;
}

export function CreateChecklistScreen({ onCreateChecklist, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [durationOption, setDurationOption] = useState<DurationOption>(100);
  const [customDays, setCustomDays] = useState('');
  const [startOption, setStartOption] = useState<StartOption>('today');
  const [customStartDate, setCustomStartDate] = useState(addDays(toDateKey(), 2));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemReminderTime, setItemReminderTime] = useState<string>();
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
  const [webReminderTime, setWebReminderTime] = useState('08:00');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const canAddItem = itemTitle.trim().length > 0;

  const downloadSampleExcel = async () => {
    try {
      const workbook = buildSampleWorkbook();
      const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

      if (Platform.OS === 'web') {
        const blob = new Blob([data], { type: EXCEL_MIME_TYPE });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = SAMPLE_EXCEL_FILE_NAME;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return;
      }

      const file = new File(Paths.document, SAMPLE_EXCEL_FILE_NAME);
      file.write(new Uint8Array(data));
      Alert.alert('Đã tạo file mẫu', `File mẫu đã được lưu tại:\n${file.uri}`);
    } catch {
      Alert.alert('Chưa tải được mẫu', 'Vui lòng thử lại sau.');
    }
  };

  const importExcelItems = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const workbook =
        Platform.OS === 'web'
          ? XLSX.read(await (await fetch(asset.uri)).arrayBuffer(), { type: 'array' })
          : XLSX.read(
              await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
              }),
              { type: 'base64' },
            );
      const imported = parseExcelWorkbook(workbook);
      const importedItems = imported.flatMap((checklist) => checklist.items);

      if (importedItems.length === 0) {
        Alert.alert('Không đọc được file', 'File cần có ít nhất một cột việc cần làm.');
        return;
      }

      if (!title.trim() && imported[0]?.title) setTitle(imported[0].title);
      if (imported[0]?.durationDays) {
        const importedDuration = imported[0].durationDays;
        setDurationOption(
          importedDuration === 30 || importedDuration === 60 || importedDuration === 100
            ? importedDuration
            : 'custom',
        );
        setCustomDays(String(importedDuration));
      }

      const existingTitles = new Set(items.map((item) => item.title.trim().toLowerCase()));
      const nextItems = importedItems
        .filter((item) => {
          const key = item.title.trim().toLowerCase();
          if (!key || existingTitles.has(key)) return false;
          existingTitles.add(key);
          return true;
        })
        .map((item) => normalizeDraftItem({ id: makeDraftId(), title: item.title, description: item.description, reminderTime: item.reminderTime }));

      setItems((current) => [...current, ...nextItems]);

      Alert.alert('Đã thêm từ Excel', `Đã thêm ${nextItems.length} việc vào danh sách.`);
    } catch {
      Alert.alert('Import chưa thành công', 'Vui lòng kiểm tra lại file Excel rồi thử lại.');
    }
  };

  const addItem = () => {
    const cleanTitle = itemTitle.trim();
    const cleanDescription = itemDescription.trim();
    if (!cleanTitle) {
      Alert.alert('Thiếu tên việc', 'Nhập một việc nhỏ trước khi thêm vào danh sách.');
      return;
    }
    if (items.some((item) => item.title.trim().toLowerCase() === cleanTitle.toLowerCase())) {
      Alert.alert('Việc đã tồn tại', 'Bạn đã thêm việc này vào danh sách rồi.');
      return;
    }
    setItems((current) => [
      ...current,
      normalizeDraftItem({ id: makeDraftId(), title: cleanTitle, description: cleanDescription || undefined, reminderTime: itemReminderTime }),
    ]);
    setItemTitle('');
    setItemDescription('');
    setItemReminderTime(undefined);
    setIsNoteOpen(false);
  };

  const save = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Thiếu tên thử thách', 'Đặt tên ngắn để bạn dễ nhận ra thử thách này.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Chưa có việc nào', 'Thêm ít nhất một việc trước khi tạo thử thách.');
      return;
    }
    const durationDays =
      durationOption === 'custom' ? Number.parseInt(customDays.trim(), 10) : durationOption;
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      Alert.alert('Số ngày chưa hợp lệ', 'Nhập số ngày lớn hơn 0.');
      return;
    }
    if (durationDays > MAX_CUSTOM_DURATION_DAYS) {
      Alert.alert('Thời lượng quá dài', `Chọn tối đa ${MAX_CUSTOM_DURATION_DAYS} ngày cho một thử thách.`);
      return;
    }
    const today = toDateKey();
    const startDate =
      startOption === 'today' ? today : startOption === 'tomorrow' ? addDays(today, 1) : customStartDate.trim();
    const latestStartDate = addDays(today, 45);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      Alert.alert('Ngày chưa đúng', 'Chọn ngày bắt đầu hợp lệ.');
      return;
    }
    if (compareDateKeys(startDate, today) < 0 || compareDateKeys(startDate, latestStartDate) > 0) {
      Alert.alert('Ngày bắt đầu quá xa', `Chọn từ ${formatShortDate(today)} đến ${formatShortDate(latestStartDate)}.`);
      return;
    }

    onCreateChecklist(
      cleanTitle,
      items.map(({ title, description, reminderTime }) => ({ title, description, reminderTime })),
      durationDays,
      startDate,
    );
    setTitle('');
    setDurationOption(100);
    setCustomDays('');
    setStartOption('today');
    setCustomStartDate(addDays(toDateKey(), 2));
    setItems([]);
    setItemTitle('');
    setItemDescription('');
    setItemReminderTime(undefined);
    setIsNoteOpen(false);
  };

  const today = toDateKey();
  const latestStartDate = addDays(today, 45);
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setIsDatePickerOpen(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    setCustomStartDate(toDateKey(selectedDate));
  };

  const openReminderPicker = () => {
    setWebReminderTime(itemReminderTime ?? '08:00');
    setIsReminderPickerOpen(true);
  };

  const handleReminderChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setIsReminderPickerOpen(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    setItemReminderTime(formatReminderTime(selectedDate));
  };

  const confirmWebReminder = () => {
    if (!/^\d{2}:\d{2}$/.test(webReminderTime)) {
      Alert.alert('Giờ chưa hợp lệ', 'Nhập giờ theo định dạng HH:mm.');
      return;
    }
    setItemReminderTime(webReminderTime);
    setIsReminderPickerOpen(false);
  };

  const updateDraftItem = (itemId: string, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const renderDraftItem = ({ item, drag, isActive }: RenderItemParams<DraftItem>) => (
    <View style={[styles.previewItem, isActive && styles.previewItemActive]}>
      <Pressable accessibilityRole="button" onLongPress={drag} style={styles.dragHandle}>
        <GripVertical size={18} color={colors.muted} strokeWidth={2.2} />
      </Pressable>
      <View style={styles.previewCopy}>
        <TextInput
          value={item.title}
          onChangeText={(value) => updateDraftItem(item.id, { title: value })}
          placeholder="Tên việc"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.previewTextInput}
        />
        <TextInput
          value={item.description ?? ''}
          onChangeText={(value) => updateDraftItem(item.id, { description: value })}
          placeholder="Ghi chú"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.previewDescriptionInput}
        />
        {item.reminderTime ? (
          <View style={styles.previewReminderTag}>
            <Clock size={12} color={colors.forest} strokeWidth={2.2} />
            <Text style={styles.previewReminderText}>{item.reminderTime}</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))}
        style={styles.removeButton}
      >
        <X size={18} color={colors.muted} strokeWidth={2.6} />
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.keyboard}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>Thử thách mới</Text>
          <Pressable accessibilityRole="button" onPress={save} style={styles.createTopButton}>
            <Text style={styles.createTopText}>Tạo</Text>
          </Pressable>
        </View>

        <View style={styles.formBlock}>
          <Text style={styles.label}>Tên thử thách</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Học tiếng Anh"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.formBlock}>
          <Text style={styles.label}>Bắt đầu</Text>
          <View style={styles.segmented}>
            {startOptions.map((option) => {
              const isActive = startOption === option.value;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setStartOption(option.value)}
                  style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {startOption === 'custom' ? (
            <View style={styles.datePickerBlock}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsDatePickerOpen(true)}
                style={styles.datePickerButton}
              >
                <Text style={styles.datePickerText}>{formatShortDate(customStartDate)}</Text>
              </Pressable>
              {(isDatePickerOpen || Platform.OS === 'ios') && Platform.OS !== 'web' ? (
                <DateTimePicker
                  value={dateFromKey(customStartDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'compact' : 'default'}
                  minimumDate={dateFromKey(today)}
                  maximumDate={dateFromKey(latestStartDate)}
                  onChange={handleDateChange}
                />
              ) : null}
              {Platform.OS === 'web' ? (
                <TextInput
                  value={customStartDate}
                  onChangeText={setCustomStartDate}
              placeholder="Chọn ngày"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.formBlock}>
          <Text style={styles.label}>Thử thách trong bao lâu?</Text>
          <View style={styles.segmented}>
            {durationOptions.map((option) => {
              const isActive = durationOption === option.value;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setDurationOption(option.value)}
                  style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {durationOption === 'custom' ? (
            <TextInput
              value={customDays}
              onChangeText={setCustomDays}
              placeholder="Nhập số ngày"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={styles.input}
            />
          ) : null}
        </View>

        <View style={styles.preview}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Danh sách việc</Text>
            <View style={styles.previewActions}>
              <Pressable accessibilityRole="button" onPress={downloadSampleExcel} style={styles.previewImportButton}>
                <Download size={15} color={colors.ink} strokeWidth={2.3} />
                <Text style={styles.previewImportText}>Mẫu</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={importExcelItems} style={styles.previewImportButton}>
                <FileSpreadsheet size={16} color={colors.ink} strokeWidth={2.2} />
                <Text style={styles.previewImportText}>Excel</Text>
              </Pressable>
            </View>
          </View>
          {items.length === 0 ? (
            <Text style={styles.empty}>Danh sách còn trống. Import Excel để thêm nhiều việc cùng lúc.</Text>
          ) : (
            <DraggableFlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderDraftItem}
              onDragEnd={({ data }) => setItems(data)}
              scrollEnabled={false}
              activationDistance={8}
            />
          )}
        </View>

      </ScrollView>

      <View style={styles.fixedAction}>
        {itemReminderTime ? (
          <View style={styles.reminderTagRow}>
            <View style={styles.reminderTag}>
              <Clock size={14} color={colors.forest} strokeWidth={2.3} />
              <Text style={styles.reminderTagText}>Nhắc lúc {itemReminderTime}</Text>
              <Pressable accessibilityRole="button" onPress={() => setItemReminderTime(undefined)} style={styles.reminderTagRemove}>
                <X size={14} color={colors.muted} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.inputWithIcon}>
          <TextInput
            value={itemTitle}
            onChangeText={setItemTitle}
            onSubmitEditing={addItem}
            placeholder="Việc cần làm"
            placeholderTextColor={colors.muted}
            returnKeyType="next"
            maxLength={CHECKLIST_TITLE_LIMIT}
            style={[styles.input, styles.composerInput, styles.inputWithRightIcon]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Chọn giờ nhắc nhở" onPress={openReminderPicker} style={styles.inputIconButton}>
            <Clock size={20} color={itemReminderTime ? colors.forest : colors.muted} strokeWidth={2.4} />
          </Pressable>
        </View>
        {!isNoteOpen ? (
          <Pressable accessibilityRole="button" onPress={() => setIsNoteOpen(true)} style={styles.noteButton}>
            <FileText size={18} color={colors.muted} strokeWidth={2.2} />
            <Text style={styles.noteButtonText}>Thêm ghi chú</Text>
          </Pressable>
        ) : null}
        {isNoteOpen ? (
          <TextInput
            value={itemDescription}
            onChangeText={setItemDescription}
            placeholder="Ghi chú thêm"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, styles.descriptionInput, styles.composerInput]}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!canAddItem}
          onPress={addItem}
          style={[styles.addItemButton, !canAddItem && styles.addItemButtonDisabled]}
        >
          <Text style={[styles.addItemText, !canAddItem && styles.addItemTextDisabled]}>Thêm vào danh sách</Text>
        </Pressable>
      </View>
      <Modal visible={isReminderPickerOpen} transparent animationType="slide" onRequestClose={() => setIsReminderPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.timePickerCard}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>Chọn giờ nhắc nhở</Text>
              <Pressable accessibilityRole="button" onPress={() => setIsReminderPickerOpen(false)} style={styles.timePickerClose}>
                <X size={20} color={colors.ink} strokeWidth={2.4} />
              </Pressable>
            </View>
            {Platform.OS === 'web' ? (
              <>
                <TextInput
                  value={webReminderTime}
                  onChangeText={setWebReminderTime}
                  placeholder="08:00"
                  placeholderTextColor={colors.muted}
                  style={styles.timeInput}
                />
                <Pressable accessibilityRole="button" onPress={confirmWebReminder} style={styles.timeConfirmButton}>
                  <Text style={styles.timeConfirmText}>Chọn giờ</Text>
                </Pressable>
              </>
            ) : (
              <DateTimePicker
                value={dateFromReminderTime(itemReminderTime)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleReminderChange}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  content: {
    padding: 18,
    gap: 18,
    paddingBottom: 250,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  createTopButton: {
    minWidth: 58,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest,
    paddingHorizontal: 14,
  },
  createTopText: {
    color: colors.surface,
    fontSize: 15,
    fontFamily: typography.semiBold,
  },
  headerTitle: {
    position: 'absolute',
    left: 58,
    right: 58,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: typography.semiBold,
    textAlign: 'center',
  },
  formBlock: {
    gap: 8,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: typography.semiBold,
  },
  input: {
    minHeight: 52,
    borderRadius: 999,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 16,
    fontFamily: typography.regular,
  },
  datePickerBlock: {
    gap: 10,
  },
  datePickerButton: {
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  datePickerText: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: typography.medium,
  },
  noteButton: {
    minHeight: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noteButtonText: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: typography.medium,
  },
  addItemButton: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  addItemButtonDisabled: {
    backgroundColor: colors.line,
  },
  addItemText: {
    color: colors.surface,
    fontSize: 15,
    fontFamily: typography.semiBold,
  },
  addItemTextDisabled: {
    color: colors.muted,
  },
  segmented: {
    minHeight: 52,
    flexDirection: 'row',
    gap: 4,
    borderRadius: 999,
    padding: 4,
    backgroundColor: colors.softSurface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    borderColor: colors.ink,
    backgroundColor: colors.ink,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: typography.semiBold,
  },
  segmentTextActive: {
    color: colors.surface,
  },
  descriptionInput: {
    minHeight: 72,
    borderRadius: 26,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  preview: {
    minHeight: 132,
    borderRadius: 20,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.035,
    shadowRadius: 18,
    elevation: 1,
  },
  previewHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontFamily: typography.semiBold,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewImportButton: {
    minHeight: 38,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    backgroundColor: colors.softSurface,
  },
  previewImportText: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: typography.medium,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  previewItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 4,
  },
  previewItemActive: {
    backgroundColor: colors.softSurface,
  },
  dragHandle: {
    width: 30,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIndex: {
    width: 26,
    height: 26,
    borderRadius: 8,
    textAlign: 'center',
    lineHeight: 26,
    overflow: 'hidden',
    color: colors.ink,
    backgroundColor: colors.softSurface,
    borderWidth: 1,
    borderColor: colors.line,
    fontFamily: typography.semiBold,
  },
  previewText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: typography.semiBold,
  },
  previewTextInput: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: typography.semiBold,
    padding: 0,
    margin: 0,
    minHeight: 24,
  },
  previewCopy: {
    flex: 1,
    paddingVertical: 8,
  },
  previewDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: typography.regular,
    marginTop: 2,
  },
  previewDescriptionInput: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: typography.regular,
    padding: 0,
    margin: 0,
    minHeight: 22,
    marginTop: 2,
  },
  previewReminderTag: {
    alignSelf: 'flex-start',
    minHeight: 24,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    backgroundColor: colors.softSurface,
    marginTop: 6,
  },
  previewReminderText: {
    color: colors.forest,
    fontSize: 12,
    fontFamily: typography.medium,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  fixedAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.canvas,
    gap: 10,
  },
  reminderTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderTag: {
    minHeight: 34,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 12,
    paddingRight: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  reminderTagText: {
    color: colors.ink,
    fontSize: 13,
    fontFamily: typography.medium,
  },
  reminderTagRemove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputWithRightIcon: {
    paddingRight: 54,
  },
  inputIconButton: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  composerInput: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  composerShadow: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  timePickerCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 14,
  },
  timePickerHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timePickerTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: typography.semiBold,
  },
  timePickerClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  timeInput: {
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.softSurface,
    paddingHorizontal: 16,
    color: colors.ink,
    fontSize: 20,
    fontFamily: typography.semiBold,
    textAlign: 'center',
  },
  timeConfirmButton: {
    minHeight: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  timeConfirmText: {
    color: colors.surface,
    fontSize: 15,
    fontFamily: typography.semiBold,
  },
});
