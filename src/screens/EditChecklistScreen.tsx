import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, Clock, FileText, GripVertical, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';

import { Checklist } from '../domain/types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { CHECKLIST_TITLE_LIMIT, splitChecklistText } from '../utils/checklistText';
import { addDays, compareDateKeys, dateFromKey, formatShortDate, toDateKey } from '../utils/date';

type Props = {
  checklist: Checklist;
  onClose: () => void;
  onSave: (
    checklistId: string,
    title: string,
    items: Array<{ id?: string; title: string; description?: string; reminderTime?: string; isDone?: boolean }>,
    durationDays: number,
    startDate: string,
  ) => void;
  onDelete: (checklistId: string) => void;
};

type DurationOption = 30 | 60 | 100 | 'custom';
type StartOption = 'today' | 'tomorrow' | 'custom';

type DraftItem = {
  id?: string;
  draftId: string;
  title: string;
  description?: string;
  reminderTime?: string;
  isDone?: boolean;
};

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

const MAX_DURATION_DAYS = 365;
const makeDraftId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function getDurationOption(durationDays: number): DurationOption {
  return durationDays === 30 || durationDays === 60 || durationDays === 100 ? durationDays : 'custom';
}

function getInitialStartOption(startDate: string): StartOption {
  const today = toDateKey();
  if (startDate === today) return 'today';
  if (startDate === addDays(today, 1)) return 'tomorrow';
  return 'custom';
}

function normalizeText(value?: string) {
  return value?.trim() ?? '';
}

export function EditChecklistScreen({ checklist, onClose, onSave, onDelete }: Props) {
  const today = toDateKey();
  const hasStarted = compareDateKeys(checklist.startDate, today) <= 0;
  const initialDurationOption = useMemo(() => getDurationOption(checklist.durationDays), [checklist.durationDays]);
  const [title, setTitle] = useState(checklist.title);
  const [durationOption, setDurationOption] = useState<DurationOption>(initialDurationOption);
  const [customDays, setCustomDays] = useState(String(checklist.durationDays));
  const [startOption, setStartOption] = useState<StartOption>(getInitialStartOption(checklist.startDate));
  const [customStartDate, setCustomStartDate] = useState(checklist.startDate);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemReminderTime, setItemReminderTime] = useState<string>();
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
  const [webReminderTime, setWebReminderTime] = useState('08:00');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [items, setItems] = useState<DraftItem[]>(
    checklist.items.map((item) => normalizeDraftItem({
      id: item.id,
      draftId: item.id,
      title: item.title,
      description: item.description,
      reminderTime: item.reminderTime,
      isDone: item.isDone,
    })),
  );
  const canAddItem = itemTitle.trim().length > 0;

  const latestStartDate = addDays(today, 45);
  const durationDays = durationOption === 'custom' ? Number.parseInt(customDays.trim(), 10) : durationOption;
  const startDate = hasStarted
    ? checklist.startDate
    : startOption === 'today'
      ? today
      : startOption === 'tomorrow'
        ? addDays(today, 1)
        : customStartDate.trim();
  const hasChanges =
    normalizeText(title) !== checklist.title ||
    durationDays !== checklist.durationDays ||
    startDate !== checklist.startDate ||
    items.length !== checklist.items.length ||
    items.some((item, index) => {
      const original = checklist.items[index];
      return (
        !original ||
        item.id !== original.id ||
        normalizeText(item.title) !== original.title ||
        normalizeText(item.description) !== normalizeText(original.description) ||
        item.reminderTime !== original.reminderTime ||
        Boolean(item.isDone) !== original.isDone
      );
    });

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
      normalizeDraftItem({ draftId: makeDraftId(), title: cleanTitle, description: cleanDescription || undefined, reminderTime: itemReminderTime, isDone: false }),
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
      Alert.alert('Chưa có việc nào', 'Giữ ít nhất một việc để tiếp tục theo dõi.');
      return;
    }

    if (!hasChanges) return;

    if (!Number.isFinite(durationDays) || durationDays < 1) {
      Alert.alert('Số ngày chưa hợp lệ', 'Nhập số ngày lớn hơn 0.');
      return;
    }
    if (durationDays > MAX_DURATION_DAYS) {
      Alert.alert('Thời lượng quá dài', `Chọn tối đa ${MAX_DURATION_DAYS} ngày cho một thử thách.`);
      return;
    }

    if (!hasStarted && (compareDateKeys(startDate, today) < 0 || compareDateKeys(startDate, latestStartDate) > 0)) {
      Alert.alert('Ngày bắt đầu chưa hợp lệ', `Chọn từ ${formatShortDate(today)} đến ${formatShortDate(latestStartDate)}.`);
      return;
    }

    onSave(
      checklist.id,
      cleanTitle,
      items.map(({ id, title, description, reminderTime, isDone }) => ({ id, title, description, reminderTime, isDone })),
      durationDays,
      startDate,
    );
  };

  const deleteChallenge = () => {
    setIsDeleteModalOpen(false);
    onDelete(checklist.id);
  };

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

  const updateDraftItem = (draftId: string, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((item) => (item.draftId === draftId ? { ...item, ...patch } : item)));
  };

  const renderDraftItem = ({ item, drag, isActive }: RenderItemParams<DraftItem>) => (
    <View style={[styles.previewItem, isActive && styles.previewItemActive]}>
      <Pressable accessibilityRole="button" onLongPress={drag} style={styles.dragHandle}>
        <GripVertical size={18} color={colors.muted} strokeWidth={2.2} />
      </Pressable>
      <View style={styles.previewCopy}>
        <TextInput
          value={item.title}
          onChangeText={(value) => updateDraftItem(item.draftId, { title: value })}
          placeholder="Tên việc"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.previewTextInput}
        />
        <TextInput
          value={item.description ?? ''}
          onChangeText={(value) => updateDraftItem(item.draftId, { description: value })}
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
        onPress={() => setItems((current) => current.filter((currentItem) => currentItem.draftId !== item.draftId))}
        style={styles.removeButton}
      >
        <X size={18} color={colors.muted} strokeWidth={2.6} />
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.keyboard}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>Chỉnh thử thách</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!hasChanges}
            onPress={save}
            style={[styles.saveTopButton, !hasChanges && styles.saveTopButtonDisabled]}
          >
            <Text style={[styles.saveTopText, !hasChanges && styles.saveTopTextDisabled]}>Lưu</Text>
          </Pressable>
        </View>

        <View style={styles.formBlock}>
          <Text style={styles.label}>Tên thử thách</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Ví dụ: Học tiếng Anh" placeholderTextColor={colors.muted} style={styles.input} />
        </View>

        {!hasStarted ? (
          <View style={styles.formBlock}>
            <Text style={styles.label}>Bắt đầu</Text>
            <View style={styles.segmented}>
              {startOptions.map((option) => {
                const isActive = startOption === option.value;
                return (
                  <Pressable key={option.label} accessibilityRole="button" onPress={() => setStartOption(option.value)} style={[styles.segmentButton, isActive && styles.segmentButtonActive]}>
                    <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {startOption === 'custom' ? (
              <View style={styles.datePickerBlock}>
                <Pressable accessibilityRole="button" onPress={() => setIsDatePickerOpen(true)} style={styles.datePickerButton}>
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
                  <TextInput value={customStartDate} onChangeText={setCustomStartDate} placeholder="Chọn ngày" placeholderTextColor={colors.muted} style={styles.input} />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.formBlock}>
          <Text style={styles.label}>Thời lượng</Text>
          <View style={styles.segmented}>
            {durationOptions.map((option) => {
              const isActive = durationOption === option.value;
              return (
                <Pressable key={option.label} accessibilityRole="button" onPress={() => setDurationOption(option.value)} style={[styles.segmentButton, isActive && styles.segmentButtonActive]}>
                  <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {durationOption === 'custom' ? (
            <TextInput value={customDays} onChangeText={setCustomDays} placeholder="Nhập số ngày" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} />
          ) : null}
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Việc cần làm</Text>
          <DraggableFlatList
            data={items}
            keyExtractor={(item) => item.draftId}
            renderItem={renderDraftItem}
            onDragEnd={({ data }) => setItems(data)}
            scrollEnabled={false}
            activationDistance={8}
          />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setIsDeleteModalOpen(true)} style={styles.deleteButton}>
          <Trash2 size={16} color={colors.muted} strokeWidth={2.2} />
          <Text style={styles.deleteText}>Xoá thử thách</Text>
        </Pressable>
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
          <TextInput value={itemDescription} onChangeText={setItemDescription} placeholder="Ghi chú thêm" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.descriptionInput, styles.composerInput]} />
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
        <View style={styles.reminderModalBackdrop}>
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

      <Modal
        visible={isDeleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Trash2 size={28} color={colors.forest} strokeWidth={2.4} />
            </View>
            <Text style={styles.confirmTitle}>Xoá thử thách?</Text>
            <Text style={styles.confirmText}>Lịch sử của thử thách này cũng sẽ được xoá.</Text>
            <View style={styles.confirmActions}>
              <Pressable accessibilityRole="button" onPress={() => setIsDeleteModalOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Huỷ</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={deleteChallenge} style={styles.confirmDeleteButton}>
                <Text style={styles.confirmDeleteText}>Xoá</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  content: { padding: 18, gap: 18, paddingBottom: 250 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  backButton: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  saveTopButton: { minWidth: 58, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest, paddingHorizontal: 16 },
  saveTopButtonDisabled: { backgroundColor: colors.softLine },
  saveTopText: { color: colors.surface, fontSize: 15, fontFamily: typography.semiBold },
  saveTopTextDisabled: { color: colors.muted },
  headerTitle: { position: 'absolute', left: 58, right: 58, color: colors.ink, fontSize: 16, lineHeight: 22, fontFamily: typography.semiBold, textAlign: 'center' },
  formBlock: { gap: 8 },
  label: { color: colors.ink, fontSize: 14, fontFamily: typography.semiBold },
  input: { minHeight: 52, borderRadius: 999, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, paddingHorizontal: 16, color: colors.ink, fontSize: 16, fontFamily: typography.regular },
  segmented: { minHeight: 52, borderRadius: 999, padding: 4, flexDirection: 'row', gap: 4, backgroundColor: colors.softSurface, borderWidth: 1, borderColor: colors.line },
  segmentButton: { flex: 1, minHeight: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentButtonActive: { backgroundColor: colors.ink },
  segmentText: { color: colors.muted, fontSize: 13, fontFamily: typography.semiBold },
  segmentTextActive: { color: colors.surface },
  datePickerBlock: { gap: 10 },
  datePickerButton: { minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  datePickerText: { color: colors.ink, fontSize: 16, fontFamily: typography.medium },
  preview: { minHeight: 132, borderRadius: 20, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, padding: 16, gap: 10 },
  previewTitle: { color: colors.ink, fontSize: 16, fontFamily: typography.semiBold },
  previewItem: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, paddingHorizontal: 4 },
  previewItemActive: { backgroundColor: colors.softSurface },
  dragHandle: { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1, paddingVertical: 8 },
  previewText: { color: colors.ink, fontSize: 15, lineHeight: 21, fontFamily: typography.semiBold },
  previewTextInput: { color: colors.ink, fontSize: 15, lineHeight: 21, fontFamily: typography.semiBold, padding: 0, margin: 0, minHeight: 24 },
  previewDescription: { color: colors.muted, fontSize: 13, lineHeight: 19, fontFamily: typography.regular, marginTop: 2 },
  previewDescriptionInput: { color: colors.muted, fontSize: 13, lineHeight: 19, fontFamily: typography.regular, padding: 0, margin: 0, minHeight: 22, marginTop: 2 },
  previewReminderTag: { alignSelf: 'flex-start', minHeight: 24, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, backgroundColor: colors.softSurface, marginTop: 6 },
  previewReminderText: { color: colors.forest, fontSize: 12, fontFamily: typography.medium },
  removeButton: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface, borderWidth: 1, borderColor: colors.line },
  deleteButton: { minHeight: 44, alignSelf: 'center', borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, marginTop: -6 },
  deleteText: { color: colors.muted, fontSize: 13, fontFamily: typography.regular },
  fixedAction: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, backgroundColor: colors.canvas, gap: 10 },
  reminderTagRow: { flexDirection: 'row', alignItems: 'center' },
  reminderTag: { minHeight: 34, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 12, paddingRight: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  reminderTagText: { color: colors.ink, fontSize: 13, fontFamily: typography.medium },
  reminderTagRemove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface },
  inputWithIcon: { position: 'relative' },
  inputWithRightIcon: { paddingRight: 54 },
  inputIconButton: { position: 'absolute', top: 6, right: 8, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface },
  composerInput: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 2 },
  composerShadow: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 2 },
  noteButton: { minHeight: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  noteButtonText: { color: colors.muted, fontSize: 15, fontFamily: typography.medium },
  descriptionInput: { minHeight: 72, borderRadius: 26, paddingTop: 14, textAlignVertical: 'top' },
  addItemButton: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  addItemButtonDisabled: { backgroundColor: colors.line },
  addItemText: { color: colors.surface, fontSize: 15, fontFamily: typography.semiBold },
  addItemTextDisabled: { color: colors.muted },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  confirmCard: { width: '100%', maxWidth: 360, borderRadius: 24, backgroundColor: colors.surface, padding: 20, alignItems: 'center', gap: 12 },
  confirmIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface, borderWidth: 1, borderColor: colors.line },
  confirmTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontFamily: typography.semiBold, textAlign: 'center' },
  confirmText: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: typography.regular, textAlign: 'center' },
  confirmActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  cancelButton: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface, borderWidth: 1, borderColor: colors.line },
  cancelText: { color: colors.ink, fontSize: 14, fontFamily: typography.semiBold },
  confirmDeleteButton: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  confirmDeleteText: { color: colors.surface, fontSize: 14, fontFamily: typography.semiBold },
  reminderModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  timePickerCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, padding: 18, gap: 14 },
  timePickerHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timePickerTitle: { color: colors.ink, fontSize: 22, lineHeight: 28, fontFamily: typography.semiBold },
  timePickerClose: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface },
  timeInput: { minHeight: 56, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.softSurface, paddingHorizontal: 16, color: colors.ink, fontSize: 20, fontFamily: typography.semiBold, textAlign: 'center' },
  timeConfirmButton: { minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  timeConfirmText: { color: colors.surface, fontSize: 15, fontFamily: typography.semiBold },
});
