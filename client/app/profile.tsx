import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import ProfileScreen from '@/screens/profile';

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useSafeRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user]);

  if (isLoading || !user) {
    return null;
  }

  return <ProfileScreen />;
}
