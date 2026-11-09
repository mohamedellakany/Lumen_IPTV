import { Redirect } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph, SECTION_ICONS } from '@/components/Glyph';
import { SideNav } from '@/components/SideNav';
import { useLayout } from '@/hooks/useLayout';
import { useActiveProfile } from '@/store/profiles';
import { colors, fontFamily } from '@/theme';

const tab = (name: string, title: string) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Glyph icon={SECTION_ICONS[name][focused ? 1 : 0]} size={size} color={color as string} />
  ),
});

export default function TabsLayout() {
  const profile = useActiveProfile();
  const { isWide, navWidth, compactNav } = useLayout();
  const insets = useSafeAreaInsets();
  if (!profile) return <Redirect href="/login" />;

  return (
    <Tabs
      // Tablets, desktop and TV get a left navigation rail; phones keep the bottom tab bar.
      tabBar={isWide ? (props) => <SideNav {...props} width={navWidth} compact={compactNav} /> : undefined}
      screenOptions={{
        headerShown: false,
        // Cross-fade between sections instead of an instant cut.
        animation: 'fade',
        tabBarPosition: isWide ? 'left' : 'bottom',
        tabBarActiveTintColor: colors.primary,
        tabBarLabelStyle: { fontFamily: fontFamily(600) },
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        // Keep screens clear of the notch on the right in landscape (the rail covers the left).
        sceneStyle: { backgroundColor: colors.bg, paddingRight: insets.right, paddingLeft: isWide ? 0 : insets.left },
      }}
    >
      <Tabs.Screen name="home" options={tab('home', 'Home')} />
      <Tabs.Screen name="live" options={tab('live', 'Live TV')} />
      <Tabs.Screen name="movies" options={tab('movies', 'Movies')} />
      <Tabs.Screen name="series" options={tab('series', 'Series')} />
      <Tabs.Screen name="favorites" options={tab('favorites', 'My List')} />
    </Tabs>
  );
}
