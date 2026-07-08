import { useAudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ChecklistCard } from '../components/ChecklistCard';
import { Checklist, DayRecord } from '../domain/types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { compareDateKeys, formatShortDate, toDateKey } from '../utils/date';

const successSound = require('../../assets/success.wav');
const confettiColors = [colors.forest, '#222222', '#FFB199', '#F1F1F1', '#717171'];
const webMobileWidth = 430;

type Props = {
  checklists: Checklist[];
  history: DayRecord[];
  progress: { completed: number; total: number; percentage: number };
  toggleItem: (checklistId: string, itemId: string) => void;
  resetChecklist: (checklistId: string) => void;
};

export function HomeScreen({ checklists, history, progress, toggleItem, resetChecklist }: Props) {
  const viewportWidth = Platform.OS === 'web' ? Math.min(Dimensions.get('window').width, webMobileWidth) : Dimensions.get('window').width;
  const cardWidth = Math.min(viewportWidth - 36, 520);
  const screenWidth = viewportWidth;
  const successPlayer = useAudioPlayer(successSound);
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [celebrationTitle, setCelebrationTitle] = useState('');
  const activeChecklists = checklists.filter((checklist) => compareDateKeys(checklist.startDate, toDateKey()) <= 0);
  const [activeChecklistIndex, setActiveChecklistIndex] = useState(0);
  const activeChecklist = activeChecklists[activeChecklistIndex] ?? activeChecklists[0];
  const pageCount = Math.min(activeChecklists.length, 5);
  const goToChecklist = (index: number) => {
    setActiveChecklistIndex(Math.max(0, Math.min(index, activeChecklists.length - 1)));
  };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -48) goToChecklist(activeChecklistIndex + 1);
          if (gesture.dx > 48) goToChecklist(activeChecklistIndex - 1);
        },
      }),
    [activeChecklistIndex, activeChecklists.length],
  );
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => ({
        id: index,
        left: 18 + ((index * 37) % Math.max(220, screenWidth - 36)),
        delay: (index % 7) * 0.04,
        drift: ((index % 5) - 2) * 18,
        rotate: index % 2 === 0 ? '220deg' : '-220deg',
        color: confettiColors[index % confettiColors.length],
        size: 7 + (index % 3) * 3,
      })),
    [screenWidth],
  );

  useEffect(() => {
    if (!isCelebrating) return;
    confettiProgress.setValue(0);
    Animated.timing(confettiProgress, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [confettiProgress, isCelebrating]);

  const showCelebration = (checklistTitle: string) => {
    setCelebrationTitle(checklistTitle);
    setIsCelebrating(true);
    successPlayer.seekTo(0);
    successPlayer.play();
  };

  const handleToggleItem = (checklistId: string, itemId: string) => {
    const checklist = checklists.find((item) => item.id === checklistId);
    if (!checklist) {
      toggleItem(checklistId, itemId);
      return;
    }

    const wasComplete = checklist.items.length > 0 && checklist.items.every((item) => item.isDone);
    const nextItems = checklist.items.map((item) =>
      item.id === itemId ? { ...item, isDone: !item.isDone } : item,
    );
    const willComplete = nextItems.length > 0 && nextItems.every((item) => item.isDone);

    toggleItem(checklistId, itemId);
    if (!wasComplete && willComplete) showCelebration(checklist.title);
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeChecklist ? (
          <View style={styles.carouselHeader}>
            <View style={styles.carouselCopy}>
              <Text style={styles.checklistTitle}>{activeChecklist.title}</Text>
              <Text style={styles.checklistDates}>
                {formatShortDate(activeChecklist.startDate)} - {formatShortDate(activeChecklist.endDate)}
              </Text>
            </View>
            {pageCount > 1 ? (
              <View style={styles.pagination}>
                {Array.from({ length: pageCount }, (_, index) => {
                  const normalizedIndex =
                    activeChecklists.length <= 5
                      ? activeChecklistIndex
                      : Math.min(4, Math.floor((activeChecklistIndex / (activeChecklists.length - 1)) * 5));
                  const isActive = index === normalizedIndex;
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      onPress={() => goToChecklist(index)}
                      style={[styles.pageDot, isActive && styles.pageDotActive]}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {activeChecklist ? (
          <View {...panResponder.panHandlers} style={{ width: cardWidth }}>
            <ChecklistCard
              checklist={activeChecklist}
              onToggleItem={handleToggleItem}
              onResetChecklist={resetChecklist}
              showHeader={false}
              showSummary
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Chưa có thử thách bắt đầu</Text>
            <Text style={styles.emptyText}>Các thử thách sắp bắt đầu sẽ xuất hiện ở đây đúng ngày.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={isCelebrating} transparent animationType="fade" onRequestClose={() => setIsCelebrating(false)}>
        <View style={styles.celebrationBackdrop}>
          <View style={styles.confettiLayer}>
            {confettiPieces.map((piece) => {
              const fall = confettiProgress.interpolate({
                inputRange: [0, piece.delay, 1],
                outputRange: [-40, -40, 520],
              });
              const fade = confettiProgress.interpolate({
                inputRange: [0, 0.82, 1],
                outputRange: [1, 1, 0],
              });
              const rotate = confettiProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', piece.rotate],
              });

              return (
                <Animated.View
                  key={piece.id}
                  style={[
                    styles.confettiPiece,
                    {
                      left: piece.left,
                      width: piece.size,
                      height: piece.size * 1.7,
                      backgroundColor: piece.color,
                      opacity: fade,
                      transform: [{ translateY: fall }, { translateX: piece.drift }, { rotate }],
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.celebrationCard}>
            <View style={styles.celebrationBadge}>
              <Text style={styles.celebrationBadgeText}>100%</Text>
            </View>
            <Text style={styles.celebrationTitle}>Hoàn thành rồi!</Text>
            <Text style={styles.celebrationText}>
              Bạn đã xong toàn bộ việc của {celebrationTitle || 'thử thách hôm nay'}.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setIsCelebrating(false)} style={styles.celebrationButton}>
              <Text style={styles.celebrationButtonText}>Tuyệt</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 18,
  },
  carouselHeader: {
    minHeight: 104,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 16,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  carouselCopy: {
    alignItems: 'center',
    width: '100%',
  },
  checklistTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: typography.semiBold,
    textAlign: 'center',
  },
  checklistDates: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: typography.regular,
    marginTop: 2,
    textAlign: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
  pageDotActive: {
    width: 18,
    backgroundColor: colors.forest,
  },
  emptyState: {
    minHeight: 180,
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
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.regular,
    textAlign: 'center',
    marginTop: 6,
  },
  celebrationBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  confettiLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    borderRadius: 3,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    padding: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
    elevation: 8,
  },
  celebrationBadge: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest,
    marginBottom: 16,
  },
  celebrationBadgeText: {
    color: colors.surface,
    fontSize: 21,
    lineHeight: 26,
    fontFamily: typography.semiBold,
  },
  celebrationTitle: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: typography.semiBold,
    textAlign: 'center',
  },
  celebrationText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: typography.medium,
    textAlign: 'center',
    marginTop: 8,
  },
  celebrationButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    paddingHorizontal: 28,
    marginTop: 20,
  },
  celebrationButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontFamily: typography.semiBold,
  },
});
