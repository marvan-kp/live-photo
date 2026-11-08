import os

for root, dirs, files in os.walk('D:\\code', followlinks=True):
    if 'package.json' in files:
        print('WEB ROOT:', root)
        # check key files
        for p in ['src/app/ai-search/page.tsx', 'src/lib/events.ts', 'src/components/ui/GlassButton.tsx']:
            full = os.path.join(root, p)
            print('  ', p, os.path.exists(full))
        break