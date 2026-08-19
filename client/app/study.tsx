import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import StudyScreen from '@/screens/study';

export default function StudyPage() {
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

  return <StudyScreen />;
}
