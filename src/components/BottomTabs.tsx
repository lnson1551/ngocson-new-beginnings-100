import { Home, Layers3, Plus, Settings } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTab } from '../domain/types';
import { colors } from '../theme/colors';

type Props = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
};

const navTabs: Array<{ id: AppTab; label: string; Icon: typeof Home }> = [
  { id: 'today', label: 'Hôm nay', Icon: Home },
  { id: 'checklists', label: 'Thử thách', Icon: Layers3 },
  { id: 'settings', label: 'Cài đặt', Icon: Settings },
];

export function BottomTabs({ activeTab, onChange }: Props) {
  return (
    <View style={styles.shell}>
      <View style={styles.pill}>
        {navTabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <Pressable
              key={id}
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange(id)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Icon size={25} color={isActive ? colors.ink : colors.muted} strokeWidth={2.4} />
              <Text style={styles.hiddenLabel}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityLabel="Tạo"
        accessibilityRole="button"
        accessibilityState={{ selected: activeTab === 'create' }}
        onPress={() => onChange('create')}
        style={[styles.createButton, activeTab === 'create' && styles.createButtonActive]}
      >
        <Plus size={31} color={activeTab === 'create' ? colors.surface : colors.ink} strokeWidth={2.6} />
        <Text style={styles.hiddenLabel}>Tạo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: 'rgba(247, 247, 247, 0.92)',
  },
  pill: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  tab: {
    width: 50,
    height: 50,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.softLine,
  },
  createButton: {
    width: 62,
    height: 62,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  createButtonActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  hiddenLabel: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
