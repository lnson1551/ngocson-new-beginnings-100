import { CalendarClock, Check, ChevronLeft, MoreHorizontal, Pencil, Share2, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Checklist, ChecklistDayRecord } from '../domain/types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { addDays, compareDateKeys, dateFromKey, formatShortDate, toDateKey } from '../utils/date';

type Props = {
  checklist: Checklist;
  history: ChecklistDayRecord[];
  onBack: () => void;
  onEdit: () => void;
  onToggleHistoryItem: (checklistId: string, date: string, itemId: string) => void;
  onUpdateSchedule: (checklistId: string, startDate: string, durationDays: number) => void;
  onDelete: (checklistId: string) => void;
};

type TrackingMode = 'daily' | 'weekly';
const trackingModes: Array<{ label: string; value: TrackingMode }> = [
  { label: 'Ngày', value: 'daily' },
  { label: 'Tuần', value: 'weekly' },
];

function getDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  let cursor = startDate;
  while (compareDateKeys(cursor, endDate) <= 0 && dates.length < 140) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function getCompletionRatio(checklist: Checklist, history: ChecklistDayRecord[], date: string) {
  const record = history.find((item) => item.checklistId === checklist.id && item.date === date);
  if (!record || checklist.items.length === 0) return 0;
  return record.completedItemIds.length / checklist.items.length;
}

function getWeekKey(dateKey: string) {
  const date = dateFromKey(dateKey);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return toDateKey(date);
}

function getTrackingDates(startDate: string, endDate: string) {
  const allDates = getDateRange(startDate, endDate);
  return allDates.slice(Math.max(0, allDates.length - 126));
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getMonthSections(startDate: string, endDate: string) {
  const sections: Array<{ key: string; label: string; dates: string[] }> = [];
  const start = dateFromKey(startDate);
  const end = dateFromKey(endDate);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const dates = Array.from({ length: getDaysInMonth(year, monthIndex) }, (_, index) =>
      toDateKey(new Date(year, monthIndex, index + 1)),
    );

    sections.push({
      key: `${year}-${monthIndex + 1}`,
      label: `Thg ${monthIndex + 1}`,
      dates,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return sections;
}

function getHistoryMonthSections(dates: string[]) {
  return dates.reduceRight<Array<{ key: string; label: string; dates: string[] }>>((sections, dateKey) => {
    const date = dateFromKey(dateKey);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const current = sections[sections.length - 1];

    if (current?.key === key) {
      current.dates.push(dateKey);
      return sections;
    }

    sections.push({
      key,
      label: `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`,
      dates: [dateKey],
    });
    return sections;
  }, []);
}

function getDayNumber(dateKey: string) {
  return String(dateFromKey(dateKey).getDate());
}

function getTrackingRatio(
  mode: TrackingMode,
  date: string,
  dates: string[],
  checklist: Checklist,
  history: ChecklistDayRecord[],
) {
  if (mode === 'daily') return getCompletionRatio(checklist, history, date);

  if (mode === 'weekly') {
    const weekKey = getWeekKey(date);
    const weekDates = dates.filter((item) => getWeekKey(item) === weekKey);
    const total = weekDates.reduce((sum, item) => sum + getCompletionRatio(checklist, history, item), 0);
    return weekDates.length === 0 ? 0 : total / weekDates.length;
  }

  return 0;
}

function getElapsedDays(startDate: string, endDate: string) {
  const today = toDateKey();
  if (compareDateKeys(today, startDate) < 0) return 0;
  const cappedToday = compareDateKeys(today, endDate) > 0 ? endDate : today;
  const start = dateFromKey(startDate).getTime();
  const end = dateFromKey(cappedToday).getTime();
  return Math.floor((end - start) / 86400000) + 1;
}

export function ChecklistDetailScreen({
  checklist,
  history,
  onBack,
  onEdit,
  onToggleHistoryItem,
  onUpdateSchedule,
  onDelete,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string>();
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('daily');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(checklist.startDate);
  const [draftDurationDays, setDraftDurationDays] = useState(String(checklist.durationDays));

  const today = toDateKey();
  const dateCards = useMemo(() => getDateRange(checklist.startDate, checklist.endDate), [checklist]);
  const historyDates = useMemo(
    () => dateCards.filter((dateKey) => compareDateKeys(dateKey, today) <= 0),
    [dateCards, today],
  );
  const historyMonthSections = useMemo(() => getHistoryMonthSections(historyDates), [historyDates]);
  const visibleTrackingEndDate = compareDateKeys(today, checklist.endDate) > 0 ? checklist.endDate : today;
  const trackingDates = useMemo(
    () =>
      compareDateKeys(visibleTrackingEndDate, checklist.startDate) < 0
        ? []
        : getTrackingDates(checklist.startDate, visibleTrackingEndDate),
    [checklist.startDate, visibleTrackingEndDate],
  );
  const monthSections = useMemo(
    () =>
      compareDateKeys(visibleTrackingEndDate, checklist.startDate) < 0
        ? []
        : getMonthSections(checklist.startDate, visibleTrackingEndDate),
    [checklist.startDate, visibleTrackingEndDate],
  );
  const elapsedDays = getElapsedDays(checklist.startDate, checklist.endDate);
  const selectedRecord = selectedDate
    ? history.find((record) => record.checklistId === checklist.id && record.date === selectedDate)
    : undefined;
  const selectedCompletedIds = selectedRecord?.completedItemIds ?? [];
  const selectedDoneItems = checklist.items.filter((item) => selectedCompletedIds.includes(item.id));
  const selectedTodoItems = checklist.items.filter((item) => !selectedCompletedIds.includes(item.id));
  const editableHistoryStartDate = addDays(today, -2);
  const canEditSelectedDate = Boolean(
    selectedDate &&
      compareDateKeys(selectedDate, editableHistoryStartDate) >= 0 &&
      compareDateKeys(selectedDate, today) <= 0,
  );
  const shareChallenge = () => {
    void Share.share({
      message: `${checklist.title}\n${formatShortDate(checklist.startDate)} - ${formatShortDate(checklist.endDate)} · ${checklist.durationDays} ngày`,
    });
  };
  const openScheduleModal = () => {
    setDraftStartDate(checklist.startDate);
    setDraftDurationDays(String(checklist.durationDays));
    setIsMoreOpen(false);
    setIsScheduleOpen(true);
  };
  const saveSchedule = () => {
    const nextDuration = Number.parseInt(draftDurationDays.trim(), 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftStartDate.trim()) || !Number.isFinite(nextDuration) || nextDuration < 1 || nextDuration > 365) {
      return;
    }

    onUpdateSchedule(checklist.id, draftStartDate.trim(), nextDuration);
    setIsScheduleOpen(false);
  };
  const deleteChecklist = () => {
    setIsDeleteConfirmOpen(false);
    setIsMoreOpen(false);
    onDelete(checklist.id);
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
            <ChevronLeft size={24} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>Chi tiết thử thách</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Chia sẻ" onPress={shareChallenge} style={styles.iconButton}>
            <Share2 size={21} color={colors.ink} strokeWidth={2.3} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.title}>{checklist.title}</Text>
          <Text style={styles.meta}>
            {formatShortDate(checklist.startDate)} - {formatShortDate(checklist.endDate)} · {checklist.durationDays} ngày
          </Text>
          <View style={styles.heroActions}>
            <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editButton}>
              <Pencil size={15} color={colors.surface} strokeWidth={2.4} />
              <Text style={styles.editText}>Chỉnh sửa</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Mở tuỳ chọn" onPress={() => setIsMoreOpen(true)} style={styles.moreButton}>
              <MoreHorizontal size={22} color={colors.ink} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        <View style={styles.trackingCard}>
          <View style={styles.trackingTabs}>
            {trackingModes.map((mode) => {
              const isActive = trackingMode === mode.value;
              return (
                <Pressable
                  key={mode.value}
                  accessibilityRole="button"
                  onPress={() => setTrackingMode(mode.value)}
                  style={[styles.trackingTabButton, isActive && styles.trackingTabButtonActive]}
                >
                  <Text style={[styles.trackingTabText, isActive && styles.trackingTabTextActive]}>{mode.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackingScroll}>
            {monthSections.map((section) => (
              <View key={section.key} style={styles.monthSection}>
                <View style={styles.monthGrid}>
                  {section.dates.map((dateKey) => {
                    const ratio = getTrackingRatio(trackingMode, dateKey, trackingDates, checklist, history);
                    const isInsideChallenge =
                      compareDateKeys(dateKey, checklist.startDate) >= 0 &&
                      compareDateKeys(dateKey, checklist.endDate) <= 0;
                    return (
                      <View
                        key={dateKey}
                        style={[
                          styles.trackingDot,
                          !isInsideChallenge && styles.trackingDotOutside,
                          ratio >= 1 && styles.trackingDotDone,
                          ratio > 0 && ratio < 1 && styles.trackingDotPartial,
                        ]}
                      />
                    );
                  })}
                </View>
                <Text style={styles.monthLabel}>{section.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Lịch sử</Text>
            <Text style={styles.timelineText}>
              Đang ở ngày {elapsedDays}/{checklist.durationDays}
            </Text>
          </View>
          <View style={styles.historyMonths}>
            {historyMonthSections.map((section) => (
              <View key={section.key} style={styles.historyMonth}>
                <Text style={styles.historyMonthTitle}>{section.label}</Text>
                <View style={styles.dayGrid}>
                  {section.dates.map((dateKey) => {
                    const record = history.find((item) => item.checklistId === checklist.id && item.date === dateKey);
                    const completed = record?.completedItemIds.length ?? 0;
                    const total = checklist.items.length;
                    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
                    const isComplete = total > 0 && completed >= total;

                    return (
                      <Pressable
                        key={dateKey}
                        accessibilityRole="button"
                        onPress={() => setSelectedDate(dateKey)}
                        style={[styles.daySummaryCard, isComplete && styles.daySummaryCardComplete]}
                      >
                        <Text style={[styles.dayTitle, isComplete && styles.dayTitleComplete]}>{getDayNumber(dateKey)}</Text>
                        <Text style={[styles.dayMeta, isComplete && styles.dayMetaComplete]}>
                          {completed}/{total} · {percentage}%
                        </Text>
                        {isComplete ? (
                          <View style={styles.completeMark}>
                            <Check size={12} color={colors.surface} strokeWidth={3} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      <Modal visible={Boolean(selectedDate)} transparent animationType="slide" onRequestClose={() => setSelectedDate(undefined)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Chi tiết ngày</Text>
                <Text style={styles.modalTitle}>Ngày {selectedDate ? formatShortDate(selectedDate) : ''}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setSelectedDate(undefined)} style={styles.modalClose}>
                <X size={20} color={colors.ink} strokeWidth={2.4} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryNumber}>
                  {selectedDoneItems.length}/{checklist.items.length}
                </Text>
                <Text style={styles.modalSummaryText}>việc đã hoàn thành</Text>
              </View>
              {!canEditSelectedDate ? (
                <Text style={styles.lockedNotice}>Chỉ có thể chỉnh sửa 3 ngày gần nhất.</Text>
              ) : null}

              <View style={styles.taskGroup}>
                <View style={styles.taskGroupHeader}>
                  <Text style={styles.subTitle}>Đã thực hiện</Text>
                  <Text style={styles.taskCount}>{selectedDoneItems.length}</Text>
                </View>
                {selectedDoneItems.length === 0 ? (
                  <Text style={styles.empty}>Chưa có việc hoàn thành.</Text>
                ) : null}
                {selectedDoneItems.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: true }}
                    disabled={!canEditSelectedDate}
                    onPress={() => selectedDate && canEditSelectedDate && onToggleHistoryItem(checklist.id, selectedDate, item.id)}
                    style={({ pressed }) => [
                      styles.taskRow,
                      !canEditSelectedDate && styles.taskRowDisabled,
                      pressed && styles.taskRowPressed,
                    ]}
                  >
                    <View style={[styles.taskDot, styles.taskDotDone]}>
                      <Check size={11} color={colors.surface} strokeWidth={3} />
                    </View>
                    <Text style={styles.itemLine}>{item.title}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.taskGroup}>
                <View style={styles.taskGroupHeader}>
                  <Text style={styles.subTitle}>Chưa thực hiện</Text>
                  <Text style={styles.taskCount}>{selectedTodoItems.length}</Text>
                </View>
                {selectedTodoItems.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: false }}
                    disabled={!canEditSelectedDate}
                    onPress={() => selectedDate && canEditSelectedDate && onToggleHistoryItem(checklist.id, selectedDate, item.id)}
                    style={({ pressed }) => [
                      styles.taskRow,
                      !canEditSelectedDate && styles.taskRowDisabled,
                      pressed && styles.taskRowPressed,
                    ]}
                  >
                    <View style={styles.taskDot} />
                    <Text style={styles.itemLine}>{item.title}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isMoreOpen} transparent animationType="fade" onRequestClose={() => setIsMoreOpen(false)}>
        <View style={styles.actionBackdrop}>
          <View style={styles.actionSheet}>
            <View style={styles.actionHeader}>
              <Text style={styles.actionTitle}>Tuỳ chọn</Text>
              <Pressable accessibilityRole="button" onPress={() => setIsMoreOpen(false)} style={styles.actionClose}>
                <X size={20} color={colors.ink} strokeWidth={2.4} />
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" onPress={openScheduleModal} style={styles.actionRow}>
              <View style={styles.actionIcon}>
                <CalendarClock size={20} color={colors.ink} strokeWidth={2.3} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionRowTitle}>Thay đổi thời gian</Text>
                <Text style={styles.actionRowText}>Đổi ngày bắt đầu hoặc thời lượng.</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsMoreOpen(false);
                setIsDeleteConfirmOpen(true);
              }}
              style={styles.actionRow}
            >
              <View style={styles.actionIcon}>
                <Trash2 size={20} color={colors.ink} strokeWidth={2.3} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionRowTitle}>Xoá thử thách</Text>
                <Text style={styles.actionRowText}>Xoá thử thách và lịch sử liên quan.</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={isScheduleOpen} transparent animationType="slide" onRequestClose={() => setIsScheduleOpen(false)}>
        <View style={styles.actionBackdrop}>
          <View style={styles.scheduleCard}>
            <View style={styles.actionHeader}>
              <Text style={styles.actionTitle}>Thay đổi thời gian</Text>
              <Pressable accessibilityRole="button" onPress={() => setIsScheduleOpen(false)} style={styles.actionClose}>
                <X size={20} color={colors.ink} strokeWidth={2.4} />
              </Pressable>
            </View>
            <View style={styles.scheduleForm}>
              <View style={styles.scheduleField}>
                <Text style={styles.scheduleLabel}>Ngày bắt đầu</Text>
                <TextInput
                  value={draftStartDate}
                  onChangeText={setDraftStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  style={styles.scheduleInput}
                />
              </View>
              <View style={styles.scheduleField}>
                <Text style={styles.scheduleLabel}>Thời lượng</Text>
                <TextInput
                  value={draftDurationDays}
                  onChangeText={setDraftDurationDays}
                  placeholder="100"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  style={styles.scheduleInput}
                />
              </View>
              <Text style={styles.scheduleHint}>
                Nếu mốc mới ở tương lai, thử thách sẽ chuyển sang sắp tới. Lịch sử ngoài mốc mới sẽ không được giữ.
              </Text>
            </View>
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={() => setIsScheduleOpen(false)} style={[styles.sheetButton, styles.sheetCancelButton]}>
                <Text style={styles.sheetCancelText}>Huỷ</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={saveSchedule} style={[styles.sheetButton, styles.sheetPrimaryButton]}>
                <Text style={styles.sheetPrimaryText}>Lưu</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isDeleteConfirmOpen} transparent animationType="fade" onRequestClose={() => setIsDeleteConfirmOpen(false)}>
        <View style={styles.actionBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Trash2 size={26} color={colors.forest} strokeWidth={2.4} />
            </View>
            <Text style={styles.confirmTitle}>Xoá thử thách?</Text>
            <Text style={styles.confirmText}>Thao tác này sẽ xoá thử thách và toàn bộ lịch sử của nó.</Text>
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={() => setIsDeleteConfirmOpen(false)} style={[styles.sheetButton, styles.sheetCancelButton]}>
                <Text style={styles.sheetCancelText}>Huỷ</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={deleteChecklist} style={[styles.sheetButton, styles.sheetPrimaryButton]}>
                <Text style={styles.sheetPrimaryText}>Xoá</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 16, paddingBottom: 110 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  headerTitle: { position: 'absolute', left: 58, right: 58, textAlign: 'center', color: colors.ink, fontSize: 16, fontFamily: typography.semiBold },
  heroCard: { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 6 },
  title: { color: colors.ink, fontSize: 24, lineHeight: 30, fontFamily: typography.semiBold },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17, fontFamily: typography.regular },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  editButton: { minHeight: 42, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.forest },
  editText: { color: colors.surface, fontSize: 13, fontFamily: typography.semiBold },
  moreButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface, borderWidth: 1, borderColor: colors.line },
  trackingCard: { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12 },
  trackingTabs: { alignSelf: 'center', minHeight: 42, borderRadius: 999, padding: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.softSurface, borderWidth: 1, borderColor: colors.line },
  trackingTabButton: { minHeight: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  trackingTabButtonActive: { backgroundColor: colors.surface },
  trackingTabText: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: typography.regular },
  trackingTabTextActive: { color: colors.ink, fontFamily: typography.semiBold },
  trackingScroll: { gap: 10, paddingVertical: 2 },
  monthSection: { width: 65, gap: 8 },
  monthGrid: { height: 96, flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignContent: 'flex-start' },
  trackingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.softLine },
  trackingDotOutside: { opacity: 0.35 },
  trackingDotDone: { backgroundColor: colors.forest },
  trackingDotPartial: { backgroundColor: colors.surface, borderWidth: 1.4, borderColor: colors.forest },
  monthLabel: { color: colors.muted, fontSize: 12, lineHeight: 16, fontFamily: typography.regular, textAlign: 'center' },
  section: { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontFamily: typography.semiBold },
  timelineText: { flexShrink: 0, color: colors.muted, fontSize: 12, lineHeight: 17, fontFamily: typography.regular },
  historyMonths: { gap: 16 },
  historyMonth: { gap: 10 },
  historyMonthTitle: { color: colors.muted, fontSize: 15, lineHeight: 20, fontFamily: typography.semiBold },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  daySummaryCard: { position: 'relative', flexBasis: '31.6%', flexGrow: 1, maxWidth: '31.6%', minHeight: 72, borderRadius: 16, padding: 10, justifyContent: 'space-between', backgroundColor: colors.softSurface },
  daySummaryCardComplete: { backgroundColor: colors.softSurface },
  dayTitle: { color: colors.muted, fontSize: 28, lineHeight: 32, fontFamily: typography.medium },
  dayTitleComplete: { color: colors.forest },
  dayMeta: { color: colors.muted, fontSize: 11, lineHeight: 14, fontFamily: typography.medium },
  dayMetaComplete: { color: colors.forest },
  completeMark: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  modalCard: { maxHeight: '82%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, gap: 14 },
  modalHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 999, backgroundColor: colors.line, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalEyebrow: { color: colors.muted, fontSize: 12, lineHeight: 16, fontFamily: typography.medium, textTransform: 'uppercase' },
  modalTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontFamily: typography.semiBold },
  modalClose: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface },
  modalContent: { gap: 12, paddingBottom: 24 },
  modalSummary: { minHeight: 70, borderRadius: 18, backgroundColor: colors.softSurface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  modalSummaryNumber: { color: colors.forest, fontSize: 30, lineHeight: 34, fontFamily: typography.semiBold },
  modalSummaryText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 19, fontFamily: typography.medium },
  taskGroup: { gap: 8 },
  taskGroupHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subTitle: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: typography.semiBold },
  taskCount: { color: colors.muted, fontSize: 12, lineHeight: 16, fontFamily: typography.medium },
  taskRow: { minHeight: 48, borderRadius: 14, backgroundColor: colors.softSurface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  taskRowPressed: { opacity: 0.72 },
  taskRowDisabled: { opacity: 0.62 },
  taskDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  taskDotDone: { borderColor: colors.forest, backgroundColor: colors.forest },
  itemLine: { flex: 1, color: colors.ink, fontSize: 16, lineHeight: 22, fontFamily: typography.medium },
  lockedNotice: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: typography.medium, paddingHorizontal: 4 },
  empty: { borderRadius: 14, backgroundColor: colors.softSurface, color: colors.muted, fontSize: 14, lineHeight: 20, fontFamily: typography.medium, paddingHorizontal: 12, paddingVertical: 14 },
  actionBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  actionSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, padding: 18, gap: 10 },
  actionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  actionTitle: { color: colors.ink, fontSize: 22, lineHeight: 28, fontFamily: typography.semiBold },
  actionClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface },
  actionRow: { minHeight: 74, borderRadius: 18, backgroundColor: colors.softSurface, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  actionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  actionCopy: { flex: 1 },
  actionRowTitle: { color: colors.ink, fontSize: 16, lineHeight: 22, fontFamily: typography.semiBold },
  actionRowText: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: typography.medium, marginTop: 2 },
  scheduleCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, padding: 18, gap: 16 },
  scheduleForm: { gap: 12 },
  scheduleField: { gap: 7 },
  scheduleLabel: { color: colors.ink, fontSize: 13, lineHeight: 18, fontFamily: typography.semiBold },
  scheduleInput: { minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.softSurface, paddingHorizontal: 16, color: colors.ink, fontSize: 16, fontFamily: typography.medium },
  scheduleHint: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: typography.medium },
  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetButton: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sheetCancelButton: { backgroundColor: colors.softSurface },
  sheetPrimaryButton: { backgroundColor: colors.ink },
  sheetCancelText: { color: colors.muted, fontSize: 15, fontFamily: typography.semiBold },
  sheetPrimaryText: { color: colors.surface, fontSize: 15, fontFamily: typography.semiBold },
  confirmCard: { margin: 18, borderRadius: 28, backgroundColor: colors.surface, padding: 24, alignItems: 'center', gap: 10 },
  confirmIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softSurface, borderWidth: 1, borderColor: colors.line },
  confirmTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontFamily: typography.semiBold, textAlign: 'center' },
  confirmText: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: typography.medium, textAlign: 'center', marginBottom: 10 },
});
