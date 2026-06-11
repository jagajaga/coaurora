# Coaurora macOS screensaver — build without Xcode (Command Line Tools suffice).
#   make install    build + install to ~/Library/Screen Savers
#   make uninstall  remove it
#   make clean      remove build artifacts

SAVER       = Coaurora.saver
INSTALL_DIR = $(HOME)/Library/Screen Savers

build:
	rm -rf $(SAVER)
	mkdir -p $(SAVER)/Contents/MacOS
	cp Info.plist $(SAVER)/Contents/Info.plist
	swiftc -O -emit-library \
	  -o $(SAVER)/Contents/MacOS/Coaurora \
	  -module-name Coaurora \
	  CoauroraSaver.swift \
	  -framework ScreenSaver -framework Metal -framework MetalKit -framework QuartzCore
	codesign --force --sign - $(SAVER)
	@echo "Built $(SAVER)"

install: build
	rm -rf "$(INSTALL_DIR)/$(SAVER)"
	mkdir -p "$(INSTALL_DIR)"
	cp -R $(SAVER) "$(INSTALL_DIR)/"
	@echo "Installed. Open System Settings → Screen Saver → Coaurora (under Other)."
	@echo "If System Settings was open, quit and reopen it to refresh the list."

uninstall:
	rm -rf "$(INSTALL_DIR)/$(SAVER)"

clean:
	rm -rf $(SAVER)

.PHONY: build install uninstall clean
