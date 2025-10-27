import { GET, POST } from '@/app/api/analytics/route';

jest.mock('@/lib/supabase', () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }) };
  const from = jest.fn((table: string) => {
    switch (table) {
      case 'user_analytics':
        return { select: () => ({ eq: () => ({ gte: () => ({ order: () => ({ data: [{ date: '2025-01-01' }], error: null }) }) }) }) } as any;
      case 'user_analytics_summary':
        return { select: () => ({ eq: () => ({ single: () => ({ data: { total_notes: 10 }, error: null }) }) }) } as any;
      case 'usage_events':
        return {
          select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }) }),
          insert: () => ({ data: null, error: null }),
        } as any;
      case 'note_tags':
        return { select: () => ({ limit: () => ({ data: [{ tags: { name: 'work' } }, { tags: { name: 'ideas' } }], error: null }) }) } as any;
      default:
        return { select: () => ({ data: [], error: null }) } as any;
    }
  });
  const rpc = jest.fn(() => ({ data: null, error: null }));
  return { supabase: { auth, from, rpc } };
});

describe('/api/analytics', () => {
  it('GET returns analytics aggregate data', async () => {
    const req = new Request('http://localhost/api/analytics?range=7');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('POST validates event_type and tracks', async () => {
    const bad = new Request('http://localhost/api/analytics', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
    const badRes = await POST(bad as any);
    expect([400, 401]).toContain(badRes.status);

    const good = new Request('http://localhost/api/analytics', { method: 'POST', body: JSON.stringify({ event_type: 'note_created', event_data: {} }), headers: { 'Content-Type': 'application/json' } });
    const okRes = await POST(good as any);
    expect(okRes.status).toBe(200);
  });
});
