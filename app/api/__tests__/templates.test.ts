import { GET, POST } from '@/app/api/templates/route';

jest.mock('@/lib/supabaseServer');

jest.mock('@/lib/supabase', () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }) };
  const from = jest.fn((table: string) => {
    if (table === 'templates') {
      return {
        select: () => ({ or: () => ({ order: () => ({ order: () => ({ data: [{ id: 't1' }], error: null }) }) }) }),
        insert: () => ({ select: () => ({ single: () => ({ data: { id: 't2' }, error: null }) }) }),
      } as any;
    }
    return { select: () => ({ data: [], error: null }) } as any;
  });
  return { supabase: { auth, from } };
});

describe('/api/templates root', () => {
  it('GET returns templates for authenticated user', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('POST validates required fields', async () => {
    const badReq = new Request('http://localhost/api/templates', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
    const resBad = await POST(badReq as any);
    expect([400, 401]).toContain(resBad.status);

    const goodReq = new Request('http://localhost/api/templates', { method: 'POST', body: JSON.stringify({ name: 'N', category: 'C', structure: {} }), headers: { 'Content-Type': 'application/json' } });
    const resOk = await POST(goodReq as any);
    expect([200, 201]).toContain(resOk.status);
  });
});
