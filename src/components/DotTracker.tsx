import { StyleSheet, Text, View } from 'react-native';

import { DayRecord } from '../domain/types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getLastDateKeys } from '../utils/date';

type Props = {
  history: DayRecord[];
};

function dotColor(record?: DayRecord) {
  if (!record || record.total === 0) return colors.line;
  const ratio = record.completed / record.total;
  if (ratio >= 1) return colors.forest;
  if (ratio >= 0.5) return colors.gold;
  if (ratio > 0) return colors.coral;
  return colors.line;
}

export function DotTracker({ history }: Props) {
  const dates = getLastDateKeys(30);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Dot tracking</Text>
        <Text style={styles.caption}>30 ngày gần nhất</Text>
      </View>
      <View style={styles.grid}>
        {dates.map((dateKey) => {
          const record = history.find((item) => item.date === dateKey);
          return <View key={dateKey} style={[styles.dot, { backgroundColor: dotColor(record) }]} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.035,
    shadowRadius: 18,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: typography.semiBold,
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: typography.semiBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
