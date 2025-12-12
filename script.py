from pathlib import Path
path = Path('README.md')
for i, line in enumerate(path.read_bytes().splitlines(), 1):
    print(i, line)
