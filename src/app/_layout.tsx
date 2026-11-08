import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useStoresHydrated } from '@/store/hydration';
import { colors } from '@/theme';

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

const theme = {
  ...DarkTheme,
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

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        {/* Android: hide the system Back/Home/Recents bar for a full-screen app; a swipe from the edge shows it briefly. */}
        <NavigationBar hidden />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
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
          <Stack.Screen
            name="player"
            options={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#000' } }}
          />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
