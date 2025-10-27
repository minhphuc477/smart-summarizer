import { GET } from '@/app/api/share/[shareId]/route';

jest.mock('@/lib/supabase', () => {
  const from = jest.fn((table: string) => {
    if (table === 'notes') {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: { id: 'n1', is_public: true, summary: 'S', takeaways: [], actions: [], tags: [], sentiment: 'neutral', created_at: '2025-01-01' }, error: null }) }) }) }),
      } as any;
    }
    return { select: () => ({ data: [], error: null }) } as any;
  });
  return { supabase: { from } };
});

describe('/api/share/[shareId]', () => {
  const props = { params: Promise.resolve({ shareId: 'abc' }) } as any;

  it('GET returns a public note by shareId', async () => {
    const res = await GET({} as any, props);
    expect(res.status).toBe(200);
  });
});
