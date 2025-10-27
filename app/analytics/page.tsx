"use client";

import { useEffect, useState } from 'react';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { supabase } from '@/lib/supabase';

export default function AnalyticsPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  if (!userId) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Track your usage and productivity insights
        </p>
      </div>
      <AnalyticsDashboard userId={userId} />
    </div>
  );
}
