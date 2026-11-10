import { Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold } from '@expo-google-fonts/cairo';
import { Exo2_400Regular, Exo2_500Medium, Exo2_600SemiBold, Exo2_700Bold, Exo2_800ExtraBold } from '@expo-google-fonts/exo-2';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useStoresHydrated } from '@/store/hydration';
import { colors, fontFamily } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
// Phones and tablets always run in landscape. app.json's "orientation" covers iOS, but the Android TV
// plugin strips it from the (shared TV + mobile) Android build, so lock at runtime. TVs are landscape anyway.
if (!Platform.isTV && Platform.OS !== 'web') {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, gcTime: 2 * 60 * 60 * 1000 },
  },
});

// Keys are the family names used in styles (see `fontFamily` in theme).
const FONTS = {
  Exo2_400Regular,
  Exo2_500Medium,
  Exo2_600SemiBold,
  Exo2_700Bold,
  Exo2_800ExtraBold,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
};

const theme = {
  ...DarkTheme,
  fonts: {
    regular: { fontFamily: fontFamily(400), fontWeight: 'normal' as const },
    medium: { fontFamily: fontFamily(500), fontWeight: 'normal' as const },
    bold: { fontFamily: fontFamily(700), fontWeight: 'normal' as const },
    heavy: { fontFamily: fontFamily(800), fontWeight: 'normal' as const },
  },
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.primary, text: colors.text, border: colors.border },
};

// Detail screens draw their backdrop under a transparent header.
const detailHeader = {
  title: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  animation: 'fade_from_bottom' as const,
};

export default function RootLayout() {
  const hydrated = useStoresHydrated();
  // If a font fails to load, carry on with the system font rather than a blank screen.
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const ready = hydrated && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        {/* Android: hide the system Back/Home/Recents bar for a full-screen app; a swipe from the edge shows it briefly. */}
        <NavigationBar hidden />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { fontFamily: fontFamily(700) },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="movie/[id]" options={detailHeader} />
          <Stack.Screen name="series/[id]" options={detailHeader} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
          <Stack.Screen
            name="player"
            options={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: '#000' },
              // iOS 26+ swipes back from anywhere by default, which steals sideways drags on the time bar.
              // The player has its own Back button.
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
              // Full-screen viewing: no clock/Wi-Fi/battery bar, and the iPhone home bar fades away.
              // (The screen navigator owns the status bar on iOS, so it has to be set here.)
              statusBarHidden: true,
              autoHideHomeIndicator: true,
              navigationBarHidden: true,
            }}
          />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
