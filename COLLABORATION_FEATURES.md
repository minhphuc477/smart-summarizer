# Collaboration Features Documentation

## Tổng quan

Nhóm tính năng Cộng tác (Collaboration Features) mở rộng Smart Summarizer từ công cụ cá nhân thành nền tảng làm việc nhóm, cho phép:

1. **Workspaces/Teams** - Không gian làm việc chung
2. **Public Share Links** - Chia sẻ ghi chú công khai qua link

## 1. Workspaces / Teams

### Mô tả

Cho phép người dùng tạo các không gian làm việc chung (Workspaces), mỗi workspace có:
- Nhiều thành viên (members)
- Ghi chú và folder được chia sẻ cho toàn bộ thành viên
- Phân quyền theo vai trò (owner, admin, member)

### Database Schema

#### Bảng `workspaces`
```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Bảng `workspace_members`
```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, user_id)
);
```

#### Cập nhật bảng `notes`
```sql
ALTER TABLE notes 
ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
```

#### Cập nhật bảng `folders`
```sql
ALTER TABLE folders
ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
```

### Row Level Security (RLS)

#### Workspaces
- **SELECT**: User có thể xem workspace nếu là member
- **INSERT**: User có thể tạo workspace mới
- **UPDATE**: Owner và admin có thể update
- **DELETE**: Chỉ owner có thể delete

#### Workspace Members
- **SELECT**: User có thể xem members của workspace họ tham gia
- **INSERT**: Owner và admin có thể thêm members
- **DELETE**: Owner và admin có thể xóa members (trừ owner)

#### Notes (Updated)
- **SELECT**: User có thể xem nếu:
  - Họ là owner của note, HOẶC
  - Note thuộc workspace mà họ là member, HOẶC
  - Note được public (is_public = true)

### API Routes

#### `/api/workspaces`

**GET** - Lấy danh sách workspaces của user
```typescript
// Response
{
  workspaces: [
    {
      id: string,
      name: string,
      description: string,
      role: 'owner' | 'admin' | 'member',
      member_count: number,
      note_count: number,
      folder_count: number
    }
  ]
}
```

**POST** - Tạo workspace mới
```typescript
// Request
{
  name: string,
  description?: string
}

// Response
{
  workspace: {
    id: string,
    name: string,
    description: string,
    owner_id: string,
    created_at: string
  }
}
```

#### `/api/workspaces/[id]`

**GET** - Lấy chi tiết workspace
```typescript
// Response
{
  workspace: {
    workspace_id: string,
    workspace_name: string,
    owner_id: string,
    member_count: number,
    note_count: number,
    folder_count: number
  }
}
```

**PATCH** - Cập nhật workspace
```typescript
// Request
{
  name?: string,
  description?: string
}
```

**DELETE** - Xóa workspace (chỉ owner)

#### `/api/workspaces/[id]/members`

**GET** - Lấy danh sách members
```typescript
// Response
{
  members: [
    {
      id: string,
      workspace_id: string,
      user_id: string,
      role: string,
      joined_at: string,
      user: {
        id: string,
        email: string
      }
    }
  ]
}
```

**POST** - Mời member mới qua email
```typescript
// Request
{
  email: string
}

// Response
{
  success: boolean,
  userId?: string,
  error?: string
}
```

**DELETE** - Xóa member
```
Query: ?userId=<user_id>
```

### Helper Functions

#### `invite_to_workspace(workspace_uuid, invitee_email, inviter_uuid)`
```sql
-- Mời user vào workspace by email
-- Kiểm tra permission của inviter (owner/admin)
-- Tìm user by email
-- Thêm vào workspace_members
-- Return JSON result
```

#### `is_workspace_member(workspace_uuid, user_uuid)`
```sql
-- Check xem user có phải member của workspace không
```

#### `get_workspace_role(workspace_uuid, user_uuid)`
```sql
-- Lấy role của user trong workspace
```

### Views

#### `workspace_stats`
```sql
-- Thống kê workspace: member_count, note_count, folder_count
```

#### `user_workspaces`
```sql
-- Danh sách workspaces của user với role và stats
```

### Frontend Components

#### `WorkspaceManager.tsx`

Component quản lý workspaces:

**Props:**
```typescript
{
  selectedWorkspaceId: string | null,
  onWorkspaceChange: (workspaceId: string | null) => void
}
```

**Features:**
- Dropdown selector: Personal / Workspace 1 / Workspace 2...
- Create workspace dialog
- Workspace settings dialog
  - Members tab: Invite, remove members
  - Settings tab: Delete workspace
- Display current workspace info

**States:**
```typescript
const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
const [createDialogOpen, setCreateDialogOpen] = useState(false);
const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '' });
```

**Functions:**
- `fetchWorkspaces()` - Lấy danh sách workspaces
- `handleCreate()` - Tạo workspace mới
- `handleDelete()` - Xóa workspace
- `handleInvite()` - Mời member
- `handleRemoveMember()` - Xóa member

### Integration vào SummarizerApp

```tsx
// State
const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

// Sidebar
<aside className="w-64 border-r p-4">
  <WorkspaceManager
    selectedWorkspaceId={selectedWorkspaceId}
    onWorkspaceChange={setSelectedWorkspaceId}
  />
  <FolderSidebar ... />
</aside>

// Khi summarize
body: JSON.stringify({ 
  notes, 
  customPersona, 
  userId,
  folderId,
  workspaceId: selectedWorkspaceId
})
```

---

## 2. Public Share Links

### Mô tả

Cho phép người dùng chia sẻ ghi chú qua link công khai, bất kỳ ai có link đều có thể xem (chế độ read-only).

### Database Schema

#### Cập nhật bảng `notes`
```sql
ALTER TABLE notes
ADD COLUMN share_id UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN is_public BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_notes_share_id ON notes(share_id) WHERE is_public = TRUE;
```

**Fields:**
- `share_id`: UUID duy nhất để tạo public URL
- `is_public`: Boolean flag để enable/disable sharing

### API Routes

#### `/api/notes/[id]/share`

**PATCH** - Toggle public sharing
```typescript
// Request
{
  isPublic: boolean
}

// Response
{
  note: {
    id: number,
    is_public: boolean,
    share_id: string,
    ...
  }
}
```

#### `/api/share/[shareId]`

**GET** - Lấy public note (không cần auth)
```typescript
// Response
{
  note: {
    id: string,
    summary: string,
    takeaways: string[],
    actions: ActionItem[],
    tags: string[],
    sentiment: string,
    created_at: string
    // KHÔNG bao gồm: user_id, original_notes, workspace_id
  }
}
```

### Public Share Page

#### `/app/share/[shareId]/page.tsx`

Public page để xem shared note:

**Features:**
- Không cần authentication
- Hiển thị summary, takeaways, actions, tags
- Calendar integration cho action items
- Responsive design
- Theme support (dark/light)

**Layout:**
```tsx
<div className="min-h-screen bg-background">
  <h1>Shared Summary</h1>
  <Card>Summary</Card>
  <Card>Takeaways</Card>
  <Card>Action Items (with calendar buttons)</Card>
  <Card>Tags</Card>
  <footer>Powered by Smart Summarizer</footer>
</div>
```

### Frontend Integration - History Component

#### Updated Types
```typescript
type Note = {
  // ... existing fields
  is_public?: boolean,
  share_id?: string
}
```

#### New States
```typescript
const [copiedNoteId, setCopiedNoteId] = useState<number | null>(null);
```

#### New Functions
```typescript
// Toggle public sharing
const handleToggleShare = async (noteId: number, currentIsPublic: boolean) => {
  await fetch(`/api/notes/${noteId}/share`, {
    method: 'PATCH',
    body: JSON.stringify({ isPublic: !currentIsPublic })
  });
};

// Copy share link to clipboard
const handleCopyShareLink = async (noteId: number, shareId: string) => {
  const shareUrl = `${window.location.origin}/share/${shareId}`;
  await navigator.clipboard.writeText(shareUrl);
  setCopiedNoteId(noteId);
  setTimeout(() => setCopiedNoteId(null), 2000);
};
```

#### UI Buttons
```tsx
<Button
  variant={note.is_public ? "default" : "ghost"}
  onClick={() => handleToggleShare(note.id, note.is_public)}
>
  <Share2 />
</Button>

{note.is_public && note.share_id && (
  <Button onClick={() => handleCopyShareLink(note.id, note.share_id)}>
    {copiedNoteId === note.id ? <Check /> : <Copy />}
  </Button>
)}
```

---

## Migration Instructions

### 1. Run SQL Migration

```bash
# Connect to Supabase SQL Editor
# Copy and execute: supabase-migration-workspaces.sql
```

### 2. Verify Database

```sql
-- Check tables
SELECT * FROM workspaces LIMIT 5;
SELECT * FROM workspace_members LIMIT 5;

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('workspaces', 'workspace_members', 'notes', 'folders');

-- Check functions
SELECT proname FROM pg_proc WHERE proname IN ('invite_to_workspace', 'is_workspace_member', 'get_workspace_role');

-- Check views
SELECT * FROM workspace_stats LIMIT 5;
SELECT * FROM user_workspaces LIMIT 5;
```

### 3. Test API Routes

```bash
# Test workspaces API
curl -X GET http://localhost:3000/api/workspaces

# Test create workspace
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Workspace","description":"Test"}'

# Test public share
curl -X GET http://localhost:3000/api/share/[some-share-id]
```

---

## User Workflows

### Workflow 1: Create và Manage Workspace

1. User click "New Workspace" button
2. Enter workspace name & description
3. Click "Create"
4. Workspace appears in dropdown
5. Select workspace to work in
6. All new notes/folders created trong workspace này
7. Click Settings icon để manage members
8. Enter email to invite members
9. Members receive access instantly

### Workflow 2: Collaborate trong Workspace

1. User A creates workspace "Marketing Team"
2. User A invites User B (user-b@example.com)
3. User B sees "Marketing Team" trong workspace dropdown
4. User B selects "Marketing Team"
5. User B creates note → saved in workspace
6. User A can see User B's note
7. Both users can search/filter notes trong workspace

### Workflow 3: Public Share Note

1. User creates a summary
2. Click Share button (Share2 icon) trong History
3. Note turns public (button highlighted)
4. Click Copy button → share link copied
5. Share link với anyone
6. Recipients open link → see read-only view
7. Click Share button again → make private

---

## Security Considerations

### RLS Policies

**Critical checks:**
- User chỉ xem được notes của họ hoặc workspace notes
- Workspace members được verify through JOIN query
- Public notes accessible by anyone nhưng READ-ONLY
- DELETE operations restricted to owners

### Share Links

**Security measures:**
- UUID-based share_id (không đoán được)
- Explicit is_public flag (default false)
- No sensitive data trong public view (no original_notes, user_id)
- Can be revoked bất cứ lúc nào

### Permissions

**Role hierarchy:**
- **Owner**: Full control, can delete workspace
- **Admin**: Manage members, settings (except delete workspace)
- **Member**: View, create, edit own notes

---

## Performance Optimizations

### Database Indexes

```sql
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_notes_workspace_id ON notes(workspace_id);
CREATE INDEX idx_folders_workspace_id ON folders(workspace_id);
CREATE INDEX idx_notes_share_id ON notes(share_id) WHERE is_public = TRUE;
```

### Views for Aggregation

- `workspace_stats`: Pre-computed counts
- `user_workspaces`: JOIN workspace data với member role

### Frontend Optimizations

- Workspace list cached trong component state
- Members list fetched on-demand (dialog open)
- Share link copy uses Clipboard API (async)

---

## Testing Scenarios

### Test 1: Workspace Creation
```typescript
✓ Create workspace with valid name
✓ Create workspace with description
✓ Validation: Empty name rejected
✓ Validation: Name > 100 chars rejected
✓ Owner auto-added as member
```

### Test 2: Member Management
```typescript
✓ Invite existing user by email
✓ Error: Invite non-existent user
✓ Error: Invite existing member
✓ Remove member (as owner)
✓ Error: Remove owner
✓ Leave workspace (as member)
```

### Test 3: Workspace Notes
```typescript
✓ Create note in workspace
✓ Other members can see note
✓ Filter notes by workspace
✓ Notes cascade delete when workspace deleted
```

### Test 4: Public Sharing
```typescript
✓ Toggle note to public
✓ Access public URL without auth
✓ Copy share link to clipboard
✓ Toggle back to private
✓ Error: Access private share_id
```

### Test 5: RLS Policies
```typescript
✓ User A cannot see User B's private notes
✓ User A can see workspace notes
✓ User A cannot delete workspace they don't own
✓ Public notes accessible without auth
```

---

## Troubleshooting

### Issue: Cannot see workspace notes

**Check:**
1. Verify workspace_id set correctly khi create note
2. Check user là member của workspace
3. Verify RLS policies enabled

### Issue: Invite by email fails

**Check:**
1. User với email đó đã có account chưa?
2. Inviter có role owner/admin không?
3. Member đã tồn tại trong workspace chưa?

### Issue: Public share link không work

**Check:**
1. Note có `is_public = true` không?
2. `share_id` có hợp lệ không?
3. URL format đúng: `/share/[shareId]`
4. API route `/api/share/[shareId]` hoạt động chưa?

---

## Future Enhancements

### Workspace Features
- [ ] Workspace templates
- [ ] Workspace activity log
- [ ] Member roles customization
- [ ] Workspace settings (privacy, permissions)
- [ ] Bulk operations (move multiple notes)

### Sharing Features
- [ ] Password-protected shares
- [ ] Expiring share links
- [ ] View analytics (view count, visitors)
- [ ] Embed code for websites
- [ ] Share via email integration

### Collaboration Features
- [ ] Real-time collaboration (WebSocket)
- [ ] Comments on notes
- [ ] Mentions (@user)
- [ ] Notifications system
- [ ] Version history

---

## API Reference Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/workspaces` | GET | ✓ | List user's workspaces |
| `/api/workspaces` | POST | ✓ | Create workspace |
| `/api/workspaces/[id]` | GET | ✓ | Get workspace details |
| `/api/workspaces/[id]` | PATCH | ✓ | Update workspace |
| `/api/workspaces/[id]` | DELETE | ✓ | Delete workspace (owner only) |
| `/api/workspaces/[id]/members` | GET | ✓ | List members |
| `/api/workspaces/[id]/members` | POST | ✓ | Invite member |
| `/api/workspaces/[id]/members` | DELETE | ✓ | Remove member |
| `/api/notes/[id]/share` | PATCH | ✓ | Toggle public sharing |
| `/api/share/[shareId]` | GET | ✗ | Get public note |

---

**Version:** 1.0.0  
**Created:** October 27, 2025  
**Author:** Smart Summarizer Team
