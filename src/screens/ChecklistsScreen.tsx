import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Checklist, DayRecord } from '../domain/types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { addDays, compareDateKeys, formatShortDate, getLastDateKeys, toDateKey } from '../utils/date';

type Props = {
  checklists: Checklist[];
  history: DayRecord[];
  onOpenChecklist: (checklistId: string) => void;
  onCreateChecklist: () => void;
};

function getCurrentStreak(history: DayRecord[]) {
  let streak = 0;
  let cursor = toDateKey();

  while (true) {
    const record = history.find((item) => item.date === cursor);
    if (!record || record.total === 0 || record.completed < record.total) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function ChecklistsScreen({ checklists, history, onOpenChecklist, onCreateChecklist }: Props) {
  const currentStreak = getCurrentStreak(history);
  const recentDates = getLastDateKeys(14);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Thư viện</Text>
          <Text style={styles.title}>Các thử thách</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" onPress={onCreateChecklist} style={styles.addHeaderButton}>
            <Text style={styles.addHeaderText}>Thêm</Text>
          </Pressable>
        </View>
      </View>

      {checklists.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Chưa có thử thách</Text>
          <Text style={styles.emptyText}>Tạo thử thách đầu tiên để bắt đầu theo dõi thói quen mỗi ngày.</Text>
          <Pressable accessibilityRole="button" onPress={onCreateChecklist} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Thêm</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {checklists.map((checklist) => {
          const completed = checklist.items.filter((item) => item.isDone).length;
          const total = checklist.items.length;
          const todayPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
          const isUpcoming = compareDateKeys(checklist.startDate, toDateKey()) > 0;

          return (
            <Pressable
              key={checklist.id}
              accessibilityRole="button"
              onPress={() => onOpenChecklist(checklist.id)}
              style={styles.card}
            >
              <View style={styles.cardTop}>
                <View style={styles.copy}>
                  <Text style={styles.cardTitle}>{checklist.title}</Text>
                  {isUpcoming ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Sắp bắt đầu {formatShortDate(checklist.startDate)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.dateRange}>
                      {formatShortDate(checklist.startDate)} - {formatShortDate(checklist.endDate)} · {checklist.durationDays} ngày
                    </Text>
                  )}
                </View>
              </View>

              {!isUpcoming ? (
                <>
                  <View style={styles.trackingBlock}>
                    <View style={styles.trackingHeader}>
                      <Text style={styles.trackingLabel}>14 ngày gần đây</Text>
                      {currentStreak >= 3 ? (
                        <Text style={styles.streakHelp}>Chuỗi {currentStreak} ngày</Text>
                      ) : null}
                    </View>
                    <View style={styles.dotRow}>
                      {recentDates.map((dateKey) => {
                        const record = history.find((item) => item.date === dateKey);
                        const isComplete = Boolean(record && record.total > 0 && record.completed >= record.total);
                        const isPartial = Boolean(record && record.completed > 0 && record.completed < record.total);
                        return (
                        <View
                          key={dateKey}
                          style={[
                            styles.dot,
                            isComplete && styles.dotComplete,
                            isPartial && styles.dotPartial,
                          ]}
                        />
                        );
                      })}
                    </View>
                  </View>

                  <Text style={styles.progressLabel}>Hoàn thành hôm nay · {completed}/{total}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${todayPercent}%` }]} />
                  </View>
                </>
              ) : (
                <Text style={styles.upcomingDescription}>
                  Thử thách này sẽ xuất hiện ở Hôm nay khi tới ngày bắt đầu.
                </Text>
              )}
            </Pressable>
          );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  addHeaderButton: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.forest,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  addHeaderText: {
    color: colors.surface,
    fontSize: 13,
    fontFamily: typography.semiBold,
  },
  kicker: {
    color: colors.forest,
    fontSize: 13,
    fontFamily: typography.semiBold,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontFamily: typography.semiBold,
  },
  list: {
    gap: 16,
  },
  emptyState: {
    minHeight: 240,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: typography.semiBold,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.regular,
    textAlign: 'center',
  },
  emptyButton: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.forest,
    marginTop: 4,
  },
  emptyButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontFamily: typography.semiBold,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 22,
    gap: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.055,
    shadowRadius: 30,
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: typography.semiBold,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: typography.regular,
    marginTop: 6,
  },
  dateRange: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: typography.regular,
    marginTop: 2,
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
  },
  tagText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.regular,
  },
  upcomingDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: typography.regular,
  },
  trackingBlock: {
    gap: 8,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  trackingLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.regular,
  },
  streakHelp: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.regular,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.softLine,
  },
  dotComplete: {
    backgroundColor: colors.ink,
  },
  dotPartial: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.forest,
  },
  barTrack: {
    height: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.softLine,
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.regular,
    marginBottom: -8,
  },
  barFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.forest,
  },
});
