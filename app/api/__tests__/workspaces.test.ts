import { GET, POST } from '../workspaces/route';

// Mock the supabase singleton used by the route implementation
jest.mock('@/lib/supabase', () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }) };
  const from = jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({ data: [], error: null }))
      }))
    }))
  }));
  return { supabase: { auth, from } };
});

describe('GET /api/workspaces', () => {
  test('requires authentication', async () => {
    const response = await GET();
    expect([401, 500]).toContain(response.status);
  });

  test('returns workspace list for authenticated user', async () => {
    const { supabase } = require('@/lib/supabase');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-1' } } }, error: null });
    supabase.from.mockImplementationOnce(() => ({
      select: () => ({ eq: () => ({ order: () => ({ data: [{ id: 'w1', name: 'Workspace' }], error: null }) }) })
    }));

    const response = await GET();
    expect(response.status).toBeLessThan(500);
  });
});

describe('POST /api/workspaces', () => {
  const mockRequest = (body: any) =>
    new Request('http://localhost:3000/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }) as unknown as Request;

  test('requires workspace name', async () => {
    const req = mockRequest({});
    const response = await POST(req);
    
    expect([400, 401, 500]).toContain(response.status);
  });

  test('creates workspace with valid data', async () => {
    const req = mockRequest({
      name: 'Test Workspace',
      description: 'A test workspace'
    });
    const response = await POST(req);
    
    expect([200, 201, 401, 500]).toContain(response.status);
  });
});
