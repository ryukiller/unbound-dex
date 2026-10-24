"""Draw the Poké Ball app icons (no dependencies)."""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")


def png(path, size, pad):
    bg, red, white, black = (20, 22, 28), (239, 68, 68), (245, 245, 245), (17, 17, 17)
    c = (size - 1) / 2
    r = size / 2 * (1 - pad)
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            px = bg
            # 3x3 supersampling for smooth edges
            acc = [0, 0, 0]
            for sy in (-.33, 0, .33):
                for sx in (-.33, 0, .33):
                    dx, dy = x + sx - c, y + sy - c
                    d = (dx * dx + dy * dy) ** .5
                    if d > r:
                        col = bg
                    elif d > r * .9:
                        col = black
                    elif d < r * .2:
                        col = white if d < r * .13 else black
                    elif abs(dy) < r * .08:
                        col = black
                    else:
                        col = red if dy < 0 else white
                    acc = [a + b for a, b in zip(acc, col)]
            px = tuple(int(a / 9) for a in acc)
            row += bytes(px)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(os.path.join(OUT, path), "wb").write(data)


png("icon-192.png", 192, .12)
png("icon-512.png", 512, .12)
png("icon-maskable-512.png", 512, .3)
png("apple-touch-icon.png", 180, .14)
