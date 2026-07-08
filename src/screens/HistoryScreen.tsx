import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DayRecord } from '../domain/types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatShortDate } from '../utils/date';

type Props = {
  history: DayRecord[];
};

export function HistoryScreen({ history }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Ghi nhận</Text>
        <Text style={styles.title}>Lịch sử thực hiện</Text>
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Chưa có lịch sử</Text>
          <Text style={styles.emptyText}>Đánh dấu việc đầu tiên để bắt đầu ghi nhận.</Text>
        </View>
      ) : (
        history.map((record) => {
          const percentage = record.total === 0 ? 0 : Math.round((record.completed / record.total) * 100);
          return (
            <View key={record.date} style={styles.record}>
              <View style={styles.recordTop}>
                <Text style={styles.date}>{formatShortDate(record.date)}</Text>
                <Text style={styles.percent}>{percentage}%</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percentage}%` }]} />
              </View>
              <Text style={styles.meta}>
                {record.completed}/{record.total} việc trong {record.checklistCount} thử thách
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 16,
  },
  header: {
    gap: 6,
    marginBottom: 4,
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
  empty: {
    minHeight: 160,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: typography.semiBold,
  },
  emptyText: {
    marginTop: 6,
    color: colors.muted,
    textAlign: 'center',
    fontSize: 15,
  },
  record: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.035,
    shadowRadius: 18,
    elevation: 1,
  },
  recordTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: typography.semiBold,
  },
  percent: {
    color: colors.forest,
    fontSize: 17,
    fontFamily: typography.semiBold,
  },
  barTrack: {
    height: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.softLine,
  },
  barFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.forest,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: typography.semiBold,
  },
});
