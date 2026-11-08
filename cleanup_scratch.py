import os

# Clean up scratch files that should not be in the repo
for root, dirs, files in os.walk('D:\\code', followlinks=True):
    for f in files:
        if f.startswith('tmp_') or f.startswith('fix_route') or f.startswith('fix_ai') or f.startswith('fix_all') or f.startswith('cmp') or f.startswith('apply_fixes'):
            full = os.path.join(root, f)
            try:
                os.remove(full)
                print('Removed', full)
            except Exception as e:
                print('Failed to remove', full, e)

# Also remove the .claude/worktrees folder if it exists (optional)
worktree_dir = 'D:\\code\\Live_photo_share\\.claude\\worktrees'
if os.path.exists(worktree_dir):
    print('Worktree dir exists, skipping removal')