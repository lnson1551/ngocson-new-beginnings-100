# 100 Khoi dau moi

Mobile app thay doi loi sinh hoat bang checklist, dot tracking va lich su theo ngay.

## Tinh nang hien co

- Xem checklist hom nay va tick tung viec.
- Dot tracking 30 ngay gan nhat.
- Tao checklist moi voi nhieu item.
- Lich su record theo ngay: so viec hoan thanh, tong so viec, phan tram.
- Widget bridge: app ghi summary rieng de native widget iOS/Android doc sau khi prebuild.

## Chay app

```bash
npm install
npm run ios
npm run android
```

Co the dung `npm run start` neu muon mo Expo Dev Tools va quet QR.

## Dang nhap va dong bo

App doc cau hinh tu `.env`:

```text
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Sau khi them URL/key, vao Supabase Dashboard > SQL Editor va chay toan bo file:

```text
supabase/schema.sql
```

File nay tao bang `public.app_data`, bat RLS, them policy cho moi user chi doc/ghi data cua minh, va bat realtime cho bang dong bo. Neu REST bao `Could not find the table 'public.app_data'`, nghia la SQL nay chua duoc chay tren project.

## Cau truc code

```text
src/
  components/   UI dung lai duoc
  domain/       Kieu du lieu cot loi
  screens/      Cac man hinh chinh
  state/        App state va actions
  storage/      Luu tru local
  theme/        Mau sac/thiet ke
  utils/        Date helpers
  widget/       Du lieu chia se cho widget
```

## Huong phat trien giai doan dau

1. Tach checklist thanh "routine templates" va "daily records" de moi ngay co ban ghi rieng.
2. Them edit/delete checklist, archive checklist, va sap xep item.
3. Them reminder bang Expo Notifications.
4. Chuyen tu AsyncStorage sang SQLite khi can truy van history manh hon.
5. Chay `npx expo prebuild` khi bat dau lam native widget.
6. Dung EAS Build de tao file App Store / Google Play.

## Widget setup

File `src/widget/widgetBridge.ts` dang ghi summary vao key:

```text
@new-beginnings-100/widget-summary
```

Summary gom: ngay, so viec da xong, tong so viec, phan tram, viec tiep theo.

De lam widget that:

- iOS: sau `npx expo prebuild`, them Widget Extension trong Xcode, dung App Groups de doc shared data. Neu can doc tu native storage, tao native module nho de mirror summary tu JS sang UserDefaults suite cua App Group.
- Android: sau `npx expo prebuild`, them App Widget Provider hoac Jetpack Glance trong `android/`. Widget doc summary tu SharedPreferences. Tao native module de mirror summary tu JS sang SharedPreferences widget.

Giai doan hien tai da co data contract cho widget, nen khi them native widget se khong can viet lai logic tinh progress trong tung nen tang.

## Store readiness

- Bundle ID iOS: `com.ngocsonle.newbeginnings100`
- Android package: `com.ngocsonle.newbeginnings100`
- Truoc khi publish can thay icon/splash that, privacy policy, screenshots, store description, va test tren thiet bi that.
