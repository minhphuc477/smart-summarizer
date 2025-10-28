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
  ({ GET: getHandler, PATCH: patchHandler, DELETE: deleteHandler } = await import('../folders/[id]/route'));
});

describe('GET /api/folders/[id]', () => {
  const mockRequest = () => ({
    url: 'http://localhost:3000/api/folders/folder-123',
    headers: new Headers(),
    method: 'GET'
  } as unknown as Request);

  const mockProps = { params: Promise.resolve({ id: 'folder-123' }) };

  test('requires authentication', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });

    const req = mockRequest();
    const response = await getHandler(req, mockProps);
    expect(response.status).toBe(401);
  });

  test('returns folder when authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const mockFolder = {
      id: 'folder-123',
      name: 'My Folder',
      note_count: 5
    };

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockFolder,
              error: null
            })
          })
        })
      })
    });

    const req = mockRequest();
    const response = await getHandler(req, mockProps);
    expect(response.status).toBe(200);
  });
});

describe('PATCH /api/folders/[id]', () => {
  const mockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/folders/folder-123',
    headers: new Headers(),
    method: 'PATCH'
  } as unknown as Request);

  const mockProps = { params: Promise.resolve({ id: 'folder-123' }) };

  test('requires authentication', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });

    const req = mockRequest({ name: 'Updated Name' });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(401);
  });

  test('validates folder name is not empty', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const req = mockRequest({ name: '   ' });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(400);
  });

  test('validates folder name length', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const longName = 'a'.repeat(101);
    const req = mockRequest({ name: longName });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(400);
  });

  test('updates folder when authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    const updatedFolder = {
      id: 'folder-123',
      name: 'Updated Name',
      description: 'Updated description',
      color: '#ff0000'
    };

    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: updatedFolder,
                error: null
              })
            })
          })
        })
      })
    });

    const req = mockRequest({ name: 'Updated Name', description: 'Updated description', color: '#ff0000' });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/folders/[id]', () => {
  const mockRequest = () => ({
    url: 'http://localhost:3000/api/folders/folder-123',
    headers: new Headers(),
    method: 'DELETE'
  } as unknown as Request);

  const mockProps = { params: Promise.resolve({ id: 'folder-123' }) };

  test('requires authentication', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });

    const req = mockRequest();
    const response = await deleteHandler(req, mockProps);
    expect(response.status).toBe(401);
  });

  test('deletes folder when authenticated', async () => {
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

    const req = mockRequest();
    const response = await deleteHandler(req, mockProps);
    expect(response.status).toBe(200);
  });
});
