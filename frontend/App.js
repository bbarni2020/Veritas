import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import FeedScreen from './screens/FeedScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#000',
    card: 'rgba(20, 20, 20, 0.95)',
    text: '#F9FAFB',
    border: 'rgba(255, 255, 255, 0.1)',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={MyTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Feed') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarStyle: {
            backgroundColor: 'rgba(28, 28, 30, 0.7)',
            borderRadius: 24,
            borderTopWidth: 0,
            borderBottomWidth: 0,
            borderWidth: 0.5,
            borderColor: 'rgba(255, 255, 255, 0.15)',
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            elevation: 0,
            height: 68,
            paddingBottom: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 20,
          },
          tabBarShowLabel: false,
          headerStyle: { 
            backgroundColor: 'rgba(28, 28, 30, 0.92)',
            shadowColor: 'transparent',
            elevation: 0,
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(255, 255, 255, 0.1)',
          },
          headerTintColor: '#F9FAFB',
          headerTitleStyle: { fontWeight: '600', fontSize: 17, letterSpacing: 0.3 },
        })}
      >
        <Tab.Screen name="Feed" component={FeedScreen} options={{headerShown: false}} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
