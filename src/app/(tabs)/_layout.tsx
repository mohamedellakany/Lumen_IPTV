import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';

import { NAV_ICONS, SideNav } from '@/components/SideNav';
import { useLayout } from '@/hooks/useLayout';
import { useActiveProfile } from '@/store/profiles';
import { colors } from '@/theme';

const tab = (name: string, title: string) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={NAV_ICONS[name][focused ? 1 : 0]} size={size} color={color as string} />
  ),
});

export default function TabsLayout() {
  const profile = useActiveProfile();
  const { isWide, navWidth } = useLayout();
  if (!profile) return <Redirect href="/login" />;

  return (
    <Tabs
      // Tablets, desktop and TV get a left navigation rail; phones keep the bottom tab bar.
      tabBar={isWide ? (props) => <SideNav {...props} width={navWidth} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isWide ? 'left' : 'bottom',
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
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
