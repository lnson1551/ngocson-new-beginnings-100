import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  MomoTrustSans_400Regular,
  MomoTrustSans_500Medium,
  MomoTrustSans_600SemiBold,
  useFonts,
} from '@expo-google-fonts/momo-trust-sans';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BottomTabs } from './src/components/BottomTabs';
import { CreateChecklistScreen } from './src/screens/CreateChecklistScreen';
import { EditChecklistScreen } from './src/screens/EditChecklistScreen';
import { ChecklistDetailScreen } from './src/screens/ChecklistDetailScreen';
import { ChecklistsScreen } from './src/screens/ChecklistsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useAppData } from './src/state/useAppData';
import { colors } from './src/theme/colors';

export default function App() {
  const app = useAppData();
  const [isSettingsAccountPage, setIsSettingsAccountPage] = useState(false);
  const [fontsLoaded] = useFonts({
    MomoTrustSans_400Regular,
    MomoTrustSans_500Medium,
    MomoTrustSans_600SemiBold,
  });
  const changeMainTab = (tab: Parameters<typeof app.setActiveTab>[0]) => {
    app.setSelectedChecklistId(undefined);
    app.setActiveTab(tab);
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.outer}>
        <SafeAreaView style={styles.shell}>
          <StatusBar style="dark" />
          <View style={styles.content}>
            {!app.isReady || !fontsLoaded ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.forest} />
              </View>
            ) : app.activeTab === 'today' ? (
              <HomeScreen {...app} />
            ) : app.activeTab === 'create' ? (
              <CreateChecklistScreen onCreateChecklist={app.createChecklist} onClose={() => app.setActiveTab('today')} />
            ) : app.activeTab === 'edit' && app.selectedChecklist ? (
              <EditChecklistScreen
                checklist={app.selectedChecklist}
                onClose={() => app.setActiveTab('checklists')}
                onSave={app.updateChecklist}
                onDelete={app.deleteChecklist}
              />
            ) : app.activeTab === 'settings' ? (
              <SettingsScreen
                settings={app.settings}
                onUpdateSettings={app.updateSettings}
                authSession={app.authSession}
                isSupabaseConfigured={app.isSupabaseConfigured}
                syncMode={app.syncMode}
                syncStatus={app.syncStatus}
                syncError={app.syncError}
                onSignIn={app.signIn}
                onSignUp={app.signUp}
                onSendPasswordResetOtp={app.sendPasswordResetOtp}
                onVerifyOtp={app.verifyOtp}
                onUpdatePassword={app.updatePassword}
                onSignOut={app.signOut}
                onAccountPageChange={setIsSettingsAccountPage}
              />
            ) : app.selectedChecklist ? (
              <ChecklistDetailScreen
                checklist={app.selectedChecklist}
                history={app.checklistHistory}
                onBack={() => app.setSelectedChecklistId(undefined)}
                onEdit={() => app.setActiveTab('edit')}
                onToggleHistoryItem={app.toggleHistoryItem}
              />
            ) : (
              <ChecklistsScreen
                checklists={app.checklists}
                history={app.history}
                onOpenChecklist={app.openChecklistDetail}
                onCreateChecklist={() => app.setActiveTab('create')}
              />
            )}
          </View>
          {app.activeTab === 'create' || app.activeTab === 'edit' || isSettingsAccountPage ? null : (
            <BottomTabs activeTab={app.activeTab} onChange={changeMainTab} />
          )}
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  outer: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? '#E6F0EE' : colors.canvas,
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : undefined,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
