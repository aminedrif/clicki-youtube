import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { PreviewScreen } from '../screens/PreviewScreen';
import { DownloadScreen } from '../screens/DownloadScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

const DarkNavigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.borderSubtle,
    notification: colors.accent,
  },
};

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer theme={DarkNavigationTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="Preview"
          component={PreviewScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Download"
          component={DownloadScreen}
          options={{
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
