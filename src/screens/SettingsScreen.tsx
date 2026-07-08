import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Cloud,
  KeyRound,
  LogOut,
  Mail,
  Share2,
  ShieldCheck,
  Smartphone,
  Star,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppSettings } from '../domain/types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type AccountPage = 'settings' | 'account' | 'signIn' | 'signUp' | 'forgotPassword' | 'otp' | 'resetPassword';
type OtpType = 'email' | 'signup' | 'recovery';

type Props = {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  authSession: { user: { email?: string } } | null;
  isSupabaseConfigured: boolean;
  syncMode: 'local' | 'cloud';
  syncStatus: 'local' | 'signed_out' | 'syncing' | 'synced' | 'error';
  syncError?: string;
  onSignIn: (email: string, password: string) => Promise<{ error?: string; message?: string }>;
  onSignUp: (email: string, password: string) => Promise<{ error?: string; message?: string }>;
  onSendPasswordResetOtp: (email: string) => Promise<{ error?: string; message?: string }>;
  onVerifyOtp: (email: string, token: string, type: OtpType) => Promise<{ error?: string }>;
  onUpdatePassword: (password: string) => Promise<{ error?: string }>;
  onSignOut: () => Promise<void>;
  onUseLocalOnly: () => void;
  onEnableCloudSync: () => Promise<{ error?: string }>;
  onAccountPageChange?: (isAccountPage: boolean) => void;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_STORE_URL = 'https://apps.apple.com/us/search?term=100%20Kh%E1%BB%9Fi%20%C4%91%E1%BA%A7u%20m%E1%BB%9Bi';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/search?q=100%20Kh%E1%BB%9Fi%20%C4%91%E1%BA%A7u%20m%E1%BB%9Bi&c=apps';

function getFriendlyAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Email hoặc mật khẩu chưa đúng.';
  if (lower.includes('email not confirmed')) return 'Email chưa được xác nhận. Mở trang OTP để xác nhận trước.';
  if (lower.includes('token') || lower.includes('otp')) return 'Mã OTP không đúng hoặc đã hết hạn.';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Bạn thao tác quá nhanh. Chờ một lát rồi thử lại.';
  if (lower.includes('already registered') || lower.includes('already exists')) return 'Email này đã có tài khoản.';
  if (lower.includes('password')) return 'Mật khẩu chưa hợp lệ. Hãy dùng ít nhất 8 ký tự.';
  return message;
}

function validateEmail(email: string) {
  if (!email.trim()) return 'Nhập email để tiếp tục.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Email chưa đúng định dạng.';
  return undefined;
}

function validatePassword(password: string) {
  if (!password) return 'Nhập mật khẩu để tiếp tục.';
  if (password.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  return undefined;
}

function SettingToggle({ value, onValueChange }: { value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={[styles.toggleTrack, value && styles.toggleTrackActive]}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
    </Pressable>
  );
}

export function SettingsScreen({
  settings,
  onUpdateSettings,
  authSession,
  isSupabaseConfigured,
  syncMode,
  syncStatus,
  syncError,
  onSignIn,
  onSignUp,
  onSendPasswordResetOtp,
  onVerifyOtp,
  onUpdatePassword,
  onSignOut,
  onUseLocalOnly,
  onEnableCloudSync,
  onAccountPageChange,
}: Props) {
  const [isWidgetGuideOpen, setIsWidgetGuideOpen] = useState(false);
  const [isWidgetDownloadOpen, setIsWidgetDownloadOpen] = useState(false);
  const [accountPage, setAccountPage] = useState<AccountPage>('settings');
  const [email, setEmail] = useState(authSession?.user.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpType, setOtpType] = useState<OtpType>('email');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    onAccountPageChange?.(accountPage !== 'settings');
    return () => onAccountPageChange?.(false);
  }, [accountPage, onAccountPageChange]);

  const accountDescription = useMemo(() => {
    if (syncMode === 'cloud' && authSession) {
      return `Đã đăng nhập - ${authSession.user.email ?? 'tài khoản của bạn'}`;
    }
    return 'Đăng nhập để sao lưu và đồng bộ dữ liệu của bạn.';
  }, [authSession, syncMode]);

  const resetAuthFeedback = () => {
    setAuthError('');
    setAuthNotice('');
  };

  const openAccount = () => {
    resetAuthFeedback();
    setEmail(authSession?.user.email ?? email);
    setAccountPage(authSession ? 'account' : 'signIn');
  };

  const openWidgetSetup = () => {
    if (Platform.OS === 'web') {
      setIsWidgetDownloadOpen(true);
      return;
    }
    setIsWidgetGuideOpen(true);
  };

  const openStoreLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Chưa mở được liên kết', 'Bạn thử lại sau hoặc tìm “100 Khởi đầu mới” trên cửa hàng ứng dụng.');
    });
  };

  const goToAuthPage = (page: AccountPage, nextOtpType?: OtpType) => {
    resetAuthFeedback();
    if (nextOtpType) setOtpType(nextOtpType);
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setAccountPage(page);
  };

  const validateEmailPassword = () => {
    return validateEmail(email) ?? validatePassword(password);
  };

  const submitSignIn = async () => {
    const validationError = validateEmailPassword();
    if (validationError) {
      setAuthError(validationError);
      return;
    }
    setIsAuthLoading(true);
    resetAuthFeedback();
    const result = await onSignIn(email.trim(), password);
    setIsAuthLoading(false);
    if (result.error) {
      setAuthError(getFriendlyAuthError(result.error));
      return;
    }
    setPassword('');
    setAccountPage('account');
  };

  const submitSignUp = async () => {
    const validationError = validateEmailPassword();
    if (validationError) {
      setAuthError(validationError);
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    setIsAuthLoading(true);
    resetAuthFeedback();
    const result = await onSignUp(email.trim(), password);
    setIsAuthLoading(false);
    if (result.error) {
      setAuthError(getFriendlyAuthError(result.error));
      return;
    }
    setPassword('');
    setConfirmPassword('');
    if (result.message) {
      setOtpType('signup');
      setAuthNotice(result.message);
      setAccountPage('otp');
      return;
    }
    setAccountPage('account');
  };

  const submitForgotPassword = async () => {
    const validationError = validateEmail(email);
    if (validationError) {
      setAuthError(validationError);
      return;
    }
    setIsAuthLoading(true);
    resetAuthFeedback();
    const result = await onSendPasswordResetOtp(email.trim());
    setIsAuthLoading(false);
    if (result.error) {
      setAuthError(getFriendlyAuthError(result.error));
      return;
    }
    setOtpType('recovery');
    setAuthNotice(result.message ?? 'Kiểm tra email để lấy mã OTP khôi phục.');
    setAccountPage('otp');
  };

  const submitOtp = async () => {
    const validationError = validateEmail(email);
    if (validationError) {
      setAuthError(validationError);
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setAuthError('OTP gồm 6 chữ số.');
      return;
    }
    setIsAuthLoading(true);
    resetAuthFeedback();
    const verifyResult = await onVerifyOtp(email.trim(), otp.trim(), otpType);
    if (verifyResult.error) {
      setIsAuthLoading(false);
      setAuthError(getFriendlyAuthError(verifyResult.error));
      return;
    }
    if (otpType === 'recovery') {
      setIsAuthLoading(false);
      setOtp('');
      setAccountPage('resetPassword');
      return;
    }

    setIsAuthLoading(false);
    setOtp('');
    setAuthNotice('');
    setAccountPage('account');
  };

  const submitResetPassword = async () => {
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setAuthError(passwordError);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAuthError('Mật khẩu nhập lại chưa khớp.');
      return;
    }

    setIsAuthLoading(true);
    resetAuthFeedback();
    const updateResult = await onUpdatePassword(newPassword);
    setIsAuthLoading(false);
    if (updateResult.error) {
      setAuthError(getFriendlyAuthError(updateResult.error));
      return;
    }
    setNewPassword('');
    setConfirmNewPassword('');
    setAccountPage('account');
  };

  const enableCloud = async () => {
    const result = await onEnableCloudSync();
    if (result.error) Alert.alert('Chưa bật được đồng bộ', result.error);
  };

  const submitSignOut = async () => {
    await onSignOut();
    setPassword('');
    setAccountPage('signIn');
  };

  if (accountPage !== 'settings') {
    return (
      <>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.subHeader}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAccountPage('settings')}
              style={styles.backButton}
            >
              <ArrowLeft size={22} color={colors.ink} strokeWidth={2.4} />
            </Pressable>
            <View style={styles.subHeaderCopy}>
              <Text style={styles.kicker}>Tài khoản</Text>
              <Text style={styles.title}>
                {accountPage === 'account'
                  ? 'Tài khoản & đồng bộ'
                  : accountPage === 'signUp'
                    ? 'Tạo tài khoản'
                    : accountPage === 'forgotPassword'
                      ? 'Quên mật khẩu'
                      : accountPage === 'otp'
                        ? 'Xác nhận OTP'
                        : accountPage === 'resetPassword'
                          ? 'Mật khẩu mới'
                        : 'Đăng nhập'}
              </Text>
            </View>
          </View>

          {accountPage === 'account' ? (
            <View style={styles.authCard}>
              <View style={styles.accountHero}>
                <View style={styles.authIconWrap}>
                  <Cloud size={24} color={colors.ink} strokeWidth={2.4} />
                </View>
                <Text style={styles.authTitle}>{authSession ? authSession.user.email : 'Chưa đăng nhập'}</Text>
                <Text style={styles.authDescription}>
                  Dữ liệu luôn có thể dùng trên thiết bị này. Khi bật đồng bộ, tiến độ và cài đặt sẽ được sao lưu vào tài khoản của bạn.
                </Text>
              </View>

              <View style={styles.syncChoiceRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onUseLocalOnly}
                  style={[styles.syncChoice, syncMode === 'local' && styles.syncChoiceActive]}
                >
                  <Text style={[styles.syncChoiceTitle, syncMode === 'local' && styles.syncChoiceTitleActive]}>
                    Local
                  </Text>
                  <Text style={styles.syncChoiceText}>Chỉ trên máy này</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={enableCloud}
                  style={[styles.syncChoice, syncMode === 'cloud' && styles.syncChoiceActive]}
                >
                  <Text style={[styles.syncChoiceTitle, syncMode === 'cloud' && styles.syncChoiceTitleActive]}>
                    Tài khoản
                  </Text>
                  <Text style={styles.syncChoiceText}>Sao lưu & đồng bộ</Text>
                </Pressable>
              </View>

              <View style={styles.statusPill}>
                <Text style={styles.statusText}>
                  {syncStatus === 'syncing'
                    ? 'Đang đồng bộ...'
                    : syncStatus === 'synced'
                      ? 'Đã đồng bộ'
                      : syncStatus === 'error'
                        ? syncError ?? 'Lỗi đồng bộ'
                        : authSession
                          ? 'Đang lưu trên thiết bị'
                          : 'Chưa đăng nhập'}
                </Text>
              </View>

              {authSession ? (
                <Pressable accessibilityRole="button" onPress={submitSignOut} style={styles.secondaryButton}>
                  <LogOut size={17} color={colors.ink} strokeWidth={2.3} />
                  <Text style={styles.secondaryButtonText}>Đăng xuất</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => goToAuthPage('signIn')}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Đăng nhập</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.authCard}>
              <View style={styles.accountHero}>
                <View style={styles.authIconWrap}>
                  {accountPage === 'forgotPassword' ? (
                    <KeyRound size={24} color={colors.ink} strokeWidth={2.4} />
                  ) : accountPage === 'otp' || accountPage === 'resetPassword' ? (
                    <ShieldCheck size={24} color={colors.ink} strokeWidth={2.4} />
                  ) : (
                    <Mail size={24} color={colors.ink} strokeWidth={2.4} />
                  )}
                </View>
                <Text style={styles.authTitle}>
                  {accountPage === 'signUp'
                    ? 'Lưu tiến độ không mất'
                    : accountPage === 'forgotPassword'
                      ? 'Nhận mã khôi phục'
                      : accountPage === 'otp'
                        ? otpType === 'recovery'
                          ? 'Nhập OTP khôi phục'
                          : otpType === 'signup'
                            ? 'Nhập OTP đăng ký'
                            : 'Nhập OTP đăng nhập'
                        : accountPage === 'resetPassword'
                          ? 'Đặt mật khẩu mới'
                        : 'Đăng nhập để đồng bộ'}
                </Text>
                <Text style={styles.authDescription}>
                  {accountPage === 'signUp'
                    ? 'Nếu máy đang có tiến độ, app sẽ giữ lại và sao lưu vào tài khoản mới sau khi xác nhận.'
                    : accountPage === 'forgotPassword'
                      ? 'Nhập email tài khoản, sau đó dùng OTP trong email để đặt mật khẩu mới.'
                      : accountPage === 'otp'
                        ? `Mã OTP đã được gửi đến ${email.trim() || 'email của bạn'}.`
                        : accountPage === 'resetPassword'
                          ? 'OTP đã được xác nhận. Bây giờ bạn có thể tạo mật khẩu mới cho tài khoản.'
                        : 'Đăng nhập để sao lưu tiến độ và mở lại ở thiết bị khác vẫn còn dữ liệu.'}
                </Text>
              </View>

              {!isSupabaseConfigured ? (
                <Text style={styles.errorText}>
                  Đăng nhập hiện chưa sẵn sàng. Vui lòng thử lại sau.
                </Text>
              ) : null}

              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
              {authNotice ? <Text style={styles.noticeText}>{authNotice}</Text> : null}

              {accountPage !== 'otp' && accountPage !== 'resetPassword' ? (
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isAuthLoading}
                  keyboardType="email-address"
                  placeholder="email@example.com"
                  placeholderTextColor={colors.muted}
                  style={styles.authInput}
                />
              ) : null}

              {accountPage === 'signIn' || accountPage === 'signUp' ? (
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  editable={!isAuthLoading}
                  secureTextEntry
                  placeholder="Mật khẩu"
                  placeholderTextColor={colors.muted}
                  style={styles.authInput}
                />
              ) : null}

              {accountPage === 'signUp' ? (
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                  editable={!isAuthLoading}
                  secureTextEntry
                  placeholder="Nhập lại mật khẩu"
                  placeholderTextColor={colors.muted}
                  style={styles.authInput}
                />
              ) : null}

              {accountPage === 'otp' ? (
                <>
                  <TextInput
                    value={otp}
                    onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                    editable={!isAuthLoading}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="Mã OTP 6 số"
                    placeholderTextColor={colors.muted}
                    style={styles.authInput}
                  />
                </>
              ) : null}

              {accountPage === 'resetPassword' ? (
                <>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                    editable={!isAuthLoading}
                    secureTextEntry
                    placeholder="Mật khẩu mới"
                    placeholderTextColor={colors.muted}
                    style={styles.authInput}
                  />
                  <TextInput
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    autoCapitalize="none"
                    editable={!isAuthLoading}
                    secureTextEntry
                    placeholder="Nhập lại mật khẩu mới"
                    placeholderTextColor={colors.muted}
                    style={styles.authInput}
                  />
                </>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={isAuthLoading || !isSupabaseConfigured}
                onPress={
                  accountPage === 'signUp'
                    ? submitSignUp
                    : accountPage === 'forgotPassword'
                      ? submitForgotPassword
                      : accountPage === 'otp'
                        ? submitOtp
                        : accountPage === 'resetPassword'
                          ? submitResetPassword
                        : submitSignIn
                }
                style={[styles.primaryButton, (isAuthLoading || !isSupabaseConfigured) && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {isAuthLoading
                    ? 'Đang xử lý...'
                    : accountPage === 'signUp'
                      ? 'Tạo tài khoản'
                      : accountPage === 'forgotPassword'
                        ? 'Gửi mã khôi phục'
                        : accountPage === 'otp'
                          ? 'Xác nhận'
                          : accountPage === 'resetPassword'
                            ? 'Lưu mật khẩu mới'
                          : 'Đăng nhập'}
                </Text>
              </Pressable>

              <View style={styles.linkStack}>
                {accountPage === 'signIn' ? (
                  <>
                    <Pressable accessibilityRole="button" onPress={() => goToAuthPage('forgotPassword', 'recovery')}>
                      <Text style={styles.linkText}>Quên mật khẩu?</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => goToAuthPage('signUp')}>
                      <Text style={styles.linkText}>Chưa có tài khoản? Đăng ký</Text>
                    </Pressable>
                  </>
                ) : null}

                {accountPage === 'signUp' ? (
                  <Pressable accessibilityRole="button" onPress={() => goToAuthPage('signIn')}>
                    <Text style={styles.linkText}>Đã có tài khoản? Đăng nhập</Text>
                  </Pressable>
                ) : null}

                {accountPage === 'forgotPassword' ? (
                  <>
                    <Pressable accessibilityRole="button" onPress={() => goToAuthPage('signIn')}>
                      <Text style={styles.linkText}>Nhớ mật khẩu? Đăng nhập</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => goToAuthPage('otp', 'recovery')}>
                      <Text style={styles.linkText}>Tôi đã có mã khôi phục</Text>
                    </Pressable>
                  </>
                ) : null}

                {accountPage === 'otp' ? (
                  <Pressable accessibilityRole="button" onPress={() => goToAuthPage('signIn')}>
                    <Text style={styles.linkText}>Quay lại đăng nhập</Text>
                  </Pressable>
                ) : null}

                {accountPage === 'resetPassword' ? (
                  <Pressable accessibilityRole="button" onPress={() => goToAuthPage('forgotPassword', 'recovery')}>
                    <Text style={styles.linkText}>Gửi lại mã khôi phục</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        </ScrollView>
      </>
    );
  }

  const rows = [
    {
      title: 'Tài khoản & đồng bộ',
      description: accountDescription,
      Icon: Cloud,
      onPress: openAccount,
    },
    {
      title: 'Tiện ích màn hình',
      description: 'Hiển thị tiến độ thử thách ngoài màn hình chính.',
      Icon: Smartphone,
      onPress: openWidgetSetup,
    },
    {
      title: 'Thông báo',
      description: 'Nhắc giờ sinh hoạt, thử thách buổi sáng và buổi tối.',
      Icon: Bell,
      control: (
        <SettingToggle
          value={settings.notificationEnabled}
          onValueChange={(value) => onUpdateSettings({ ...settings, notificationEnabled: value })}
        />
      ),
    },
    {
      title: 'Đánh giá',
      description: 'Đánh giá ứng dụng để giúp 100 Khởi đầu mới tốt hơn.',
      Icon: Star,
      onPress: () => Alert.alert('Đánh giá', 'Tính năng đánh giá sẽ được nối khi có liên kết cửa hàng.'),
    },
    {
      title: 'Chia sẻ với bạn bè',
      description: 'Chia sẻ ứng dụng cho bạn bè cùng xây nhịp sống đều hơn.',
      Icon: Share2,
      onPress: () =>
        Share.share({
          message: 'Cùng mình thử 100 Khởi đầu mới để xây nhịp sinh hoạt đều hơn nhé.',
        }).catch(() => undefined),
    },
  ];

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Cài đặt</Text>
          <Text style={styles.title}>Thiết lập ứng dụng</Text>
        </View>

        <View style={styles.list}>
          {rows.map(({ title, description, Icon, control, onPress }) => (
            <Pressable key={title} accessibilityRole="button" onPress={onPress} style={styles.card}>
              <View style={styles.iconWrap}>
                <Icon size={23} color={colors.ink} strokeWidth={2.3} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
              </View>
              {control || <ChevronRight size={20} color={colors.muted} strokeWidth={2.4} />}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={isWidgetGuideOpen} transparent animationType="slide" onRequestClose={() => setIsWidgetGuideOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Smartphone size={22} color={colors.ink} strokeWidth={2.4} />
              </View>
              <Pressable accessibilityRole="button" onPress={() => setIsWidgetGuideOpen(false)} style={styles.closeButton}>
                <X size={20} color={colors.muted} strokeWidth={2.4} />
              </Pressable>
            </View>
            <Text style={styles.modalTitle}>Thêm widget ra màn hình chính</Text>
            <Text style={styles.modalText}>
              Widget hiển thị tiến độ hôm nay trên iOS và Android. Trên iOS, nút đánh dấu có thể xử lý trực tiếp qua widget interaction.
            </Text>

            <View style={styles.guideBlock}>
              <Text style={styles.guideTitle}>iPhone</Text>
              <Text style={styles.guideText}>1. Nhấn giữ màn hình chính.</Text>
              <Text style={styles.guideText}>2. Chọn dấu +, tìm “100 Khởi đầu mới”.</Text>
              <Text style={styles.guideText}>3. Chọn “Tiến độ hôm nay”, rồi bấm Thêm widget.</Text>
            </View>

            <View style={styles.guideBlock}>
              <Text style={styles.guideTitle}>Android</Text>
              <Text style={styles.guideText}>1. Nhấn giữ màn hình chính.</Text>
              <Text style={styles.guideText}>2. Chọn Widgets, tìm “100 Khởi đầu mới”.</Text>
              <Text style={styles.guideText}>3. Kéo widget ra vị trí bạn muốn.</Text>
            </View>

            <Text style={styles.noteText}>
              Cần development/production build để kiểm thử widget thật. Android SDK 57 hiện tạo widget receiver bằng Glance; phần đánh dấu trực tiếp trên Android cần native widget implementation sau prebuild.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setIsWidgetGuideOpen(false)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Đã hiểu</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isWidgetDownloadOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsWidgetDownloadOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Smartphone size={22} color={colors.ink} strokeWidth={2.4} />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsWidgetDownloadOpen(false)}
                style={styles.closeButton}
              >
                <X size={20} color={colors.muted} strokeWidth={2.4} />
              </Pressable>
            </View>
            <Text style={styles.modalTitle}>Tải app để dùng widget</Text>
            <Text style={styles.modalText}>
              Widget màn hình chính chỉ hoạt động trên app iOS hoặc Android. Tải app rồi vào Cài đặt để xem hướng dẫn thêm widget.
            </Text>

            <View style={styles.storeButtonRow}>
              <Pressable accessibilityRole="link" onPress={() => openStoreLink(APP_STORE_URL)} style={styles.storeButton}>
                <Text style={styles.storeButtonKicker}>Tải trên</Text>
                <Text style={styles.storeButtonTitle}>App Store</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => openStoreLink(GOOGLE_PLAY_URL)} style={styles.storeButton}>
                <Text style={styles.storeButtonKicker}>Tải trên</Text>
                <Text style={styles.storeButtonTitle}>Google Play</Text>
              </Pressable>
            </View>
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
  header: {
    gap: 6,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
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
    gap: 12,
  },
  card: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 15,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  copy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: typography.semiBold,
  },
  description: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.regular,
    marginTop: 4,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  toggleTrackActive: {
    alignItems: 'flex-end',
    backgroundColor: colors.forest,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleThumbActive: {
    backgroundColor: colors.surface,
  },
  authCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 2,
  },
  accountHero: {
    alignItems: 'center',
    gap: 10,
  },
  authIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  authTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: typography.semiBold,
    textAlign: 'center',
  },
  authDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.medium,
    textAlign: 'center',
  },
  authInput: {
    minHeight: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.softSurface,
    paddingHorizontal: 16,
    color: colors.ink,
    fontSize: 15,
    fontFamily: typography.medium,
  },
  errorText: {
    color: colors.forest,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: typography.medium,
    textAlign: 'center',
  },
  noticeText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: typography.medium,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontFamily: typography.semiBold,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.softSurface,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: typography.semiBold,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  linkStack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 2,
  },
  linkText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 22,
    fontFamily: typography.semiBold,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  syncChoiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  syncChoice: {
    flex: 1,
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: colors.softSurface,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  syncChoiceActive: {
    backgroundColor: colors.ink,
  },
  syncChoiceTitle: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: typography.semiBold,
  },
  syncChoiceTitleActive: {
    color: colors.surface,
  },
  syncChoiceText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: typography.medium,
  },
  statusPill: {
    minHeight: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
    paddingHorizontal: 12,
  },
  statusText: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: typography.medium,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 14,
  },
  modalHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softSurface,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: typography.semiBold,
  },
  modalText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.medium,
  },
  guideBlock: {
    borderRadius: 18,
    backgroundColor: colors.softSurface,
    padding: 14,
    gap: 6,
  },
  guideTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: typography.semiBold,
  },
  guideText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.medium,
  },
  noteText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: typography.regular,
  },
  storeButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  storeButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: 20,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  storeButtonKicker: {
    color: colors.surface,
    opacity: 0.7,
    fontSize: 12,
    fontFamily: typography.medium,
  },
  storeButtonTitle: {
    color: colors.surface,
    fontSize: 16,
    fontFamily: typography.semiBold,
    marginTop: 2,
  },
});
