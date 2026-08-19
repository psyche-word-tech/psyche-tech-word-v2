import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import StudyScreen from '@/screens/study';

export default function IndexPage() {
  const { user, isLoading } = useAuth();
  const router = useSafeRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user]);

  if (isLoading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return <StudyScreen />;
}
