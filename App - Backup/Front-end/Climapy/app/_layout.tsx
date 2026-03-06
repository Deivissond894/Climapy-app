import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';

// Force reload
export default function Layout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
    </AuthProvider>
  );
}
