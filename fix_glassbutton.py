import os

WEB = r'D:\code\Live_photo_share\web'
gb_path = os.path.join(WEB, 'src', 'components', 'ui', 'GlassButton.tsx')
if os.path.exists(gb_path):
    s = open(gb_path, encoding='utf-8').read()
    if not '"use client"' in s:
        s = '"use client"\n' + s
    if not 'import { motion } from "framer-motion";' in s:
        # find the existing motion import
        lines = s.splitlines()
        for i, line in enumerate(lines):
            if 'import { motion } from "framer-motion";' in line:
                break
        else:
            # add after cn import
            for i, line in enumerate(lines):
                if 'import { cn } from "@/lib/utils";' in line:
                    lines.insert(i+1, 'import { motion } from "framer-motion";')
                    break
        s = '\n'.join(lines)
    if 'interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>' in s:
        s = s.replace(
            'interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {\n  variant?: "primary" | "secondary" | "ghost";\n}',
            'interface GlassButtonProps extends Omit<React.ComponentProps<typeof motion.button>, "variant"> {\n  variant?: "primary" | "secondary" | "ghost";\n}'
        )
    open(gb_path, 'w', encoding='utf-8').write(s)
    print('Patched', gb_path)
else:
    print('Not found:', gb_path)

# Also verify ai-search, events, api
for p in ['src/app/ai-search/page.tsx', 'src/lib/events.ts', 'src/app/api/events/route.ts']:
    full = os.path.join(WEB, p)
    if os.path.exists(full):
        s = open(full).read()
        if 'import Image from "next/image"' in s:
            print('OK', p)
        else:
            print('MISSING next/image in', p)