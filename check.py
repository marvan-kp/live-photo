import os

p = 'D:\\code\\Live_photo_share\\web\\src\\components\\ui\\GlassButton.tsx'
print('exists:', os.path.exists(p))
if os.path.exists(p):
    s = open(p).read()
    print('first 3 lines:', s.splitlines()[:3])
    print('has "use client":', '"use client"' in s)
    print('extends React.ButtonHTMLAttributes:', 'extends React.ButtonHTMLAttributes<HTMLButtonElement>' in s)