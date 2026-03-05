import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';

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
