// ─── App.js ───────────────────────────────────────────────────────────────────
// Root navigator with Bottom Tabs + Auth Stack
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getToken, authAPI } from './services/api';
import LoginScreen        from './screens/LoginScreen';
import RegisterScreen     from './screens/RegisterScreen';
import DashboardScreen    from './screens/DashboardScreen';
import AnalyticsScreen    from './screens/AnalyticsScreen';
import SettingsScreen     from './screens/SettingsScreen';
import EventDetailScreen  from './screens/EventDetailScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();
const T = { bg: '#0A0E1A', surface: '#111827', border: '#1F2A3D', accent: '#00D4FF', textMuted: '#64748B' };

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: T.surface, borderTopColor: T.border, borderTopWidth: 1, height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>🛡</Text>, tabBarLabel: 'MONITOR' }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen}
        options={{ tabBarIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>📊</Text>, tabBarLabel: 'ANALYTICS' }} />
      <Tab.Screen name="Settings"  component={SettingsScreen}
        options={{ tabBarIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>⚙️</Text>, tabBarLabel: 'SETTINGS' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getToken();
        if (token) { await authAPI.me(); setInitialRoute('Main'); }
        else setInitialRoute('Auth');
      } catch { setInitialRoute('Auth'); }
    };
    checkAuth();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} />
        <Text style={{ fontSize: 32, marginBottom: 16 }}>⬡</Text>
        <ActivityIndicator size="large" color={T.accent} />
        <Text style={{ color: T.textMuted, marginTop: 12, fontSize: 12, letterSpacing: 2 }}>INITIALISING...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg }, animation: 'fade' }}
        >
          <Stack.Screen name="Auth"        component={LoginScreen} />
          <Stack.Screen name="Register"    component={RegisterScreen} />
          <Stack.Screen name="Main"        component={MainTabs} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ animation: 'slide_from_right' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
