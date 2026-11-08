import { Tabs } from 'expo-router';

export default function Layout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(tabs)/Camera" options={{ title: 'Camera' }} />
      <Tabs.Screen name="(tabs)/AdvancedCamera" options={{ title: 'Advanced' }} />
    </Tabs>
  );
}
