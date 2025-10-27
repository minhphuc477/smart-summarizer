// Mock Supabase before importing route
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn()
    },
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

import { supabase } from '@/lib/supabase';

let getHandler: (req: Request, props: any) => Promise<Response>;
let postHandler: (req: Request, props: any) => Promise<Response>;
let deleteHandler: (req: Request, props: any) => Promise<Response>;

beforeAll(async () => {
  ({ GET: getHandler, POST: postHandler, DELETE: deleteHandler } = await import('../workspaces/[id]/members/route'));
});

describe('GET /api/workspaces/[id]/members', () => {
  const mockRequest = () => ({
    url: 'http://localhost:3000/api/workspaces/ws-123/members',
    headers: new Headers(),
    method: 'GET'
  } as unknown as Request);

  const mockProps = { params: Promise.resolve({ id: 'ws-123' }) };

  test('requires authentication', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });

    const req = mockRequest();
    const response = await getHandler(req, mockProps);
    expect(response.status).toBe(401);
  });

  test('returns workspace members when authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const mockMembers = [
      { user_id: 'user-123', role: 'owner' },
      { user_id: 'user-456', role: 'member' }
    ];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockMembers,
            error: null
          })
        })
      })
    });

    const req = mockRequest();
    const response = await getHandler(req, mockProps);
    expect(response.status).toBe(200);
  });
});

describe('POST /api/workspaces/[id]/members', () => {
  const mockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/workspaces/ws-123/members',
    headers: new Headers(),
    method: 'POST'
  } as unknown as Request);

  const mockProps = { params: Promise.resolve({ id: 'ws-123' }) };

  test('requires authentication', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });

    const req = mockRequest({ email: 'user@example.com' });
    const response = await postHandler(req, mockProps);
    expect(response.status).toBe(401);
  });

  test('requires email parameter', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const req = mockRequest({});
    const response = await postHandler(req, mockProps);
    expect(response.status).toBe(400);
  });

  test('invites member when authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: { success: true, user_id: 'user-456' },
      error: null
    });

    const req = mockRequest({ email: 'newuser@example.com' });
    const response = await postHandler(req, mockProps);
    expect(response.status).toBe(201);
  });
});

describe('DELETE /api/workspaces/[id]/members', () => {
  const mockRequest = (userId: string) => ({
    url: `http://localhost:3000/api/workspaces/ws-123/members?userId=${userId}`,
    headers: new Headers(),
    method: 'DELETE'
  } as unknown as Request);

  const mockProps = { params: Promise.resolve({ id: 'ws-123' }) };

  test('requires authentication', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });

    const req = mockRequest('user-456');
    const response = await deleteHandler(req, mockProps);
    expect(response.status).toBe(401);
  });

  test('requires userId parameter', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const req = {
      url: 'http://localhost:3000/api/workspaces/ws-123/members',
      headers: new Headers(),
      method: 'DELETE'
    } as unknown as Request;

    const response = await deleteHandler(req, mockProps);
    expect(response.status).toBe(400);
  });

  test('removes member when authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    (supabase.from as jest.Mock).mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      })
    });

    const req = mockRequest('user-456');
    const response = await deleteHandler(req, mockProps);
    expect(response.status).toBe(200);
  });
});
