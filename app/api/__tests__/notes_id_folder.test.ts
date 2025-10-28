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

let patchHandler: (req: Request, props: any) => Promise<Response>;

beforeAll(async () => {
  ({ PATCH: patchHandler } = await import('../notes/[id]/folder/route'));
});

describe('PATCH /api/notes/[id]/folder', () => {
  const mockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/notes/note-123/folder',
    headers: new Headers(),
    method: 'PATCH'
  } as unknown as Request);

  const mockProps = { params: Promise.resolve({ id: 'note-123' }) };

  test('requires authentication', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null
    });

    const req = mockRequest({ folder_id: 'folder-123' });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(401);
  });

  test('moves note to folder when authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      callCount++;
      if (table === 'folders') {
        // First call: verify folder exists
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'folder-123' },
                  error: null
                })
              })
            })
          })
        };
      } else {
        // Second call: update note
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'note-123', folder_id: 'folder-123' },
                    error: null
                  })
                })
              })
            })
          })
        };
      }
    });

    const req = mockRequest({ folder_id: 'folder-123' });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(200);
  });

  test('removes note from folder when folder_id is null', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'note-123', folder_id: null },
                error: null
              })
            })
          })
        })
      })
    });

    const req = mockRequest({ folder_id: null });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(200);
  });

  test('returns 404 when folder does not exist', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Folder not found' }
            })
          })
        })
      })
    });

    const req = mockRequest({ folder_id: 'nonexistent-folder' });
    const response = await patchHandler(req, mockProps);
    expect(response.status).toBe(404);
  });
});
