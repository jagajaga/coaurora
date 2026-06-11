# Coaurora Windows screensaver.
#   On Windows (MinGW):   make CC=gcc
#   Cross from Linux/CI:  make            (needs gcc-mingw-w64-x86-64)

CC ?= x86_64-w64-mingw32-gcc

Coaurora.scr: coaurora.c
	$(CC) -O2 -Wall -mwindows -o $@ $< -lopengl32 -lgdi32 -luser32

clean:
	rm -f Coaurora.scr

.PHONY: clean
