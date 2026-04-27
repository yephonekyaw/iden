import asyncio
import sys
from db import init_db, drop_db


def main():
    if len(sys.argv) < 2:
        return

    cmd = sys.argv[1]

    if cmd == "init":
        asyncio.run(init_db())
    elif cmd == "drop":
        asyncio.run(drop_db())


if __name__ == "__main__":
    main()
