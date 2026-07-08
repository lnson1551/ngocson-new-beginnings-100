import { Check, Circle, RotateCcw } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Checklist } from '../domain/types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  checklist: Checklist;
  onToggleItem: (checklistId: string, itemId: string) => void;
  onResetChecklist?: (checklistId: string) => void;
  showHeader?: boolean;
  showSummary?: boolean;
};

export function ChecklistCard({
  checklist,
  onToggleItem,
  onResetChecklist,
  showHeader = true,
  showSummary = false,
}: Props) {
  const doneCount = checklist.items.filter((item) => item.isDone).length;

  return (
    <View style={styles.card}>
      {showHeader ? (
        <View style={styles.header}>
          <Text style={styles.title}>{checklist.title}</Text>
          <Text style={styles.count}>
            {doneCount}/{checklist.items.length}
          </Text>
        </View>
      ) : null}
      {showSummary ? (
        <View style={styles.summaryRow}>
          <Text style={styles.summary}>
            {doneCount}/{checklist.items.length} việc hoàn thành
          </Text>
          {onResetChecklist ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onResetChecklist(checklist.id)}
              style={styles.resetButton}
            >
              <RotateCcw size={14} color={colors.ink} strokeWidth={2.3} />
              <Text style={styles.resetText}>Làm lại</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.items}>
        {checklist.items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.isDone }}
            onPress={() => onToggleItem(checklist.id, item.id)}
            style={styles.item}
          >
            <View style={styles.itemCopy}>
              <Text style={[styles.itemText, item.isDone && styles.itemTextDone]}>{item.title}</Text>
              {item.description ? (
                <Text style={[styles.itemDescription, item.isDone && styles.itemTextDone]}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <View style={styles.checkIcon}>
              {item.isDone ? (
                <Check size={24} color={colors.forest} strokeWidth={2.8} />
              ) : (
                <Circle size={24} color={colors.muted} strokeWidth={1.9} />
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.045,
    shadowRadius: 22,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: 18,
    fontFamily: typography.semiBold,
  },
  count: {
    color: colors.forest,
    fontSize: 14,
    fontFamily: typography.semiBold,
  },
  summary: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: typography.regular,
  },
  summaryRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  resetButton: {
    minHeight: 30,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.softSurface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  resetText: {
    color: colors.ink,
    fontSize: 12,
    fontFamily: typography.regular,
  },
  items: {
    gap: 6,
  },
  item: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.softLine,
  },
  checkIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: typography.semiBold,
  },
  itemCopy: {
    flex: 1,
    paddingVertical: 10,
  },
  itemDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.regular,
    marginTop: 3,
  },
  itemTextDone: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
});
