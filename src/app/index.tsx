import { Redirect } from 'expo-router';

import { useActiveProfile } from '@/store/profiles';

export default function Index() {
  const profile = useActiveProfile();
  return <Redirect href={profile ? '/home' : '/login'} />;
}
