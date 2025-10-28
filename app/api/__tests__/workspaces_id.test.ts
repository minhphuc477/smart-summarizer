// Mock Supabase before importing route
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn()
    },
    from: jest.fn()
  }
}));

import { supabase } from '@/lib/supabase';

let getHandler: (req: Request, props: any) => Promise<Response>;
let patchHandler: (req: Request, props: any) => Promise<Response>;
let deleteHandler: (req: Request, props: any) => Promise<Response>;

beforeAll(async () => {
  ({ GET: getHandler, PATCH: patchHandler, DELETE: deleteHandler } = await import('../workspaces/[id]/route'));
});

describe('GET /api/workspaces/[id]', () => {
  const mockRequest = () => ({
    url: 'http://localhost:3000/api/workspaces/ws-123',
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

  test('returns workspace details when authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const mockWorkspace = {
      workspace_id: 'ws-123',
      name: 'My Workspace',
      member_count: 5
    };

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockWorkspace,
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

describe('PATCH /api/workspaces/[id]', () => {
  const mockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/workspaces/ws-123',
    headers: new Headers(),
    method: 'PATCH'
  } as unknown as Request);

  const mockProps = { params: Promise.resolve({ id: 'ws-123' }) };

  test('requires authentication', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });

    const req = mockRequest({ name: 'Updated Name' });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(401);
  });

  test('validates workspace name length', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const longName = 'a'.repeat(101);
    const req = mockRequest({ name: longName });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(400);
  });

  test('updates workspace when authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const updatedWorkspace = {
      id: 'ws-123',
      name: 'Updated Name',
      description: 'Updated description'
    };

    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: updatedWorkspace,
              error: null
            })
          })
        })
      })
    });

    const req = mockRequest({ name: 'Updated Name', description: 'Updated description' });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/workspaces/[id]', () => {
  const mockRequest = () => ({
    url: 'http://localhost:3000/api/workspaces/ws-123',
    headers: new Headers(),
    method: 'DELETE'
  } as unknown as Request);

  const mockProps = { params: Promise.resolve({ id: 'ws-123' }) };

  test('requires authentication', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });

    const req = mockRequest();
    const response = await deleteHandler(req, mockProps);
    expect(response.status).toBe(401);
  });

  test('deletes workspace when authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    (supabase.from as jest.Mock).mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      })
    });

    const req = mockRequest();
    const response = await deleteHandler(req, mockProps);
    expect(response.status).toBe(200);
  });
});
